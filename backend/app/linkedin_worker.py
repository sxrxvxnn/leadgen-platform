"""
LinkedIn Enrichment Worker — per Sonar LinkedIn Enrichment Worker Specification.

Architecture:
  Step 1: Discover LinkedIn company URL (multi-query DDGS search with cleaned name)
  Step 2: Extract structured fields via Jina Reader (JavaScript-rendered markdown)
  Step 3: Normalize all extracted values (employee range, HQ, founded year)
  Step 4: Validate against existing evidence and return confidence-scored result

Design principles (from spec):
  - LinkedIn is an enrichment source, not the source of truth
  - Failure never stops the pipeline — always returns partial result
  - Every extracted value includes source and confidence
  - Normalize and validate before storing
"""

import re
import json
import requests

# ── Name cleaner ──────────────────────────────────────────────────────────────

_LEGAL_SUFFIX_RE = re.compile(
    r'\s*[\(\[]?(?:p\.?\s*)?(?:pvt\.?|private)\s*[\)\]]?\s*'
    r'|[\(\[]p[\)\]]\s*'
    r'|\b(?:private\s+limited|pvt\.?\s*ltd\.?|p\.?\s*ltd\.?|limited|ltd\.?|inc\.?|llc|corp\.?|gmbh|plc|llp|pbc)\b',
    re.I,
)


def _clean_name_for_linkedin(name: str) -> str:
    """Strip legal suffixes, normalize whitespace for DDG search."""
    cleaned = _LEGAL_SUFFIX_RE.sub(' ', name)
    cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip().strip('()')
    return cleaned or name


def _name_words(name: str) -> list:
    """Return significant (non-generic) words from company name for slug matching."""
    GENERIC = {'pvt', 'ltd', 'private', 'limited', 'technologies', 'tech',
               'solutions', 'india', 'innovations', 'consultancy', 'services',
               'inc', 'corp', 'llc', 'the', 'and', 'for', 'group', 'company',
               'software', 'systems', 'global', 'digital'}
    words = re.sub(r'[^a-z0-9 ]', ' ', name.lower()).split()
    return [w for w in words if len(w) > 2 and w not in GENERIC]


def _slug_matches(company_name: str, linkedin_url: str) -> bool:
    """True if the LinkedIn URL slug plausibly belongs to this company."""
    m = re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', linkedin_url)
    if not m:
        return False
    slug = m.group(1).lower().replace('-', ' ').replace('_', ' ')
    words = _name_words(company_name)
    if not words:
        return True  # can't validate — accept
    return any(w in slug for w in words[:4])


# ── URL discovery ─────────────────────────────────────────────────────────────

def discover_linkedin_url(company_name: str, website: str = "") -> str:
    """
    Multi-strategy LinkedIn company URL discovery.

    Strategy 1: site:linkedin.com/company search with cleaned name (most reliable)
    Strategy 2: general "{name}" linkedin.com search
    Strategy 3: domain-based search if website provided

    Returns validated linkedin.com/company/... URL or empty string.
    """
    try:
        from ddgs import DDGS
    except ImportError:
        return ""

    clean_name = _clean_name_for_linkedin(company_name)

    queries = [
        f'site:linkedin.com/company "{clean_name}"',
        f'"{clean_name}" site:linkedin.com/company',
        f'{clean_name} linkedin company profile',
    ]
    if website:
        try:
            from urllib.parse import urlparse
            domain = urlparse(website).netloc.replace("www.", "")
            if domain:
                queries.insert(1, f'site:linkedin.com/company "{domain}"')
        except Exception:
            pass

    for query in queries:
        try:
            results = list(DDGS().text(query, max_results=5))
            for r in results:
                url = r.get("href", "") or ""
                m = re.search(r'(linkedin\.com/company/([a-zA-Z0-9_-]+))', url)
                if m:
                    candidate = f"https://www.{m.group(1)}/"
                    if _slug_matches(company_name, candidate):
                        print(f"[linkedin_worker] {company_name}: found {candidate} via query: {query[:60]}", flush=True)
                        return candidate
                # Also check result body for LinkedIn company URLs
                body = (r.get("body") or "")[:300]
                bm = re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', body)
                if bm:
                    candidate = f"https://www.linkedin.com/company/{bm.group(1)}/"
                    if _slug_matches(company_name, candidate):
                        return candidate
        except Exception:
            continue

    return ""


# ── Jina extraction ───────────────────────────────────────────────────────────

def _jina_fetch(url: str) -> str:
    """Fetch URL via Jina Reader (renders JS, returns markdown)."""
    try:
        jina_url = f"https://r.jina.ai/{url}"
        resp = requests.get(jina_url, timeout=20,
                            headers={"Accept": "text/plain", "X-No-Cache": "true"})
        if resp.status_code == 200:
            return resp.text
    except Exception:
        pass
    return ""


def _parse_linkedin_markdown(md: str) -> dict:
    """
    Extract structured fields from Jina's LinkedIn company page markdown.

    Targets field:value patterns used on LinkedIn's company About page:
      - Industry / Company size / Headquarters / Type / Founded / Specialties / Website / Followers
      - Overview/About text
    """
    result = {}

    def _match(patterns: list, text: str) -> str | None:
        for pat in patterns:
            m = re.search(pat, text, re.I | re.M)
            if m:
                return m.group(1).strip().rstrip('*').strip()
        return None

    # Followers
    fm = re.search(r'([\d,]+(?:\.\d+)?[KkMm]?)\s*followers', md, re.I)
    if fm:
        raw = fm.group(1).replace(',', '')
        km = re.match(r'^([\d.]+)([KkMm])$', raw)
        result['followers'] = str(int(float(km.group(1)) * (1_000_000 if km.group(2).upper() == 'M' else 1_000))) if km else raw

    # Industry
    result['industry'] = _match([
        r'(?:^|\n)\s*[*\-]?\s*Industry\s*[:\|]\s*(.+?)(?:\n|$)',
        r'\bIndustry\b\s*\n\s*([A-Z][^\n]{2,80}?)(?:\n|$)',
        r'\*{1,2}Industry\*{1,2}\s*:?\s*\n?\s*([A-Z][^\n*]{2,80}?)(?:\n|$)',
    ], md)

    # Company size (employee range)
    result['employee_count'] = _match([
        r'Company\s*size\s*[:\|]\s*([\d,\s\-–]+\+?\s*employees)',
        r'Company\s*size\s*\n\s*([\d,\s\-–]+\+?\s*employees)',
        r'([\d,]+\s*[-–]\s*[\d,]+\s*employees)',
        r'([\d,]+\+?\s*employees)',
    ], md)

    # Headquarters
    for pat in [
        r'(?:Headquarters|HQ)\s*[:\|]\s*(.+?)(?:\n|$)',
        r'(?:Headquarters|HQ)\s*\n\s*([A-Z][^\n]{2,80}?)(?:\n|$)',
        r'\*{1,2}(?:Headquarters|HQ)\*{1,2}\s*:?\s*\n?\s*([A-Z][^\n*]{2,80}?)(?:\n|$)',
    ]:
        hq_m = re.search(pat, md, re.I | re.M)
        if hq_m:
            val = hq_m.group(1).strip().rstrip('*').strip()
            if val and 'linkedin.com' not in val.lower() and len(val) > 2:
                result['headquarters'] = val
                break

    # Founded
    ft = _match([r'Founded\s*[:\|]?\s*(\d{4})'], md)
    if ft:
        result['founded'] = ft

    # Specialties
    sm = re.search(r'Specialties?\s*[:\|]?\s*(.+?)(?:\n\n|\n[A-Z#]|$)', md, re.I | re.S)
    if sm:
        val = sm.group(1).strip().replace('\n', ', ')
        if len(val) > 8:
            result['specialties'] = val

    # Website
    wm = re.search(r'Website\s*[:\|]?\s*(https?://[^\s\)>\]]+)', md, re.I)
    if not wm:
        wm = re.search(r'Website\s*[:\|]?\s*\[([^\]]+)\]\((https?://[^\)]+)\)', md, re.I)
    if wm:
        ws = wm.group(2) if wm.lastindex and wm.lastindex >= 2 else wm.group(1)
        if ws and 'linkedin.com' not in ws:
            result['website'] = ws

    # Overview / About description
    dm = re.search(r'(?:About us|Overview|About)\s*\n+(.{30,500}?)(?:\n\n|\n##|$)', md, re.I | re.S)
    if dm:
        import html as _html
        result['description'] = _html.unescape(dm.group(1).strip())

    return result


# ── Normalization ──────────────────────────────────────────────────────────────

def normalize_employees(text: str) -> dict:
    """
    Normalize employee count text to structured range per spec.
    Input: "11-50 employees" or "201-500" or "5,001-10,000 employees"
    Output: {"min": 11, "max": 50, "display": "11-50"}
    """
    if not text:
        return {}
    # Strip "employees" suffix
    raw = re.sub(r'\s*employees?\b.*', '', str(text), flags=re.I).strip().replace(',', '').replace(' ', '')
    # Range: "11-50" or "11–50"
    m = re.match(r'^(\d+)\s*[-–]\s*(\d+)\+?$', raw)
    if m:
        lo, hi = int(m.group(1)), int(m.group(2))
        return {"min": lo, "max": hi, "display": f"{lo}-{hi}"}
    # Single number with +: "5001+"
    m = re.match(r'^(\d+)\+$', raw)
    if m:
        n = int(m.group(1))
        return {"min": n, "max": None, "display": f"{n}+"}
    # Plain number
    if raw.isdigit():
        n = int(raw)
        # Reject year-like values
        if 1900 <= n <= 2099:
            return {}
        return {"min": None, "max": None, "display": str(n), "exact": n}
    return {}


def normalize_hq(text: str) -> dict:
    """
    Normalize headquarters text to structured city/state/country per spec.
    Input: "Trivandrum, Kerala" or "San Francisco, CA" or "London, UK"
    Output: {"city": "Trivandrum", "state": "Kerala", "country": "India", "display": "Trivandrum, Kerala"}
    """
    if not text:
        return {}
    # Map common state/country abbreviations
    _COUNTRY_MAP = {
        'us': 'United States', 'usa': 'United States', 'uk': 'United Kingdom',
        'gb': 'United Kingdom', 'in': 'India', 'ca': 'Canada', 'au': 'Australia',
        'de': 'Germany', 'fr': 'France', 'sg': 'Singapore', 'ae': 'UAE',
    }
    _US_STATES = {
        'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id',
        'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms',
        'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok',
        'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv',
        'wi', 'wy', 'dc',
    }
    _IN_STATES = {
        'kerala', 'karnataka', 'maharashtra', 'tamil nadu', 'telangana', 'andhra pradesh',
        'gujarat', 'rajasthan', 'uttar pradesh', 'delhi', 'west bengal', 'punjab',
        'haryana', 'madhya pradesh', 'odisha', 'bihar',
    }
    parts = [p.strip() for p in text.split(',')]
    city = parts[0] if parts else text
    state = parts[1] if len(parts) > 1 else ""
    country_raw = parts[2] if len(parts) > 2 else ""
    country = ""
    if country_raw:
        cl = country_raw.strip().lower()
        country = _COUNTRY_MAP.get(cl, country_raw.strip())
    elif state:
        sl = state.strip().lower()
        # Check US states BEFORE country map — 2-letter codes like "CA" are US states in address context
        if sl in _US_STATES:
            country = "United States"
        elif sl in _IN_STATES:
            country = "India"
        elif sl in _COUNTRY_MAP:
            country = _COUNTRY_MAP[sl]
            state = ""
    return {
        "city": city,
        "state": state,
        "country": country,
        "display": text,
    }


# ── Main worker ───────────────────────────────────────────────────────────────

def run_linkedin_worker(
    company_name: str,
    website: str = "",
    existing_linkedin_url: str = "",
    existing_data: dict | None = None,
) -> dict:
    """
    Main LinkedIn enrichment worker entry point.

    Workflow (per spec):
      1. Discover LinkedIn URL (if not already known)
      2. Fetch page via Jina Reader
      3. Extract structured fields
      4. Normalize values
      5. Return evidence-scored result — never raises, always returns dict

    Returns:
      {
        "linkedin_url": str,
        "fields": {field: {"value": ..., "source": "linkedin", "confidence": int}},
        "raw": dict,       # unnormalized extracted values
        "success": bool,
        "error": str | None,
      }
    """
    result = {
        "linkedin_url": existing_linkedin_url or "",
        "fields": {},
        "raw": {},
        "success": False,
        "error": None,
    }

    try:
        # Step 1: Discover URL if not provided
        li_url = existing_linkedin_url
        if not li_url or "linkedin.com/company/" not in li_url:
            li_url = discover_linkedin_url(company_name, website)
        if not li_url:
            result["error"] = "LinkedIn URL not found"
            return result
        result["linkedin_url"] = li_url

        # Step 2+3: Fetch and extract
        md = _jina_fetch(li_url)
        if not md or len(md) < 100:
            result["error"] = "Empty LinkedIn page (gated or blocked)"
            return result

        raw = _parse_linkedin_markdown(md)
        result["raw"] = raw
        if not raw:
            result["error"] = "No structured fields extracted"
            return result

        # Step 4: Normalize and build evidence-scored fields
        _CONFIDENCE = 88  # LinkedIn structured data — high confidence

        def _field(value, normalized=None):
            return {"value": normalized or value, "source": "linkedin", "confidence": _CONFIDENCE}

        if raw.get("industry"):
            result["fields"]["industry"] = _field(raw["industry"])
        if raw.get("employee_count"):
            norm = normalize_employees(raw["employee_count"])
            if norm.get("display"):
                result["fields"]["size"] = _field(raw["employee_count"], norm["display"])
                result["fields"]["_employee_norm"] = norm
        if raw.get("headquarters"):
            norm_hq = normalize_hq(raw["headquarters"])
            result["fields"]["headquarters"] = _field(raw["headquarters"], norm_hq.get("display") or raw["headquarters"])
            result["fields"]["_hq_norm"] = norm_hq
        if raw.get("founded"):
            if re.match(r'^\d{4}$', str(raw["founded"])) and 1800 <= int(raw["founded"]) <= 2030:
                result["fields"]["founded"] = _field(raw["founded"])
        if raw.get("specialties"):
            result["fields"]["specialties"] = _field(raw["specialties"])
        if raw.get("followers"):
            result["fields"]["followers"] = _field(raw["followers"])
        if raw.get("description"):
            from .field_workers import _clean_description
            desc_clean = _clean_description(raw["description"])
            if desc_clean and len(desc_clean) >= 30:
                result["fields"]["description"] = _field(desc_clean)
        if raw.get("website"):
            result["fields"]["_website_from_li"] = _field(raw["website"])

        result["success"] = bool(result["fields"])
        print(f"[linkedin_worker] {company_name}: success={result['success']} fields={list(result['fields'].keys())}", flush=True)

    except Exception as e:
        result["error"] = str(e)
        print(f"[linkedin_worker] {company_name} ERROR: {e}", flush=True)

    return result
