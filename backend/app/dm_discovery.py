"""
Decision Maker Discovery V1 — per Sonar_Decision_Maker_Discovery_V1 spec.

Phase 1 scope:
  - Search engine organic results only (Brave Search primary, DDGS fallback)
  - Gemini AI extraction from snippets (Google AI Overview equivalent)
  - NO website crawling, NO LinkedIn page scraping in this phase
  - Role normalization, fuzzy deduplication, confidence scoring by source domain

Architecture:
  Company Name → 6 Search Queries → Organic Snippets → Gemini Extraction
  → Role Normalization → Deduplication → Confidence Scoring → Final JSON
"""

import re
import json
import time
import requests

# ── Search query templates (per spec) ────────────────────────────────────────
_QUERY_TEMPLATES = [
    "{name} CEO",
    "{name} Founder",
    "{name} Leadership",
    "{name} Executive Team",
    "{name} Management",
    "{name} Directors",
]

# ── Role normalization (per spec) ─────────────────────────────────────────────
_ROLE_NORM = [
    (re.compile(r'president\s*(?:&|and|/)\s*ceo', re.I),    "CEO"),
    (re.compile(r'chairman\s*(?:&|and|/)\s*ceo', re.I),     "CEO"),
    (re.compile(r'chief\s*executive\s*officer', re.I),       "CEO"),
    (re.compile(r'co-?founder', re.I),                       "Co-Founder"),
    (re.compile(r'chief\s*technology\s*officer', re.I),      "CTO"),
    (re.compile(r'chief\s*operating\s*officer', re.I),       "COO"),
    (re.compile(r'chief\s*financial\s*officer', re.I),       "CFO"),
    (re.compile(r'chief\s*marketing\s*officer', re.I),       "CMO"),
    (re.compile(r'chief\s*product\s*officer', re.I),         "CPO"),
    (re.compile(r'chief\s*revenue\s*officer', re.I),         "CRO"),
    (re.compile(r'chief\s*information\s*security\s*officer', re.I), "CISO"),
    (re.compile(r'chief\s*information\s*officer', re.I),     "CIO"),
    (re.compile(r'chief\s*data\s*officer', re.I),            "CDO"),
    (re.compile(r'managing\s*director', re.I),               "Managing Director"),
    (re.compile(r'executive\s*director', re.I),              "Executive Director"),
    (re.compile(r'general\s*partner', re.I),                 "General Partner"),
    (re.compile(r'vice\s*president', re.I),                  "VP"),
    (re.compile(r'\bv\.?p\.?\b', re.I),                      "VP"),
]

# ── Source confidence per spec ────────────────────────────────────────────────
_CONF_AI_OVERVIEW   = 100   # Gemini extraction (AI Overview equivalent)
_CONF_OFFICIAL_SITE = 95
_CONF_DEFAULT       = 20

_DOMAIN_CONF = {
    "crunchbase.com":     90,
    "pitchbook.com":      88,
    "techcrunch.com":     85,
    "bloomberg.com":      85,
    "reuters.com":        85,
    "ft.com":             85,
    "forbes.com":         85,
    "wsj.com":            85,
    "cnbc.com":           85,
    "businesswire.com":   85,
    "prnewswire.com":     85,
    "globenewswire.com":  85,
    "venturebeat.com":    82,
    "wikipedia.org":      80,
    "linkedin.com":       80,
    "owler.com":          75,
    "zoominfo.com":       75,
    "apollo.io":          75,
    "glassdoor.com":      65,
    "g2.com":             60,
}

# Accepted leadership roles per spec (reject marketing / product copy)
_ACCEPTED_ROLES = re.compile(
    r'\b(?:ceo|founder|co-?founder|cto|coo|cfo|cmo|cpo|cro|ciso|cdo|cio|'
    r'chief|president|chairman|managing\s*director|executive\s*director|'
    r'general\s*partner|partner|director|vice\s*president|v\.?p\.?|head\s*of)\b',
    re.I,
)

_DM_ROLES = re.compile(
    r'\b(?:ceo|founder|co-?founder|cto|coo|cfo|cmo|cpo|cro|president|'
    r'chairman|managing\s*director|executive\s*director|general\s*partner|partner|'
    r'vice\s*president|v\.?p\.?|director|head\s*of|chief)\b',
    re.I,
)


def _normalize_role(title: str) -> str:
    for pattern, normalized in _ROLE_NORM:
        if pattern.search(title):
            return normalized
    return title.strip()


def _score_source(url: str, company_domain: str = "") -> tuple[int, str]:
    """Return (confidence, source_label) for a result URL."""
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.lower().replace("www.", "")
    except Exception:
        return _CONF_DEFAULT, "Search Result"

    # Official company site
    if company_domain and domain and (
        domain == company_domain or domain.endswith("." + company_domain)
    ):
        return _CONF_OFFICIAL_SITE, "Official Website"

    for d, score in _DOMAIN_CONF.items():
        if domain == d or domain.endswith("." + d):
            label = _domain_label(d)
            return score, label

    return _CONF_DEFAULT, "Search Result"


def _domain_label(domain: str) -> str:
    if "crunchbase" in domain:   return "Crunchbase"
    if "pitchbook" in domain:    return "PitchBook"
    if "linkedin" in domain:     return "LinkedIn Snippet"
    if "wikipedia" in domain:    return "Wikipedia"
    if any(d in domain for d in ("businesswire", "prnewswire", "globenewswire")):
        return "Press Release"
    if any(d in domain for d in ("techcrunch", "bloomberg", "reuters", "forbes", "wsj", "cnbc", "ft.com", "venturebeat")):
        return "News"
    if any(d in domain for d in ("zoominfo", "owler", "apollo", "pitchbook")):
        return "Business Directory"
    return "Search Result"


def _classify_dept(title: str) -> str:
    t = title.lower()
    if any(k in t for k in ("ceo", "founder", "co-founder", "president", "chairman", "managing director")): return "Executive"
    if any(k in t for k in ("cto", "technology", "engineering", "technical")): return "Engineering"
    if any(k in t for k in ("cfo", "finance", "financial")): return "Finance"
    if any(k in t for k in ("coo", "operations")): return "Operations"
    if any(k in t for k in ("cmo", "marketing")): return "Marketing"
    if any(k in t for k in ("cso", "sales", "revenue")): return "Sales"
    if any(k in t for k in ("cpo", "product")): return "Product"
    return "Other"


def _deduplicate(candidates: list) -> list:
    """Fuzzy name deduplication; keep highest-confidence per person."""
    try:
        from rapidfuzz import fuzz
        _sim = lambda a, b: fuzz.ratio(a, b)
    except ImportError:
        from difflib import SequenceMatcher
        _sim = lambda a, b: SequenceMatcher(None, a, b).ratio() * 100

    merged: list = []
    for c in candidates:
        name_norm = c["name"].lower().strip()
        matched = False
        for existing in merged:
            if _sim(name_norm, existing["name"].lower().strip()) >= 85:
                # Keep higher confidence; accumulate source URLs
                if c["confidence"] > existing["confidence"]:
                    existing.update({
                        "confidence": c["confidence"],
                        "source": c["source"],
                        "source_url": c["source_url"],
                    })
                for u in c.get("source_urls", []):
                    if u and u not in existing["source_urls"]:
                        existing["source_urls"].append(u)
                matched = True
                break
        if not matched:
            merged.append(c)
    return merged


def _gemini_extract(prompt: str, gemini_key: str) -> list:
    """Gemini extraction with one 429 retry (acts as AI Overview layer)."""
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
                    time.sleep(5)
                    continue
                return []
            if resp.status_code != 200:
                print(f"[dm_gemini] HTTP {resp.status_code}: {resp.text[:200]}", flush=True)
                return []
            raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            m = re.search(r'\[.*\]', raw, re.DOTALL)
            if not m:
                return []
            items = json.loads(m.group(0))
            return items if isinstance(items, list) else []
        except Exception as e:
            print(f"[dm_gemini] exception: {e}", flush=True)
            return []
    return []


def discover_decision_makers(
    company_name: str,
    gemini_key: str,
    company_domain: str = "",
) -> list:
    """
    V1 Decision Maker Discovery — search engine organic results + Gemini extraction.

    Phase 1: search-only, no crawling.
    Returns list of candidate dicts ready for decision_makers table insertion.
    """
    try:
        from .company_prefill import _web_search
    except Exception:
        return []

    # ── Step 1: Run all 6 queries, collect snippets ───────────────────────────
    all_snippets: list = []

    for template in _QUERY_TEMPLATES:
        q = template.format(name=company_name)
        try:
            results = _web_search(q, count=5)
            hit = 0
            for r in results:
                url   = r.get("href", "") or ""
                title = r.get("title", "") or ""
                body  = (r.get("body") or "")[:300]
                if url and (title or body):
                    all_snippets.append((url, title, body))
                    hit += 1
            print(f"[dm_v1] {company_name} | {q!r}: {hit} results", flush=True)
        except Exception as e:
            print(f"[dm_v1] {company_name} | {q!r}: error {e}", flush=True)

    print(f"[dm_v1] {company_name}: total snippets={len(all_snippets)}", flush=True)

    if not all_snippets:
        print(f"[dm_v1] {company_name}: no snippets — returning empty", flush=True)
        return []

    # ── Step 2: Gemini AI extraction (AI Overview equivalent) ─────────────────
    combined = "\n".join(
        f"[{url}] {title} — {body}"
        for url, title, body in all_snippets[:30]
    )
    prompt = (
        f"Company: {company_name}\n"
        f"Search result snippets:\n{combined}\n\n"
        "Extract ALL named leadership individuals at this company from these snippets.\n"
        "Only accept these roles: CEO, Founder, Co-Founder, CTO, COO, CFO, CMO, CPO, "
        "President, Managing Director, Executive Director, Chairman, Director, VP, Head of.\n"
        "Ignore: customers, advisors, board members of other companies, marketing copy, "
        "awards, products, unnamed 'leadership team' references.\n"
        "Note the exact source URL where each person appears.\n"
        'Return ONLY a JSON array: [{"name": "Full Name", "title": "Job Title", "url": "source_url"}, ...]\n'
        "Max 15 entries. No markdown, no explanation."
    )
    raw_items = _gemini_extract(prompt, gemini_key)
    print(f"[dm_v1] {company_name}: Gemini extracted {len(raw_items)} raw candidates", flush=True)

    # ── Step 3: Score, normalize, validate ────────────────────────────────────
    candidates: list = []
    accepted = rejected = 0

    for item in raw_items:
        if not isinstance(item, dict):
            rejected += 1
            continue

        name  = (item.get("name") or "").strip()
        title = (item.get("title") or "").strip()
        url   = (item.get("url") or "").strip()

        # Reject empty / single-word names (company names, not people)
        if not name or len(name.split()) < 2:
            rejected += 1
            continue
        # Reject if title doesn't contain an accepted leadership role
        if not title or not _ACCEPTED_ROLES.search(title):
            rejected += 1
            continue

        role = _normalize_role(title)
        conf, source_label = _score_source(url, company_domain)

        candidates.append({
            "name":             name,
            "role":             role,
            "title":            title,
            "source":           source_label,
            "source_url":       url,
            "source_urls":      [url] if url else [],
            "confidence":       conf,
            "is_decision_maker": bool(_DM_ROLES.search(title)),
            "email":            "",
            "linkedin_url":     "",
            "department":       _classify_dept(title),
        })
        accepted += 1

    print(
        f"[dm_v1] {company_name}: accepted={accepted} rejected={rejected}",
        flush=True,
    )

    # ── Step 4: Deduplicate ───────────────────────────────────────────────────
    deduped = _deduplicate(candidates)

    # ── Step 5: Sort — decision makers first, then by confidence desc ─────────
    deduped.sort(key=lambda p: (0 if p["is_decision_maker"] else 1, -p["confidence"]))

    print(
        f"[dm_v1] {company_name}: final={len(deduped)} (after dedup)",
        flush=True,
    )
    return deduped[:15]
