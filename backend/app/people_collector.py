"""
People Intelligence Engine — discovers decision makers from company websites.

Tier 1: Firecrawl scrapes leadership/team pages → Gemini extracts people
Tier 2: DDG web search fallback if Tier 1 finds < 2 people
"""

import re
import json
import requests

_LEADERSHIP_PATHS = [
    "/team", "/our-team", "/leadership", "/about/team", "/people",
    "/management", "/founders", "/executive-team", "/board",
    "/about", "/about-us", "/who-we-are",
]

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
    "managing director": "Executive", "md": "Executive",
    "partner": "Executive", "general partner": "Executive",
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
        "principal", "lead",
    ]
    return any(kw in t for kw in dm_keywords)


def _normalize_name(name: str) -> str:
    return re.sub(r'\s+', ' ', name.strip().lower())


def _deduplicate(people: list) -> list:
    seen: dict = {}
    result = []
    for p in people:
        key = _normalize_name(p.get("name", ""))
        if not key or key in seen:
            continue
        seen[key] = True
        result.append(p)
    return result


def _extract_people_gemini(page_text: str, company_name: str, gemini_key: str, source_url: str) -> list:
    if not gemini_key or not page_text:
        return []
    prompt = (
        f"Company: {company_name}\n"
        f"Page text (first 3000 chars):\n{page_text[:3000]}\n\n"
        "Extract all named people with their job titles from this company page.\n"
        "Only include people who work AT this company (not customers, advisors unless Board).\n"
        'Return ONLY a JSON array: [{"name":"Full Name","title":"Job Title"}, ...]\n'
        "If no people found, return [].\n"
        "Maximum 20 people. No markdown, no explanation."
    )
    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}",
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.0, "maxOutputTokens": 1024},
            },
            timeout=15,
        )
        if resp.status_code != 200:
            return []
        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        m = re.search(r'\[.*\]', raw, re.DOTALL)
        if not m:
            return []
        items = json.loads(m.group(0))
        people = []
        for item in items:
            if not isinstance(item, dict):
                continue
            name = (item.get("name") or "").strip()
            title = (item.get("title") or "").strip()
            if not name or len(name) < 3:
                continue
            dept = _classify_department(title)
            is_dm = _is_decision_maker(title)
            people.append({
                "name": name,
                "title": title,
                "department": dept,
                "email": "",
                "linkedin_url": "",
                "confidence": 80 if is_dm else 60,
                "source": "website",
                "source_url": source_url,
                "is_decision_maker": is_dm,
            })
        return people
    except Exception:
        return []


def _try_ddg_people(company_name: str, domain: str) -> list:
    """DDG search for leadership pages as Tier 2 fallback."""
    try:
        from .company_prefill import _web_search
        results = _web_search(
            f'"{company_name}" CEO OR founder OR "head of" site:{domain}',
            count=5,
        )
        people = []
        for r in results:
            title_text = r.get("title", "")
            snippet = r.get("body", "")
            # Try to extract name+title from search snippets
            combined = f"{title_text} {snippet}"
            # Look for patterns like "Name, Title at Company"
            matches = re.findall(
                r'([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?),?\s+((?:CEO|CTO|CFO|COO|CPO|VP|Director|Head of|Founder|Co-Founder|President|Partner)[^,.\n]{0,60})',
                combined,
            )
            for name, title in matches:
                dept = _classify_department(title)
                people.append({
                    "name": name.strip(),
                    "title": title.strip(),
                    "department": dept,
                    "email": "",
                    "linkedin_url": "",
                    "confidence": 55,
                    "source": "web_search",
                    "source_url": r.get("href", ""),
                    "is_decision_maker": _is_decision_maker(title),
                })
        return people
    except Exception:
        return []


def discover_people(company: dict, gemini_key: str) -> list:
    """
    Main entry: scrape leadership pages with Firecrawl, extract people with Gemini.
    Falls back to DDG search if < 2 people found.
    Returns up to 15 people sorted by is_decision_maker desc.
    """
    from .enrichment import _fc_scrape

    website = company.get("website") or ""
    name = company.get("name") or ""

    if not website:
        return []

    # Normalize domain
    if not website.startswith("http"):
        website = "https://" + website
    try:
        from urllib.parse import urlparse
        netloc = urlparse(website).netloc.replace("www.", "")
        base = f"https://{urlparse(website).netloc}"
    except Exception:
        return []

    all_people: list = []
    pages_tried = 0

    for path in _LEADERSHIP_PATHS:
        if pages_tried >= 3:
            break
        url = base + path
        try:
            md = _fc_scrape(url, wait_ms=2500)
        except Exception:
            md = ""
        if not md or len(md) < 100:
            continue
        pages_tried += 1
        found = _extract_people_gemini(md, name, gemini_key, url)
        all_people.extend(found)
        if len(_deduplicate(all_people)) >= 8:
            break

    people = _deduplicate(all_people)

    # Tier 2: DDG fallback if too few found
    if len(people) < 2 and netloc:
        ddg = _try_ddg_people(name, netloc)
        people.extend(ddg)
        people = _deduplicate(people)

    # Sort: decision makers first, then by confidence desc
    people.sort(key=lambda p: (0 if p.get("is_decision_maker") else 1, -p.get("confidence", 0)))

    return people[:15]
