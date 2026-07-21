"""
People Intelligence Engine v2 — search-first candidate discovery + verification.

Architecture:
  Path A (Search Discovery): DDG queries → Gemini extracts candidates + source URLs
  Path B (Official Pages):   Firecrawl scrapes team/leadership pages → Gemini extracts people

Cross-reference: when a name appears in BOTH paths, confidence gets a +20 multi-source boost
and both source URLs are stored. Official page is treated as verification of the search candidate.
"""

import re
import json
import requests

_LEADERSHIP_PATHS = [
    "/team", "/our-team", "/leadership", "/about/team", "/people",
    "/management", "/founders", "/executive-team", "/board",
    "/about", "/about-us", "/who-we-are",
]

_SEARCH_QUERIES = [
    # LinkedIn-specific: result HREFs are profile URLs → direct linkedin_url extraction
    'site:linkedin.com/in "{name}" CEO OR founder OR CTO OR director OR president',
    # General leadership searches
    '"{name}" CEO OR CTO OR CFO OR founder OR "head of" OR president',
    '"{name}" leadership team executives',
    # Site-specific: about/team/leadership pages
    'site:{domain} executives OR leadership OR "our team" OR "meet the team"',
    # Press releases and news mentioning executives
    '"{name}" "press release" OR "appoints" OR "announces" executive director founder',
]

# Regex to pull linkedin.com/in/ profile URLs from markdown / snippets
_LI_PROFILE_RE = re.compile(r'https?://(?:www\.)?linkedin\.com/in/([a-zA-Z0-9_%-]+)/?')

# Confidence weights (additive)
_CONF_OFFICIAL_PAGE = 40    # found on company's own leadership/team/about page
_CONF_PRESS_RELEASE = 25    # found in press release / newsroom (future)
_CONF_MULTI_SOURCE  = 20    # name appears in BOTH search results AND official page
_CONF_SEARCH_ONLY   = 15    # found only in search snippets

_DEPT_MAP = {
    "ceo": "Executive", "chief executive": "Executive", "president": "Executive",
    "coo": "Executive", "chief operating": "Executive",
    "cfo": "Executive", "chief financial": "Executive", "treasurer": "Executive",
    "cto": "Engineering", "chief technology": "Engineering", "chief technical": "Engineering",
    "cpo": "Product", "chief product": "Product",
    "cmo": "Marketing", "chief marketing": "Marketing",
    "cso": "Sales", "chief sales": "Sales", "chief revenue": "Sales",
    "ciso": "Security", "chief information security": "Security",
    "cdo": "Data", "chief data": "Data",
    "vp engineering": "Engineering", "vp of engineering": "Engineering",
    "vp product": "Product", "vp of product": "Product",
    "vp sales": "Sales", "vp of sales": "Sales",
    "vp marketing": "Marketing", "vp of marketing": "Marketing",
    "head of engineering": "Engineering", "head of product": "Product",
    "head of sales": "Sales", "head of marketing": "Marketing",
    "head of finance": "Finance", "head of operations": "Operations",
    "head of data": "Data", "head of security": "Security",
    "head of legal": "Legal", "head of hr": "People", "head of people": "People",
    "director of engineering": "Engineering", "director of product": "Product",
    "director of sales": "Sales", "director of marketing": "Marketing",
    "co-founder": "Executive", "cofounder": "Executive", "founder": "Executive",
    "managing director": "Executive", "general partner": "Executive",
    "partner": "Executive",
    "engineer": "Engineering", "developer": "Engineering", "architect": "Engineering",
    "product manager": "Product", "product lead": "Product",
    "sales": "Sales", "account executive": "Sales", "business development": "Sales",
    "marketing": "Marketing", "growth": "Marketing",
    "finance": "Finance", "accounting": "Finance", "controller": "Finance",
    "operations": "Operations", "ops": "Operations",
    "legal": "Legal", "counsel": "Legal", "attorney": "Legal",
    "hr": "People", "people": "People", "talent": "People", "recruiting": "People",
    "data": "Data", "analytics": "Data", "scientist": "Data",
    "security": "Security", "infosec": "Security",
    "design": "Design", "designer": "Design", "ux": "Design", "ui": "Design",
    "customer success": "Customer Success", "customer support": "Customer Success",
}


def _classify_department(title: str) -> str:
    if not title:
        return "Other"
    t = title.lower()
    for kw, dept in _DEPT_MAP.items():
        if kw in t:
            return dept
    return "Other"


def _is_decision_maker(title: str) -> bool:
    if not title:
        return False
    t = title.lower()
    dm_keywords = [
        "ceo", "cto", "cfo", "coo", "cpo", "cmo", "cso", "ciso", "cdo",
        "chief", "president", "founder", "co-founder", "cofounder",
        "vp ", "v.p.", "vice president",
        "director", "head of", "managing director", "general partner", "partner",
        "principal",
    ]
    return any(kw in t for kw in dm_keywords)


def _normalize_name(name: str) -> str:
    return re.sub(r'\s+', ' ', name.strip().lower())


def _gemini_extract(prompt: str, gemini_key: str) -> list:
    """Call Gemini and parse a JSON array from the response. Retries once on 429."""
    import time as _time
    for attempt in range(2):
        try:
            resp = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.0, "maxOutputTokens": 1024},
                },
                timeout=20,
            )
            if resp.status_code == 429:
                if attempt == 0:
                    _time.sleep(5)
                    continue
                return []
            if resp.status_code != 200:
                print(f"[gemini_extract] HTTP {resp.status_code}: {resp.text[:200]}", flush=True)
                return []
            raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            m = re.search(r'\[.*\]', raw, re.DOTALL)
            if not m:
                return []
            items = json.loads(m.group(0))
            return items if isinstance(items, list) else []
        except Exception as e:
            print(f"[gemini_extract] exception: {e}", flush=True)
            return []
    return []


def _search_candidates(company_name: str, domain: str, gemini_key: str) -> list:
    """
    Path A: run DDG leadership queries, feed all snippets to Gemini in one call.
    LinkedIn-specific query produces HREFs that ARE profile URLs — captured directly.
    Returns list of {name, title, linkedin_url, source_urls, ...}.
    """
    try:
        from .company_prefill import _web_search
    except Exception:
        return []

    snippets = []
    # Map href → linkedin_url when the result itself is a linkedin.com/in page
    href_linkedin_map: dict = {}

    for q_template in _SEARCH_QUERIES:
        q = q_template.format(name=company_name, domain=domain)
        try:
            for r in _web_search(q, count=5):
                url = r.get("href", "")
                title = r.get("title", "")
                body = (r.get("body") or "")[:200]
                if url and (title or body):
                    snippets.append(f"[{url}] {title} — {body}")
                # When the result href is a LinkedIn profile, cache it
                if url and "linkedin.com/in/" in url:
                    href_linkedin_map[url] = url
                # Also scan body for embedded LinkedIn profile URLs
                if body:
                    for li_url in _LI_PROFILE_RE.findall(body):
                        full = f"https://www.linkedin.com/in/{li_url}/"
                        href_linkedin_map[full] = full
        except Exception:
            continue

    if not snippets:
        return []

    combined = "\n".join(snippets[:20])
    prompt = (
        f"Company: {company_name} (domain: {domain})\n"
        f"Web search snippets:\n{combined}\n\n"
        "From these search results, extract all named people mentioned as working AT this company "
        "with their job titles. Note the source URL where each person was found.\n"
        "If the source URL is a linkedin.com/in/ profile, include it as linkedin_url.\n"
        "Only include people confirmed to work at this specific company.\n"
        'Return ONLY a JSON array: [{"name":"Full Name","title":"Job Title","url":"source_url","linkedin_url":"https://linkedin.com/in/...or empty"}, ...]\n'
        "Max 15 people. No markdown, no explanation."
    )
    items = _gemini_extract(prompt, gemini_key)
    candidates = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = (item.get("name") or "").strip()
        title = (item.get("title") or "").strip()
        url = (item.get("url") or "").strip()
        li_url = (item.get("linkedin_url") or "").strip()

        if not name or len(name) < 3:
            continue

        # Resolve LinkedIn URL: use Gemini's answer, or check if source URL is a profile
        if not li_url and url and "linkedin.com/in/" in url:
            li_url = url
        # Clean up the LinkedIn URL
        if li_url and "linkedin.com/in/" not in li_url:
            li_url = ""

        candidates.append({
            "name": name,
            "title": title,
            "department": _classify_department(title),
            "email": "",
            "linkedin_url": li_url,
            "is_decision_maker": _is_decision_maker(title),
            "source_urls": [url] if url else [],
            "_search_confirmed": True,
        })
    return candidates


def _scrape_official_pages(base: str, company_name: str, gemini_key: str) -> list:
    """
    Path B: Firecrawl scrapes official team/leadership pages, Gemini extracts people.
    Also extracts linkedin.com/in/ URLs directly from page markdown (Firecrawl preserves links).
    Hard-capped at 2 pages to keep enrichment fast.
    """
    from .enrichment import _fc_scrape

    all_people = []
    pages_tried = 0

    for path in _LEADERSHIP_PATHS:
        if pages_tried >= 2:  # max 2 pages — keeps auto-discover under ~30s total
            break
        url = base + path
        try:
            md = _fc_scrape(url, wait_ms=1500)  # reduced from 2500ms
        except Exception:
            md = ""
        if not md or len(md) < 100:
            continue
        pages_tried += 1

        # Pre-extract all LinkedIn profile URLs present in the markdown
        page_li_urls: dict = {}  # slug → full url
        for slug in _LI_PROFILE_RE.findall(md):
            page_li_urls[slug.lower()] = f"https://www.linkedin.com/in/{slug}/"

        prompt = (
            f"Company: {company_name}\n"
            f"Page text (first 3000 chars):\n{md[:3000]}\n\n"
            "Extract all named people with their job titles from this company page.\n"
            "If a linkedin.com/in/ URL appears near a person's name, include it as linkedin_url.\n"
            "Only include people who work AT this company (not customers or advisors unless Board).\n"
            'Return ONLY a JSON array: [{"name":"Full Name","title":"Job Title","linkedin_url":"url or empty"}, ...]\n'
            "If no people found, return []. Max 20 people. No markdown."
        )
        items = _gemini_extract(prompt, gemini_key)
        for item in items:
            if not isinstance(item, dict):
                continue
            name = (item.get("name") or "").strip()
            title = (item.get("title") or "").strip()
            li_url = (item.get("linkedin_url") or "").strip()
            if not name or len(name) < 3:
                continue

            # Validate / clean linkedin_url
            if li_url and "linkedin.com/in/" not in li_url:
                li_url = ""
            # Fallback: try to match name slug against pre-extracted LI URLs
            if not li_url and page_li_urls:
                name_slug = re.sub(r'[^a-z0-9]', '', name.lower())
                for slug, full in page_li_urls.items():
                    if name_slug and (name_slug in slug or slug in name_slug):
                        li_url = full
                        break

            all_people.append({
                "name": name,
                "title": title,
                "department": _classify_department(title),
                "email": "",
                "linkedin_url": li_url,
                "is_decision_maker": _is_decision_maker(title),
                "source_urls": [url],
                "_official_confirmed": True,
            })

        unique_so_far = len({_normalize_name(p["name"]) for p in all_people})
        if unique_so_far >= 8:
            break

    return all_people


def _merge_paths(search: list, official: list) -> list:
    """
    Cross-reference both discovery paths by normalized name.

    Confidence scoring:
      - Official page only:        _CONF_OFFICIAL_PAGE (40) + role base (DM=40, other=20)
      - Search + official match:   official base + _CONF_MULTI_SOURCE (+20)
      - Search only:               role base (DM=30, other=15) + _CONF_SEARCH_ONLY (15)

    All source_urls from both paths are stored on the merged record.
    """
    # Index official people by normalized name
    official_index: dict = {}
    for p in official:
        key = _normalize_name(p["name"])
        if key not in official_index:
            official_index[key] = p
        else:
            # Same name on multiple pages — accumulate source_urls
            official_index[key]["source_urls"].extend(p["source_urls"])

    merged: dict = {}

    # Start from official people (authoritative)
    for key, p in official_index.items():
        is_dm = p["is_decision_maker"]
        conf = _CONF_OFFICIAL_PAGE + (40 if is_dm else 20)
        merged[key] = {
            **p,
            "confidence": min(conf, 95),
            "source": "website",
            "source_urls": list(dict.fromkeys(p["source_urls"])),
        }

    # Add / cross-reference search candidates
    for p in search:
        key = _normalize_name(p["name"])
        if key in merged:
            # Cross-reference confirmed — boost confidence and add source_urls
            existing = merged[key]
            existing["confidence"] = min(existing["confidence"] + _CONF_MULTI_SOURCE, 98)
            for url in p["source_urls"]:
                if url and url not in existing["source_urls"]:
                    existing["source_urls"].append(url)
            # Prefer official title but fill in if missing
            if not existing["title"] and p.get("title"):
                existing["title"] = p["title"]
                existing["department"] = p["department"]
                existing["is_decision_maker"] = p["is_decision_maker"]
            # Propagate LinkedIn URL if official page didn't have it
            if not existing.get("linkedin_url") and p.get("linkedin_url"):
                existing["linkedin_url"] = p["linkedin_url"]
        else:
            # Search-only candidate — lower confidence
            is_dm = p["is_decision_maker"]
            conf = (30 if is_dm else 15) + _CONF_SEARCH_ONLY
            merged[key] = {
                **p,
                "confidence": min(conf, 95),
                "source": "web_search",
                "source_urls": [u for u in p["source_urls"] if u],
            }

    return list(merged.values())


def discover_people(company: dict, gemini_key: str) -> list:
    """
    Main entry point.

    Runs search discovery and official-page scraping, cross-references results,
    applies multi-source confidence boost, deduplicates, and returns up to 15
    people sorted by decision-maker flag and confidence.
    """
    website = company.get("website") or ""
    name = company.get("name") or ""

    if not website or not name:
        return []

    if not website.startswith("http"):
        website = "https://" + website

    try:
        from urllib.parse import urlparse
        parsed = urlparse(website)
        netloc = parsed.netloc
        domain = netloc.replace("www.", "")
        base = f"https://{netloc}"
    except Exception:
        return []

    # Run both paths (sequential — Firecrawl scrapes are I/O bound but we keep it simple)
    search_candidates = _search_candidates(name, domain, gemini_key)
    official_people = _scrape_official_pages(base, name, gemini_key)

    print(f"[discover_people] {name}: search={len(search_candidates)} official={len(official_people)}", flush=True)

    people = _merge_paths(search_candidates, official_people)

    # Sort: decision makers first, then confidence desc
    people.sort(key=lambda p: (0 if p.get("is_decision_maker") else 1, -p.get("confidence", 0)))

    return people[:15]
