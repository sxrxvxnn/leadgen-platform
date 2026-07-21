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
        return {"value": m.group(1).replace(",", ""), "confidence": CONF["desc_mining"],
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
        d = str(ws.get(key) or "")[:400].strip()
        if _desc_ok(d):
            return _result(d, "website")

    li = ev.get("linkedin") or {}
    if _desc_ok(li.get("description") or ""):
        return _result(li["description"], "linkedin_page")

    pc = ev.get("proxycurl") or {}
    if _desc_ok(pc.get("description") or ""):
        return _result(pc["description"], "proxycurl")

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


def run_gap_fill(
    company_name: str,
    ev: dict,
    update_data: dict,
    company: dict,
    gemini_key: str,
    groq_key: str,
) -> dict:
    """
    Main entry for field workers. Called after all evidence is gathered.
    Only fills fields that are still missing. Returns enrichment_meta dict.
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
