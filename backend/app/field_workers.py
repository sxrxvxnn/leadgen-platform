"""
Field Workers — per-field enrichment with independent retry chains and confidence scoring.

Each worker receives an Evidence dict containing all gathered data sources and tries them
in priority order. The first source that produces a valid value wins.

Confidence weights (from Sonar Intelligence Platform spec):
  website        = 100   official company website
  linkedin_page  =  90   scraped LinkedIn company page
  proxycurl      =  90   ProxyCurl structured company data
  search_snippet =  70   DDGS snippet / public search results
  desc_mining    =  65   regex pattern extracted from description text
  ai_inference   =  40   Gemini / Groq inference from context

Each worker returns:
  {"value": str | None, "confidence": int, "source": str, "status": "verified"|"inferred"|"not_public"}
"""

import re
import json
import requests

# ── Description normalizer ────────────────────────────────────────────────────

# Patterns where the entire text is junk and should be rejected
_DESC_SIDEBAR_START = re.compile(
    r'^\s*(?:'
    r'\d[\d,]*\s*[-–]\s*[\d,]+\s*employees?|'        # "11-50 employees"
    r'-\s*\d[\d,]*\+?\s*employees?|'                  # "-200 employees" (bad parse)
    r'\d[\d,]*\+\s*employees?|'                       # "1000+ employees"
    r'Headquarters\s*(?:[\n:]|\s+[A-Z])|'             # "Headquarters: ..." / "Headquarters City"
    r'Founded\s+in[.\s]+\d{4}\s*\(|'                 # "Founded in. 2002 (24 yrs old)"
    r'Address\s*[.:\n]|'                              # "Address. SBC Module 11..." (registry)
    r'\w+\.\s+Primary\.|'                             # "Education. Primary." (LinkedIn sidebar)
    r'[A-Z][a-z]+\s+[A-Z][a-z]+\s*:\s*(?:ex-|former\s+)?(?:executive|chairman|ceo|cto|coo|cfo|director|founder|president)'
    # "Larry Ellison: ex-executive chairman" (Wikipedia infobox / biography snippet)
    r')',
    re.I,
)

# Inline segments to strip — cut the text at the first match and discard the rest
_DESC_CUT_AT = [
    re.compile(r'\s*[;,]?\s*Key\s+Individuals?\b.*$',              re.I | re.S),
    re.compile(r'\s*[;,]?\s*Key\s+Personnel\b.*$',                 re.I | re.S),
    re.compile(r'\s*[;]\s*(?:Phone|Email|Contact)\b.*$',           re.I | re.S),
    re.compile(r'\s*\bPhone\s*(?:Number)?\s*[:\-]?\s*\+?[\d\s\-\.]{7,}.*$', re.I | re.S),
    re.compile(r'\s*\bEmail\s*[:\-]?\s*[\w.+-]+@.*$',              re.I | re.S),
    re.compile(r'\s+Employees\s+at\s+[A-Z][\w\s]+[.,].*$',        re.I | re.S),
    re.compile(r'\s*[,\s]+Co-[Ff]ounder(?:\s*&[^.]+)?\s+at\s+[A-Z].*$', re.I | re.S),
    re.compile(r'[…\.]{1,3}\s*\w{1,20}\s*$',                       re.S),  # "… hodo" trailing fragment
    # Comma + person title at end: ", Dr. Shani L. Ganga CEO & Managing Director of X"
    # Allow middle initials (L.) by using [A-Z][a-zA-Z.]+ instead of [A-Z][a-z]+
    re.compile(r',\s+(?:Dr\.|Mr\.|Ms\.|Mrs\.|Prof\.)?\s*[A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+)+\s+(?:CEO|CTO|CFO|COO|Managing\s+Director|Director|Founder|Chairman|President|Partner)[^.]{0,120}$', re.I | re.S),
]

# Inline metadata segments to strip (may appear mid-text)
_DESC_META_STRIP = [
    re.compile(r'\s*\d[\d,]*\s*[-–]\s*[\d,]+\+?\s*employees?\b[^.;]{0,80}', re.I),
    re.compile(r'\s*\bCompany\s+size\s*[:\s]+[^\n;]{0,80}',       re.I),
    re.compile(r'\s*\b(?:Global|India)\s+Employee\s+Count[.:\s]+[^\n;]{0,80}', re.I),
    re.compile(r'\s*\bHeadquarters?\s*:\s*[A-Za-z][^.;\n]{2,80}', re.I),
    re.compile(r'\s*\bType\s*:\s*(?:Privately|Publicly)\s+Held[^.;\n]{0,60}', re.I),
    re.compile(r'\s*\bFounded\s*:\s*\d{4}[^.;\n]{0,60}',          re.I),
    re.compile(r'\s*\bSpecialties?\s*[:\s]+[A-Za-z][^.;\n]{5,120}', re.I),
    re.compile(r'\s*\bLocations?\s*(?:Primary\s*)?:\s*[A-Za-z][^.;\n]{0,80}', re.I),
]


def _clean_description(text: str) -> str:
    """
    Normalize description text by removing LinkedIn sidebar boilerplate, company
    directory junk (Key Individuals, phone, email, address), and person-name fragments.
    Returns empty string when the entire text is metadata with no real description.
    """
    if not text:
        return text
    t = text.strip()
    # Reject entirely if it opens with sidebar / directory metadata
    if _DESC_SIDEBAR_START.match(t):
        return ""
    # Reject short category-label strings: comma-separated nouns with no sentence verb
    # e.g. "Appliances, Electrical, and Electronics Manufacturing" (industry label, not description)
    if len(t) < 100 and not re.search(r'\b(?:is|are|was|were|provides|provide|offers|offer|helps|help|builds|build|develops|develop|makes|make|enables|enable|focuses|focus)\b', t, re.I) and not re.search(r'\.\s', t):
        word_count = len(t.split())
        if word_count <= 10:  # Very short multi-word phrase with no verb → category label
            return ""
    # Cut the text at the first junk anchor (Key Individuals, Phone, Co-Founder at, etc.)
    for pat in _DESC_CUT_AT:
        t = pat.sub('', t)
    # Strip inline metadata key:value pairs
    for pat in _DESC_META_STRIP:
        t = pat.sub('', t)
    t = re.sub(r'\s{2,}', ' ', t).strip().strip('.,;… ')
    return t

# ── Confidence constants ──────────────────────────────────────────────────────
CONF = {
    "website":        100,
    "linkedin_page":   90,
    "proxycurl":       90,
    "search_snippet":  70,
    "desc_mining":     65,
    "ai_inference":    40,
}

_NOT_FOUND = {"value": None, "confidence": 0, "source": "not_found", "status": "not_public"}


def _result(value, source, status="verified"):
    return {"value": value, "confidence": CONF.get(source, 50), "source": source, "status": status}


def _ai_result(value, model="gemini"):
    return {"value": value, "confidence": CONF["ai_inference"], "source": f"ai_{model}", "status": "inferred"}


# ── Validators ────────────────────────────────────────────────────────────────

_VALID_YEAR_RE = re.compile(r'^\d{4}$')

def _valid_year(v):
    s = str(v or "").strip()
    return s if (_VALID_YEAR_RE.match(s) and 1800 <= int(s) <= 2030) else None

def _valid_hq(v):
    s = str(v or "").strip()
    return s if (3 < len(s) < 60) else None

def _valid_size(v):
    s = str(v or "").strip().replace(",", "").replace(" ", "")
    return s if re.match(r'^\d+(?:[-–]\d+|\+)?$', s) else None

def _valid_industry(v):
    BAD = {"private company", "privately held", "public company", "partnership",
           "sole proprietorship", "government agency", "null", "none", "unknown"}
    s = str(v or "").strip()
    return s if (s and s.lower() not in BAD and len(s) > 2) else None

def _expand_km(v: str) -> str:
    m = re.match(r'^([\d,\.]+)\s*([KkMm])?', v.strip())
    if not m:
        return v
    num = float(m.group(1).replace(',', ''))
    suf = (m.group(2) or "").upper()
    if suf == 'K':
        return str(int(num * 1_000))
    if suf == 'M':
        return str(int(num * 1_000_000))
    return str(int(num))


# ── AI helpers ────────────────────────────────────────────────────────────────

def _gemini_infer(prompt: str, gemini_key: str) -> dict | None:
    if not gemini_key:
        return None
    for model in ("gemini-1.5-flash", "gemini-2.0-flash"):
        try:
            r = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}",
                headers={"Content-Type": "application/json"},
                json={"contents": [{"parts": [{"text": prompt}]}],
                      "generationConfig": {"temperature": 0.1, "maxOutputTokens": 150}},
                timeout=15,
            )
            if r.status_code == 200:
                raw = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                m = re.search(r'\{.*\}', raw, re.DOTALL)
                if m:
                    return json.loads(m.group(0))
            if r.status_code == 429:
                return None  # quota exhausted
        except Exception:
            continue
    return None


def _groq_infer(prompt: str, groq_key: str) -> dict | None:
    if not groq_key:
        return None
    try:
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "temperature": 0.1, "max_tokens": 150,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=15,
        )
        if r.status_code == 200:
            raw = r.json()["choices"][0]["message"]["content"].strip()
            m = re.search(r'\{.*\}', raw, re.DOTALL)
            if m:
                return json.loads(m.group(0))
    except Exception:
        pass
    return None


def _ai_infer(prompt: str, gemini_key: str, groq_key: str) -> tuple[dict | None, str]:
    """Try Gemini first, fall back to Groq. Returns (result_dict, model_name)."""
    r = _gemini_infer(prompt, gemini_key)
    if r is not None:
        return r, "gemini"
    r = _groq_infer(prompt, groq_key)
    if r is not None:
        return r, "groq"
    return None, "none"


# ── Field workers ─────────────────────────────────────────────────────────────

def fill_industry(company_name: str, ev: dict, gemini_key: str = "", groq_key: str = "") -> dict:
    """
    Retry chain: website_data → linkedin_page → proxycurl → search_snippet → ai_inference
    """
    # website_data rarely has explicit industry; skip to LinkedIn
    li = ev.get("linkedin") or {}
    if _valid_industry(li.get("industry")):
        return _result(li["industry"], "linkedin_page")

    pc = ev.get("proxycurl") or {}
    if _valid_industry(pc.get("industry")):
        return _result(pc["industry"], "proxycurl")

    # DDGS snippet doesn't reliably carry industry — skip to AI
    desc = ev.get("description") or ""
    if len(desc) < 10:
        return _NOT_FOUND

    prompt = (
        f'Company: {company_name}\nContext: {desc[:400]}\n\n'
        'What industry does this company operate in? Choose the most specific applicable label.\n'
        'JSON only: {"industry":"..."}\nNull if genuinely unknown.'
    )
    result, model = _ai_infer(prompt, gemini_key, groq_key)
    if result and _valid_industry(result.get("industry")):
        return _ai_result(str(result["industry"]), model)

    return _NOT_FOUND


def fill_headquarters(company_name: str, ev: dict, gemini_key: str = "", groq_key: str = "") -> dict:
    """
    Retry chain: website_data → linkedin_page → proxycurl → desc_mining → ai_inference
    """
    ws = ev.get("website_data") or {}
    if ws.get("location") and _valid_hq(ws["location"]):
        return _result(ws["location"], "website")

    snip = ev.get("ddgs_snippet") or {}
    if _valid_hq(snip.get("headquarters")):
        return _result(snip["headquarters"], "search_snippet")

    li = ev.get("linkedin") or {}
    if _valid_hq(li.get("location")):
        return _result(li["location"], "linkedin_page")

    pc = ev.get("proxycurl") or {}
    if pc.get("hq"):
        hq = pc["hq"]
        parts = [hq.get("city"), hq.get("state"), hq.get("country")]
        hq_str = ", ".join(p for p in parts if p)
        if _valid_hq(hq_str):
            return _result(hq_str, "proxycurl")

    # Mine description for HQ patterns
    desc = ev.get("description") or ""
    m = re.search(
        r'(?:based in|headquartered? in|located in|offices? in)'
        r'\s*([A-Z][a-zA-Z\s]{3,40}?)(?:[,.]|\s+and\s|\s+with\s|$)',
        desc, re.I,
    )
    if m and _valid_hq(m.group(1).strip()):
        return {"value": m.group(1).strip(), "confidence": CONF["desc_mining"],
                "source": "desc_mining", "status": "inferred"}

    if len(desc) < 10:
        return _NOT_FOUND

    prompt = (
        f'Company: {company_name}\nContext: {desc[:400]}\n\n'
        'Where is this company headquartered? Format as "City, Country".\n'
        'JSON only: {"headquarters":"..."}\nNull if genuinely unknown.'
    )
    result, model = _ai_infer(prompt, gemini_key, groq_key)
    if result and _valid_hq(result.get("headquarters")):
        return _ai_result(str(result["headquarters"]), model)

    return _NOT_FOUND


def fill_employees(company_name: str, ev: dict) -> dict:
    """
    Retry chain: linkedin_page → proxycurl → search_snippet → desc_mining → not_public
    (no AI — employee count is factual, AI guesses are unreliable)
    """
    li = ev.get("linkedin") or {}
    sv = re.sub(r'\s*employees?\b.*', '', str(li.get("employee_count") or ""), flags=re.I).strip().replace(',', '').replace(' ', '')
    if _valid_size(sv):
        return _result(sv, "linkedin_page")

    pc = ev.get("proxycurl") or {}
    pc_size = str(pc.get("company_size_on_linkedin") or "").strip().replace(',', '').replace(' ', '')
    if _valid_size(pc_size):
        return _result(pc_size, "proxycurl")

    snip = ev.get("ddgs_snippet") or {}
    ss = re.sub(r'\s*employees?\b.*', '', str(snip.get("employee_count") or ""), flags=re.I).strip().replace(',', '').replace(' ', '')
    if _valid_size(ss):
        return _result(ss, "search_snippet")

    # Description mining for exact counts
    desc = ev.get("description") or ""
    m = re.search(r'(\d[\d,]+)\s+employees?', desc, re.I)
    if m and '-' not in m.group(1):
        _val = m.group(1).replace(",", "")
        # Reject bare year-like values (e.g. "in 2016 employees")
        if not (_val.isdigit() and len(_val) == 4 and 1900 <= int(_val) <= 2099):
            return {"value": _val, "confidence": CONF["desc_mining"],
                    "source": "desc_mining", "status": "inferred"}

    return _NOT_FOUND


def fill_founded(company_name: str, ev: dict, gemini_key: str = "", groq_key: str = "") -> dict:
    """
    Retry chain: linkedin_page → proxycurl → search_snippet → ai_inference
    """
    li = ev.get("linkedin") or {}
    yr = _valid_year(li.get("founded"))
    if yr:
        return _result(yr, "linkedin_page")

    pc = ev.get("proxycurl") or {}
    yr = _valid_year(pc.get("founded_year"))
    if yr:
        return _result(yr, "proxycurl")

    desc = ev.get("description") or ""
    if len(desc) < 10:
        return _NOT_FOUND

    prompt = (
        f'Company: {company_name}\nContext: {desc[:400]}\n\n'
        'What year was this company founded? 4-digit year only.\n'
        'JSON only: {"founded":"2018"}\nNull if genuinely unknown.'
    )
    result, model = _ai_infer(prompt, gemini_key, groq_key)
    if result:
        yr = _valid_year(result.get("founded"))
        if yr:
            return _ai_result(yr, model)

    return _NOT_FOUND


def fill_description(company_name: str, ev: dict) -> dict:
    """
    Retry chain: website_data → linkedin_page → proxycurl
    (no AI — we don't want AI-hallucinated company descriptions)
    """
    BAD_PREFIXES = ('search', 'find', 'directory', 'list of', 'yellow pages')

    def _desc_ok(d: str) -> bool:
        if not d or len(d.strip()) < 30:
            return False
        dl = d.lower()
        return not any(dl.startswith(p) for p in BAD_PREFIXES)

    ws = ev.get("website_data") or {}
    for key in ("meta_description", "first_para", "hero"):
        d = _clean_description(str(ws.get(key) or "")[:400].strip())
        if _desc_ok(d):
            return _result(d, "website")

    li = ev.get("linkedin") or {}
    li_desc = _clean_description(li.get("description") or "")
    if _desc_ok(li_desc):
        return _result(li_desc, "linkedin_page")

    pc = ev.get("proxycurl") or {}
    pc_desc = _clean_description(pc.get("description") or "")
    if _desc_ok(pc_desc):
        return _result(pc_desc, "proxycurl")

    return _NOT_FOUND


def fill_specialties(company_name: str, ev: dict, gemini_key: str = "", groq_key: str = "") -> dict:
    """
    Retry chain: website_data → linkedin_page → proxycurl → ai_inference
    """
    li = ev.get("linkedin") or {}
    if li.get("specialties") and len(str(li["specialties"])) > 5:
        return _result(str(li["specialties"]), "linkedin_page")

    pc = ev.get("proxycurl") or {}
    if pc.get("specialities"):
        sp = pc["specialities"]
        val = ", ".join(str(s) for s in sp) if isinstance(sp, list) else str(sp)
        if len(val) > 5:
            return _result(val, "proxycurl")

    ws = ev.get("website_data") or {}
    if ws.get("specialties") and len(str(ws["specialties"])) > 5:
        return _result(str(ws["specialties"]), "website")

    desc = ev.get("description") or ""
    if len(desc) < 10:
        return _NOT_FOUND

    prompt = (
        f'Company: {company_name}\nContext: {desc[:400]}\n\n'
        'List 3-5 specific capability areas this company specialises in. '
        'Avoid generic terms like "software" or "AI".\n'
        'JSON only: {"specialties":"area1, area2, area3"}\nNull if genuinely unknown.'
    )
    result, model = _ai_infer(prompt, gemini_key, groq_key)
    if result and result.get("specialties") not in (None, "null"):
        return _ai_result(str(result["specialties"]), model)

    return _NOT_FOUND


def fill_company_type_ai(company_name: str, ev: dict, gemini_key: str = "", groq_key: str = "") -> dict:
    """
    AI-only fallback for company_type when rule classifier didn't fire.
    Used when website_data was unavailable (no website found).
    """
    desc = ev.get("description") or ""
    if len(desc) < 10:
        return _NOT_FOUND

    prompt = (
        f'Company: {company_name}\nContext: {desc[:400]}\n\n'
        'Is this company a "Product" company (owns software with subscription pricing or '
        'a marketplace with transaction fees) or a "Service" company (consulting, agency, '
        'staffing, non-profit, lending/capital provider)? '
        'IMPORTANT: login/dashboard/sign-up do NOT make it Product. '
        'A lending platform, crowdfunding site, or foundation is Service.\n'
        'JSON only: {"company_type":"Product"} or {"company_type":"Service"}'
    )
    result, model = _ai_infer(prompt, gemini_key, groq_key)
    if result and result.get("company_type") in ("Product", "Service", "Hybrid"):
        return _ai_result(result["company_type"], model)

    return _NOT_FOUND


# ── LinkedIn URL worker ───────────────────────────────────────────────────────

_SLUG_GENERIC = {'pvt', 'ltd', 'private', 'limited', 'technologies', 'tech',
                 'solutions', 'india', 'innovations', 'consultancy', 'services',
                 'inc', 'corp', 'llc', 'the', 'and', 'for', 'group', 'company'}


def _slug_matches(company_name: str, linkedin_url: str) -> bool:
    """True if the LinkedIn URL slug plausibly belongs to this company."""
    m = re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', linkedin_url)
    if not m:
        return False
    slug = m.group(1).lower().replace('-', ' ').replace('_', ' ')
    clean = re.sub(r'[^a-z0-9 ]', ' ', company_name.lower())
    words = [w for w in clean.split() if len(w) > 2 and w not in _SLUG_GENERIC]
    if not words:
        return True  # generic name — accept anything
    return any(w in slug for w in words[:4])


def fill_linkedin_url(company_name: str, ev: dict) -> dict:
    """
    Retry chain: website_data → ddgs_snippet (confirmed or candidate) → linkedin_worker discovery
    """
    # Source 1: LinkedIn URL found in company website HTML (highest confidence)
    ws = ev.get("website_data") or {}
    li_from_site = str(ws.get("linkedin_url") or "")
    if li_from_site and "linkedin.com/company/" in li_from_site:
        return {"value": li_from_site, "confidence": CONF["website"], "source": "website", "status": "verified"}

    # Source 2: LinkedIn URL or candidate from DDGS snippet
    snip = ev.get("ddgs_snippet") or {}
    for key in ("linkedin_url", "linkedin_url_candidate"):
        li_from_snip = str(snip.get(key) or "")
        if li_from_snip and "linkedin.com/company/" in li_from_snip:
            if _slug_matches(company_name, li_from_snip):
                return {"value": li_from_snip, "confidence": CONF["search_snippet"],
                        "source": "search_snippet", "status": "verified"}

    # Source 3: linkedin_worker multi-query discovery (uses cleaned company name)
    try:
        from .linkedin_worker import discover_linkedin_url
        website = (ws.get("_base_url") or ws.get("url") or "")
        found_url = discover_linkedin_url(company_name, website)
        if found_url:
            return {"value": found_url, "confidence": CONF["search_snippet"],
                    "source": "search_snippet", "status": "verified"}
    except Exception:
        pass

    return _NOT_FOUND


# ── About/Careers subpage helper ──────────────────────────────────────────────

def _fetch_page_text(url: str) -> str:
    """Lightweight HTML fetch → plain text (strips scripts/nav/footer). Max 3000 chars."""
    try:
        from html.parser import HTMLParser

        class _Stripper(HTMLParser):
            def __init__(self):
                super().__init__()
                self.parts = []
                self._skip = False

            def handle_starttag(self, tag, attrs):
                if tag in ('script', 'style', 'nav', 'footer', 'header'):
                    self._skip = True

            def handle_endtag(self, tag):
                if tag in ('script', 'style', 'nav', 'footer', 'header'):
                    self._skip = False

            def handle_data(self, data):
                if not self._skip:
                    d = data.strip()
                    if d:
                        self.parts.append(d)

        resp = requests.get(url, timeout=8, allow_redirects=True,
                            headers={"User-Agent": "Mozilla/5.0 (compatible; SonarBot/1.0)"})
        if resp.status_code != 200:
            return ""
        parser = _Stripper()
        parser.feed(resp.text)
        return ' '.join(parser.parts)[:3000]
    except Exception:
        return ""


def run_gap_fill(
    company_name: str,
    ev: dict,
    update_data: dict,
    company: dict,
    gemini_key: str,
    groq_key: str,
) -> dict:
    """
    First-pass field workers. Only fills fields that are still missing.
    Returns enrichment_meta dict.
    """
    meta = {}

    def _apply(field, worker_fn, *args):
        """Run worker, write to update_data if field still missing, track in meta."""
        already_filled = bool(update_data.get(field) or company.get(field))
        if already_filled:
            return
        result = worker_fn(*args)
        if result["value"] is not None:
            update_data[field] = result["value"]
        meta[field] = {
            "confidence": result["confidence"],
            "source": result["source"],
            "status": result["status"],
        }

    _apply("industry",     fill_industry,      company_name, ev, gemini_key, groq_key)
    _apply("headquarters", fill_headquarters,   company_name, ev, gemini_key, groq_key)
    _apply("size",         fill_employees,      company_name, ev)
    _apply("founded",      fill_founded,        company_name, ev, gemini_key, groq_key)
    _apply("description",  fill_description,    company_name, ev)
    _apply("specialties",  fill_specialties,    company_name, ev, gemini_key, groq_key)
    _apply("linkedin_url", fill_linkedin_url,   company_name, ev)

    # company_type: only AI fallback — rule classifier already ran
    if not update_data.get("company_type") and not company.get("company_type"):
        result = fill_company_type_ai(company_name, ev, gemini_key, groq_key)
        if result["value"]:
            update_data["company_type"] = result["value"]
            update_data["is_saas"] = False  # AI-set type without subscription evidence = not SaaS
        meta["company_type"] = {
            "confidence": result["confidence"],
            "source": result["source"],
            "status": result["status"],
        }

    return meta


# ── Second-pass resolver ──────────────────────────────────────────────────────

def _ddgs_snippets(query: str, max_results: int = 3) -> str:
    """Run DDGS text search, return combined snippet text (max 600 chars)."""
    try:
        from ddgs import DDGS
        results = DDGS().text(query, max_results=max_results)
        if not results:
            return ""
        return " ".join(r["body"] for r in results if r.get("body"))[:600]
    except Exception:
        return ""


def run_second_pass(
    company_name: str,
    ev: dict,
    update_data: dict,
    company: dict,
    gemini_key: str,
    groq_key: str,
) -> dict:
    """
    Second-pass resolver: for fields still null after first-pass workers, run
    targeted DDGS searches per missing field then batch-extract with AI.
    Only fires when at least one core field remains unfilled.
    """
    meta = {}

    def _still_missing(field):
        return not update_data.get(field) and not company.get(field)

    missing = [f for f in ["industry", "headquarters", "size", "founded", "specialties"]
               if _still_missing(f)]
    if not missing:
        return meta

    desc = update_data.get("description") or company.get("description") or ev.get("description") or ""

    # ── About/Careers subpage collection ─────────────────────────────────────
    # Fetch /about and /careers pages for additional HQ/founded/employee evidence
    _website = (ev.get("website_data") or {}).get("_base_url") or company.get("website") or ""
    if _website:
        if not _website.startswith("http"):
            _website = "https://" + _website
        _base = _website.rstrip("/")
        _about_text = ""
        _careers_text = ""
        for _path in ("/about", "/about-us", "/company/about"):
            _t = _fetch_page_text(_base + _path)
            if len(_t) > 200:
                _about_text = _t
                break
        if any(_still_missing(f) for f in ["size"]):
            for _path in ("/careers", "/jobs", "/join-us", "/work-with-us"):
                _t = _fetch_page_text(_base + _path)
                if len(_t) > 200:
                    _careers_text = _t
                    break
        if _about_text:
            print(f"[second_pass] {company_name} about page: {len(_about_text)} chars", flush=True)
        if _careers_text:
            print(f"[second_pass] {company_name} careers page: {len(_careers_text)} chars", flush=True)
    else:
        _about_text = ""
        _careers_text = ""

    # Targeted DDGS query per missing field
    _QUERIES = {
        "industry":     f'"{company_name}" industry sector what they do',
        "headquarters": f'"{company_name}" headquarters office location city country',
        "size":         f'"{company_name}" number of employees team size headcount',
        "founded":      f'"{company_name}" founded year established history',
        "specialties":  f'"{company_name}" products services core capabilities',
    }
    snippets = {}
    for field in missing:
        snip = _ddgs_snippets(_QUERIES[field])
        if snip:
            snippets[field] = snip
            print(f"[second_pass] {company_name} snip for {field}: {snip[:80]}", flush=True)

    if not snippets and len(desc) < 20 and not _about_text and not _careers_text:
        return meta

    # Build context for AI batch call
    ctx_parts = []
    if desc:
        ctx_parts.append(f"Description: {desc[:400]}")
    for field, snip in snippets.items():
        ctx_parts.append(f"Search ({field}): {snip}")
    if _about_text:
        ctx_parts.append(f"About page: {_about_text[:600]}")
    if _careers_text:
        ctx_parts.append(f"Careers page: {_careers_text[:400]}")
    context = "\n".join(ctx_parts)

    fields_spec = []
    if _still_missing("industry"):
        fields_spec.append('- industry: specific label e.g. "HR Tech", "Cybersecurity", "E-commerce"')
    if _still_missing("headquarters"):
        fields_spec.append('- headquarters: "City, Country" format')
    if _still_missing("size"):
        fields_spec.append('- employees: headcount range like "51-200" or integer')
    if _still_missing("founded"):
        fields_spec.append('- founded: 4-digit year')
    if _still_missing("specialties"):
        fields_spec.append('- specialties: 3-5 comma-separated capability areas (no generic terms)')

    prompt = (
        f"Company: {company_name}\n{context}\n\n"
        "Extract these fields strictly from the evidence above. Do not fabricate.\n"
        + "\n".join(fields_spec)
        + '\n\nJSON only, null for unknown:\n'
          '{"industry":null,"headquarters":null,"employees":null,"founded":null,"specialties":null}'
    )

    result, model = _ai_infer(prompt, gemini_key, groq_key)
    if not result:
        return meta

    _FIELD_MAP = {
        "industry":    ("industry",    _valid_industry),
        "headquarters": ("headquarters", _valid_hq),
        "employees":   ("size",        _valid_size),
        "founded":     ("founded",     _valid_year),
        "specialties": ("specialties", lambda v: str(v) if v and len(str(v)) > 5 else None),
    }
    for res_key, (db_field, validator) in _FIELD_MAP.items():
        if not _still_missing(db_field):
            continue
        raw = result.get(res_key)
        if raw is None or str(raw).lower() in ("null", "none", ""):
            continue
        val = validator(str(raw))
        if val:
            update_data[db_field] = val
            meta[db_field] = {
                "confidence": CONF["ai_inference"],
                "source": f"second_pass_{model}",
                "status": "inferred",
            }
            print(f"[second_pass] {company_name} {db_field}={val} via {model}", flush=True)

    return meta


# ── Terminal state finaliser ──────────────────────────────────────────────────

_CORE_FIELDS = ["industry", "headquarters", "size", "founded", "description",
                "specialties", "company_type", "linkedin_url"]


def finalize_meta(meta: dict, update_data: dict, company: dict) -> dict:
    """
    Stamp every core field with a terminal state in enrichment_meta.

    After both passes, every field must be one of:
      verified / inferred   — value found this session (already in meta from _track or workers)
      pre_existing          — value came from a prior enrichment run, not re-verified
      not_public            — all collectors exhausted, field genuinely unavailable

    This ensures the UI can distinguish "blank because we tried" from
    "blank because we never looked".
    """
    for field in _CORE_FIELDS:
        if field in meta:
            continue  # already tracked this session
        has_value = bool(update_data.get(field) or company.get(field))
        meta[field] = {
            "confidence": 0,
            "source": "pre_existing" if has_value else "exhausted",
            "status": "verified" if has_value else "not_public",
        }
    return meta
