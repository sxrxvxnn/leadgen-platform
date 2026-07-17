import os
import re
import json
import html as _html
import requests
from bs4 import BeautifulSoup
from urllib.parse import unquote, urlparse, parse_qs


# ── Search helpers ────────────────────────────────────────────────────────────

def _brave_search(query: str, count: int = 8) -> list:
    """Brave Search API — 2 000 free queries/month, much more reliable than DDGS."""
    key = os.environ.get("BRAVE_API_KEY", "")
    if not key:
        return []
    try:
        res = requests.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": min(count, 20)},
            headers={"Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": key},
            timeout=10,
        )
        if res.status_code == 200:
            return [
                {"href": r.get("url", ""), "title": r.get("title", ""), "body": r.get("description", "")}
                for r in res.json().get("web", {}).get("results", [])
            ]
    except Exception:
        pass
    return []


def _web_search(query: str, count: int = 8) -> list:
    """Brave Search first (if BRAVE_API_KEY set), DDGS fallback."""
    results = _brave_search(query, count)
    if results:
        return results
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            return [
                {"href": r.get("href", r.get("url", "")), "title": r.get("title", ""), "body": r.get("body", "")}
                for r in ddgs.text(query, max_results=count)
            ]
    except Exception:
        return []


_SKIP_DOMAINS = {
    'linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
    'youtube.com', 'duckduckgo.com', 'google.com', 'bing.com', 'wikipedia.org',
    'crunchbase.com', 'glassdoor.com', 'indeed.com', 'g2.com', 'capterra.com',
    'trustpilot.com', 'yelp.com', 'bloomberg.com', 'forbes.com', 'techcrunch.com',
    'zoominfo.com', 'clutch.co', 'owler.com', 'dnb.com', 'apollo.io',
    'tracxn.com', 'pitchbook.com', 'cbinsights.com', 'rocketreach.co',
    'yourstory.com', 'technopark.in', 'ambitionbox.com', 'tofler.in',
    'startupindia.gov.in', 'mca.gov.in', 'economictimes.com',
    'businessinsider.com', 'inc42.com', 'entrackr.com',
    # Data aggregators that sometimes appear as "website" on LinkedIn pages
    'ampliz.com', 'growjo.com', 'signalhire.com', 'contactout.com',
    'lusha.com', 'seamless.ai', 'hunter.io', 'clearbit.com',
    'similarweb.com', 'semrush.com', 'builtwith.com',
    'researchsolutions.com', 'questarai.com',
}


def _guess_domain(name: str) -> str | None:
    """Try common domain patterns derived from the company name."""
    raw = re.sub(r'[^a-z0-9 ]', '', name.lower()).split()
    words = [w for w in raw if w not in _CORPORATE_SUFFIXES and len(w) > 1]
    slug = ''.join(words)
    slug2 = '-'.join(words)
    candidates = [
        f"https://{slug}.com",
        f"https://{slug}.io",
        f"https://{slug}.co",
        f"https://{slug}.in",
        f"https://www.{slug}.com",
        f"https://{slug2}.com",
    ]
    for url in candidates:
        try:
            r = requests.head(url, timeout=5, allow_redirects=True,
                              headers={'User-Agent': 'Mozilla/5.0'})
            # 403 means the server exists and actively rejected the HEAD —
            # the domain is valid, the site is real (many CDNs block HEAD requests)
            if r.status_code < 400 or r.status_code == 403:
                return url
        except Exception:
            continue
    return None


_CORPORATE_SUFFIXES = {'ltd', 'pvt', 'inc', 'llc', 'llp', 'corp', 'limited', 'private', 'public', 'gmbh', 'plc'}

def _domain_is_relevant(domain: str, company_name: str) -> bool:
    """Check if a domain plausibly belongs to the company (not a directory/news site)."""
    # Strip corporate suffixes and short words, keep meaningful words only
    raw_words = re.sub(r'[^a-z0-9 ]', '', company_name.lower()).split()
    name_words = [w for w in raw_words if len(w) > 2 and w not in _CORPORATE_SUFFIXES]
    domain_clean = re.sub(r'\.(com|io|co|in|net|org|ai|app|tech|dev|co\.in)$', '', domain.lower())
    return any(w in domain_clean for w in name_words)


def search_company_website(company_name: str) -> str | None:
    company_name = clean_name_for_search(company_name)
    # 1. Try guessing the domain directly first (fastest, most accurate for known companies)
    guessed = _guess_domain(company_name)
    if guessed:
        return guessed

    # 2. Search and require the domain to be relevant to the company name
    queries = [
        f'"{company_name}" official website',
        f'{company_name} company official site',
    ]
    for q in queries:
        for r in _web_search(q, count=8):
            href = r.get('href', '')
            title = r.get('title', '')
            if not href:
                continue
            domain = urlparse(href).netloc.replace('www.', '')
            if any(domain == s or domain.endswith('.' + s) for s in _SKIP_DOMAINS):
                continue
            if _domain_is_relevant(domain, company_name) or company_name.lower() in title.lower():
                return href

    return None


def clean_name_for_search(name: str) -> str:
    """Strip acquisition / rebranding disambiguation from a company name before web/DDGS search.

    "Ipreo/S&P Global"                  → "Ipreo"
    "Divvy from BILL/BILL"              → "Divvy"
    "RPM Technologies (now Broadridge)" → "RPM Technologies"
    "Skrill, a Paysafe Experience"      → "Skrill"
    "DriDrop Hydration,PBC"             → "DriDrop Hydration"
    "Questar Assessment inc./NWEA"      → "Questar Assessment inc."
    """
    # "X/Y" — take the first part (original entity before acquisition)
    name = re.split(r'\s*/\s*', name)[0].strip()
    # "X from Y" — strip " from Y" suffix
    name = re.sub(r'\s+from\s+\S.*$', '', name, flags=re.I).strip()
    # "(now X)" rebranding notes
    name = re.sub(r'\s*\(now\s+[^)]+\)', '', name, flags=re.I).strip()
    # ", a X Experience" / ",PBC" / ", Inc." trailing corp note after comma
    name = re.sub(r',\s*(?:a\s+.+|pbc|inc\.?|corp\.?|llc|llp|ltd\.?)$', '', name, flags=re.I).strip()
    return name or name


_LEGAL_SUFFIX_RE = re.compile(
    r'\s*[\(\[]?(?:p\.?\s*)?(?:pvt\.?|private)\s*[\)\]]?\s*'
    r'|[\(\[]p[\)\]]\s*'
    r'|\b(?:private\s+limited|pvt\.?\s*ltd\.?|p\.?\s*ltd\.?|limited|ltd\.?|inc\.?|llc|corp\.?|gmbh|plc|llp)\b',
    re.I,
)


def _linkedin_search_name(company_name: str) -> str:
    """Return a cleaned name suitable for LinkedIn/DDGS search (strip legal suffixes)."""
    cleaned = _LEGAL_SUFFIX_RE.sub(' ', company_name).strip()
    cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip()
    return cleaned or company_name


def _is_indian_entity(company_name: str) -> bool:
    return bool(re.search(r'\bindia\b|\bpvt\.?\s*ltd\b|\bp\.?\s*ltd\b|\bprivate\s+limited\b', company_name, re.I))


def search_linkedin_url_by_domain(website_url: str) -> str | None:
    """Find a company's LinkedIn page by searching for its known domain.

    Far more precise than name search — avoids wrong-entity matches.
    e.g. searching "navigatewell.com" finds Navigate's health-tech page,
    while searching "Navigate" finds NVGT the sports consulting firm.
    """
    clean = website_url.replace('https://', '').replace('http://', '')
    clean = clean.replace('www.', '').split('/')[0].strip()
    if not clean:
        return None

    queries = [
        f'site:linkedin.com/company "{clean}"',
        f'linkedin.com/company {clean}',
    ]
    _SKIP_SLUGS = {'linkedin', 'company', 'showcase', 'school', 'about', 'jobs', 'feed', 'posts'}
    for q in queries:
        for r in _web_search(q, count=6):
            href = r.get('href', '') or r.get('url', '')
            match = re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', href)
            if not match:
                continue
            slug = match.group(1)
            if slug in _SKIP_SLUGS:
                continue
            return f'https://www.linkedin.com/company/{slug}/'
    return None


def search_linkedin_url_direct(company_name: str) -> str | None:
    """Search for company's LinkedIn page URL using ddgs."""
    is_indian = _is_indian_entity(company_name)
    # Clean disambiguation before searching, then strip legal suffixes
    search_name = _linkedin_search_name(clean_name_for_search(company_name))

    # For Indian entities ensure "india" is in the search term so DDGS finds the India page
    if is_indian and 'india' not in search_name.lower():
        search_name = search_name + ' India'

    queries = [
        f'site:linkedin.com/company "{search_name}"',
        f'{search_name} linkedin.com/company',
    ]
    # Also try exact original name
    if search_name != company_name:
        queries.append(f'site:linkedin.com/company "{company_name}"')

    _SKIP_SLUGS = {'linkedin', 'company', 'showcase', 'school', 'about', 'jobs', 'feed', 'posts'}

    fallback_slug = None
    for q in queries:
        for r in _web_search(q, count=8):
            href = r.get('href', '') or r.get('url', '')
            match = re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', href)
            if not match:
                continue
            slug = match.group(1)
            if slug in _SKIP_SLUGS:
                continue
            if is_indian:
                if 'india' in slug.lower():
                    return f'https://www.linkedin.com/company/{slug}/'
                else:
                    if not fallback_slug:
                        fallback_slug = slug
                    continue
            return f'https://www.linkedin.com/company/{slug}/'

    # Use best fallback slug found (Indian entity whose slug doesn't contain "india")
    if fallback_slug:
        return f'https://www.linkedin.com/company/{fallback_slug}/'
    return None


def extract_linkedin_url_from_html(html: str) -> str | None:
    match = re.search(r'https?://(?:www\.)?linkedin\.com/company/([a-zA-Z0-9_-]+)', html)
    if match:
        slug = match.group(1)
        if slug not in ('linkedin', 'company', 'showcase', 'school'):
            return f'https://www.linkedin.com/company/{slug}/'
    # Also check href-only patterns like linkedin.com/company/slug
    match = re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', html)
    if match:
        slug = match.group(1)
        if slug not in ('linkedin', 'company', 'showcase', 'school'):
            return f'https://www.linkedin.com/company/{slug}/'
    return None


def extract_linkedin_url_with_qwen3(html_snippet: str, company_name: str, api_key: str) -> str | None:
    prompt = f"""Find the LinkedIn company page URL for "{company_name}" in this HTML.
Look for a link matching: linkedin.com/company/[slug]
Return ONLY the full URL like https://www.linkedin.com/company/company-slug/ or the word NOT_FOUND.

HTML (first 3000 chars):
{html_snippet[:3000]}"""

    result = _call_qwen3(prompt, api_key)
    if not result:
        return None
    match = re.search(r'https?://(?:www\.)?linkedin\.com/company/([a-zA-Z0-9_-]+)', result)
    if match:
        slug = match.group(1)
        if slug not in ('linkedin', 'company', 'showcase', 'school'):
            return f'https://www.linkedin.com/company/{slug}/'
    return None


def _call_qwen3(prompt: str, api_key: str) -> str | None:
    try:
        res = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'qwen/qwen3-235b-a22b:free',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 200,
                'temperature': 0.1,
                'chat_template_kwargs': {'enable_thinking': False},
            },
            timeout=25
        )
        data = res.json()
        return data['choices'][0]['message']['content'].strip()
    except Exception as e:
        print(f"Qwen3 OpenRouter error: {e}")
        return None


_LI_UA_LIST = [
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

_LI_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
}


def _scrapingbee_fetch(url: str, render_js: bool = True, timeout: int = 30) -> str | None:
    """Fetch via ScrapingBee — JS rendering, proxy rotation, LinkedIn-compatible.
    Returns raw HTML or None. Activated by SCRAPINGBEE_API_KEY env var."""
    sb_key = os.environ.get("SCRAPINGBEE_API_KEY", "")
    if not sb_key:
        return None
    try:
        r = requests.get(
            "https://app.scrapingbee.com/api/v1/",
            params={
                "api_key": sb_key,
                "url": url,
                "render_js": "true" if render_js else "false",
                "premium_proxy": "false",
                "block_ads": "true",
                "block_resources": "false",
            },
            timeout=timeout + 5,
        )
        if r.status_code == 200 and len(r.text) > 2000:
            return r.text
    except Exception:
        pass
    return None


def _fetch_linkedin_html(url: str, fast: bool = False, li_cookie: str = '') -> str | None:
    """Fetch a LinkedIn page's HTML.
    Priority: Firecrawl → ScrapingBee → direct HTTP (multiple UAs).
    fast=True skips paid scrapers (too slow for bulk) and uses shorter timeouts.
    li_cookie: 'li_at' session cookie for authenticated scraping.
    """
    _LOGIN_WALL = 'keep in touch with people you know'

    # Firecrawl — handles JS rendering and LinkedIn anti-bot; skip in fast/bulk mode
    if not fast and not li_cookie:
        from .enrichment import _FIRECRAWL_KEYS, FIRECRAWL_BASE, _fc_rotate, _fc_key_idx, _fc_key_lock
        if _FIRECRAWL_KEYS:
            for _ in range(len(_FIRECRAWL_KEYS)):
                with _fc_key_lock:
                    _idx = _fc_key_idx % len(_FIRECRAWL_KEYS)
                _key = _FIRECRAWL_KEYS[_idx]
                try:
                    _res = requests.post(
                        f"{FIRECRAWL_BASE}/scrape",
                        headers={"Authorization": f"Bearer {_key}", "Content-Type": "application/json"},
                        json={"url": url, "formats": ["html"], "timeout": 30000},
                        timeout=35,
                    )
                    if _res.status_code == 200:
                        _html = _res.json().get("data", {}).get("html", "")
                        if _html and len(_html) > 3000 and _LOGIN_WALL not in _html[:5000]:
                            return _html
                        break
                    if _res.status_code in (402, 429):
                        _fc_rotate(_idx)
                        continue
                    break
                except Exception:
                    break

    # Direct HTTP fallback — multiple user agents
    ua_list = _LI_UA_LIST[:2] if fast else _LI_UA_LIST
    timeout = 4 if fast else 8
    cookie_header = f'li_at={li_cookie}' if li_cookie else ''
    for ua in ua_list:
        try:
            hdrs = {**_LI_HEADERS, 'User-Agent': ua}
            if cookie_header:
                hdrs['Cookie'] = cookie_header
            r = requests.get(url, headers=hdrs, timeout=timeout, allow_redirects=True)
            if r.status_code == 200 and len(r.text) > 3000:
                if _LOGIN_WALL in r.text[:5000]:
                    continue
                return r.text
        except Exception:
            continue
    return None


def _fetch_via_wayback(url: str, timeout: int = 10) -> str | None:
    """Fetch the most recent Wayback Machine snapshot of a LinkedIn page.
    Returns raw HTML that contains the same Voyager JSON blobs as a live request.
    No auth required — falls back gracefully if archive.org is unreachable.
    """
    try:
        cdx_url = (
            'https://web.archive.org/cdx/search/cdx'
            f'?url={url}&output=json&limit=5&fl=timestamp,statuscode'
            '&filter=statuscode:200&collapse=timestamp:8'
        )
        cdx_r = requests.get(cdx_url, timeout=timeout)
        if cdx_r.status_code != 200:
            return None
        rows = cdx_r.json()
        # rows[0] is the header row ["timestamp","statuscode"]
        if len(rows) < 2:
            return None
        timestamp = rows[1][0]  # most recent snapshot timestamp
        archived_url = f'https://web.archive.org/web/{timestamp}/{url}'
        page_r = requests.get(archived_url, timeout=timeout, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; LeadGenEngine/1.0)',
        })
        if page_r.status_code == 200 and len(page_r.text) > 3000:
            return page_r.text
    except Exception:
        pass
    return None


def _jina_fetch_linkedin_md(url: str) -> str:
    """Fetch a LinkedIn company page via Firecrawl, returns markdown."""
    from .enrichment import _fc_scrape
    base = url.rstrip('/')
    for li_url in [base + '/about/', base + '/']:
        try:
            md = _fc_scrape(li_url, wait_ms=4000)
            if md and len(md) > 200 and 'linkedin' in li_url.lower():
                return md
        except Exception:
            continue
    return ''


def _parse_jina_linkedin_md(md: str, result: dict) -> None:
    """Parse Jina markdown of a LinkedIn company page, filling missing fields in result."""
    if not result.get('followers'):
        m = re.search(r'([\d,]+(?:\.\d+)?[KkMm]?)\s*followers', md, re.I)
        if m:
            raw = m.group(1).strip().replace(',', '')
            km = re.match(r'^([\d.]+)([KkMm])$', raw)
            result['followers'] = str(int(float(km.group(1)) * (1_000_000 if km.group(2).upper()=='M' else 1_000))) if km else raw

    if not result.get('industry'):
        # Same-line: "Industry: Software Development"
        m = re.search(r'(?:^|\n)\s*[*\-]?\s*Industry\s*[:\|]\s*(.+?)(?:\n|$)', md, re.I | re.M)
        if not m:
            # Next-line: "Industry\nSoftware Development"
            m = re.search(r'\bIndustry\b\s*\n\s*([A-Z][^\n]{2,80}?)(?:\n|$)', md, re.I | re.M)
        if not m:
            # Bold variant
            m = re.search(r'\*{1,2}Industry\*{1,2}\s*:?\s*\n?\s*([A-Z][^\n*]{2,80}?)(?:\n|$)', md, re.I | re.M)
        if m:
            result['industry'] = m.group(1).strip().rstrip('*').strip()

    if not result.get('employee_count'):
        # Same-line: "Company size: 51-200 employees"
        m = re.search(r'Company\s*size\s*[:\|]\s*([\d,\s\-–]+\+?\s*employees)', md, re.I)
        if not m:
            # Next-line: "Company size\n51-200 employees"
            m = re.search(r'Company\s*size\s*\n\s*([\d,\s\-–]+\+?\s*employees)', md, re.I)
        if not m:
            m = re.search(r'([\d,]+\s*[-–]\s*[\d,]+\s*employees)', md, re.I)
        if not m:
            m = re.search(r'([\d,]+\+?\s*employees)', md, re.I)
        if m:
            result['employee_count'] = m.group(1).strip()

    if not result.get('location'):
        # LinkedIn renders HQ in two formats:
        # 1. Same line:  "Headquarters: San Francisco, CA"
        # 2. Next line:  "Headquarters\nSan Francisco, CA"
        # The old regex only caught format 1 — hence 92% HQ missing rate.
        _hq_m = re.search(
            r'(?:Headquarters|HQ)\s*[:\|]\s*(.+?)(?:\n|$)', md, re.I | re.M
        )
        if not _hq_m:
            # Next-line format: label alone on its line, value on the next
            _hq_m = re.search(
                r'(?:Headquarters|HQ)\s*\n\s*([A-Z][^\n]{2,80}?)(?:\n|$)', md, re.I | re.M
            )
        if not _hq_m:
            # Markdown bold variant: **Headquarters** or **HQ**
            _hq_m = re.search(
                r'\*{1,2}(?:Headquarters|HQ)\*{1,2}\s*:?\s*\n?\s*([A-Z][^\n*]{2,80}?)(?:\n|$)',
                md, re.I | re.M
            )
        if _hq_m:
            val = _hq_m.group(1).strip().rstrip('*').strip()
            if val and 'linkedin.com' not in val.lower() and len(val) > 2:
                result['location'] = val

    if not result.get('founded'):
        m = re.search(r'Founded\s*[:\|]?\s*(\d{4})', md, re.I)
        if m:
            result['founded'] = m.group(1)

    if not result.get('specialties'):
        m = re.search(r'Specialties?\s*[:\|]?\s*(.+?)(?:\n\n|\n[A-Z#]|$)', md, re.I | re.S)
        if m:
            val = m.group(1).strip().replace('\n', ', ')
            if len(val) > 8:
                result['specialties'] = val

    if not result.get('website'):
        m = re.search(r'Website\s*[:\|]?\s*(https?://[^\s\)>\]]+)', md, re.I)
        if not m:
            m = re.search(r'Website\s*[:\|]?\s*\[([^\]]+)\]\((https?://[^\)]+)\)', md, re.I)
        if m:
            ws = m.group(2) if m.lastindex and m.lastindex >= 2 else m.group(1)
            if ws and 'linkedin.com' not in ws:
                result['website'] = ws

    if not result.get('description'):
        m = re.search(r'(?:About us|Overview|About)\s*\n+(.{30,500}?)(?:\n\n|\n##|$)', md, re.I | re.S)
        if m:
            result['description'] = _html.unescape(m.group(1).strip())


def scrape_linkedin_data(linkedin_url: str, fast: bool = False, li_cookie: str = '') -> dict:
    """Scrape public LinkedIn company About page for all visible fields."""
    result = {
        'followers': None,
        'tagline': None,
        'location': None,
        'employee_count': None,
        'description': None,
        'industry': None,
        'website': None,
        'phone': None,
        'founded': None,
        'specialties': None,
    }
    # Jina Reader first — free, no credits, no auth wall, handles JS rendering.
    # With Firecrawl credits exhausted, Jina is now the primary LinkedIn data source.
    # If Jina returns all core fields, skip the slow HTML path entirely.
    _jina_attempted = False
    if not fast and not li_cookie:
        try:
            _jina_md_early = _jina_fetch_linkedin_md(linkedin_url)
            if _jina_md_early:
                _parse_jina_linkedin_md(_jina_md_early, result)
                _jina_attempted = True
        except Exception:
            pass
        if result.get('industry') and result.get('employee_count') and result.get('description'):
            return result  # Jina gave us enough — skip HTML scraping entirely

    try:
        base = linkedin_url.rstrip('/')
        # The /about/ endpoint exposes phone, founded, specialties, industry in full.
        # Try it first; fall back to the base company page if it returns nothing.
        html = _fetch_linkedin_html(base + '/about/', fast=fast, li_cookie=li_cookie)
        if not html:
            html = _fetch_linkedin_html(base + '/', fast=fast, li_cookie=li_cookie)
        if not html and not fast:
            # Wayback Machine fallback — no auth needed, archived pages contain Voyager JSON
            html = _fetch_via_wayback(base + '/about/')
            if not html:
                html = _fetch_via_wayback(base + '/')
        if not html:
            return result
        soup = BeautifulSoup(html, 'html.parser')

        # --- Followers + tagline from og:description ---
        # Format: "138 followers on LinkedIn. Unlocking Innovation, Empowering Enterprises"
        og_desc = soup.find('meta', {'property': 'og:description'}) or soup.find('meta', {'name': 'description'})
        if og_desc:
            desc_content = og_desc.get('content', '')
            m = re.search(r'([\d,]+)\s*followers', desc_content, re.I)
            if m:
                result['followers'] = m.group(1).strip().replace(',', '')
            tl_m = re.search(r'followers?\s+on\s+LinkedIn\.\s+(.{5,200})', desc_content, re.I)
            if tl_m:
                tl_text = _html.unescape(tl_m.group(1).strip())
                if len(tl_text) <= 100:
                    # Genuine short tagline/slogan
                    result['tagline'] = tl_text
                elif not result['description']:
                    # LinkedIn put the company overview in og:description — use it as description
                    result['description'] = tl_text

        # --- JSON-LD Organization block ---
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '')
                items = data.get('@graph', [data]) if isinstance(data, dict) else [data]
                for item in items:
                    if not isinstance(item, dict) or item.get('@type') != 'Organization':
                        continue
                    # Location
                    addr = item.get('address', {})
                    if isinstance(addr, dict):
                        parts = [addr.get('addressLocality'), addr.get('addressRegion'), addr.get('addressCountry')]
                        parts = [p for p in parts if p]
                        if parts:
                            result['location'] = ', '.join(parts)
                    # Employee count
                    emp = item.get('numberOfEmployees', {})
                    if isinstance(emp, dict) and emp.get('value'):
                        result['employee_count'] = str(emp['value'])
                    # Founded year
                    founding = item.get('foundingDate') or item.get('foundingYear') or ''
                    if founding and not result['founded']:
                        m = re.search(r'\d{4}', str(founding))
                        if m:
                            result['founded'] = m.group(0)
                    # Description — no length cap, LinkedIn overview is authoritative
                    if item.get('description') and not result['description']:
                        result['description'] = item['description'].strip()
                    # Website
                    if not result['website']:
                        org_url = item.get('url', '')
                        if org_url and 'linkedin.com' not in org_url:
                            result['website'] = org_url
                    if not result['website']:
                        for same in ([item.get('sameAs')] if isinstance(item.get('sameAs'), str) else (item.get('sameAs') or [])):
                            if isinstance(same, str) and 'linkedin.com' not in same and same.startswith('http'):
                                result['website'] = same
                                break
                    break
            except Exception:
                pass

        # --- LinkedIn Voyager JSON embedded in <code> elements ---
        # LinkedIn's SPA serialises full company data into <code> blobs on the page.
        # These contain structured fields (phone, foundedOn, specialities, headquarter,
        # staffCount) that are NOT present in the initial HTML markup.
        def _walk_voyager(obj, depth=0):
            if depth > 12 or not isinstance(obj, (dict, list)):
                return
            if isinstance(obj, list):
                for item in obj:
                    _walk_voyager(item, depth + 1)
                return
            # Phone
            if not result['phone']:
                ph = obj.get('phone') or obj.get('phoneNumber')
                if isinstance(ph, dict):
                    num = ph.get('number') or ph.get('phoneNumber') or ph.get('value', '')
                    if num and re.search(r'\d{5,}', str(num)):
                        result['phone'] = str(num).strip()
                elif isinstance(ph, str) and re.search(r'\d{5,}', ph):
                    result['phone'] = ph.strip()
            # Founded year
            if not result['founded']:
                fo = obj.get('foundedOn') or obj.get('foundingDate') or obj.get('foundedYear')
                if isinstance(fo, dict):
                    yr = fo.get('year') or fo.get('value')
                    if yr:
                        result['founded'] = str(yr)
                elif isinstance(fo, (int, str)):
                    m2 = re.search(r'\d{4}', str(fo))
                    if m2:
                        result['founded'] = m2.group(0)
            # Specialties — LinkedIn spells it "specialities"
            if not result['specialties']:
                sp = obj.get('specialities') or obj.get('specialties')
                if isinstance(sp, list) and sp:
                    result['specialties'] = ', '.join(str(s) for s in sp if s)
                elif isinstance(sp, str) and len(sp) > 3:
                    result['specialties'] = sp
            # Location/HQ
            if not result['location']:
                hq = obj.get('headquarter') or obj.get('headquarters')
                if isinstance(hq, dict):
                    parts = [hq.get('city'), hq.get('geographicArea'), hq.get('country')]
                    parts = [p for p in parts if p]
                    if parts:
                        result['location'] = ', '.join(parts)
            # Employee count — prefer staffCountRange (e.g. {"start":2,"end":10}) over staffCount
            if not result['employee_count']:
                scr = obj.get('staffCountRange')
                sc  = obj.get('staffCount')
                if isinstance(scr, dict) and scr.get('start') is not None:
                    start = scr['start']
                    end   = scr.get('end')
                    result['employee_count'] = f"{start}-{end}" if end else str(start)
                elif sc is not None:
                    result['employee_count'] = str(sc)
            # Description (overview)
            if not result['description']:
                desc = obj.get('description') or obj.get('tagline')
                if isinstance(desc, str) and len(desc) > 30:
                    result['description'] = desc.strip()
            # Industry
            if not result['industry']:
                ind = obj.get('industry') or obj.get('industries')
                if isinstance(ind, dict):
                    name = ind.get('localizedName') or ind.get('name')
                    if name:
                        result['industry'] = name
                elif isinstance(ind, list) and ind:
                    first = ind[0]
                    if isinstance(first, dict):
                        result['industry'] = first.get('localizedName') or first.get('name') or ''
                    elif isinstance(first, str):
                        result['industry'] = first
                elif isinstance(ind, str):
                    result['industry'] = ind
            # Website
            if not result['website']:
                ws = obj.get('websiteUrl') or obj.get('website') or obj.get('companyPageUrl')
                if isinstance(ws, str) and ws.startswith('http') and 'linkedin.com' not in ws:
                    result['website'] = ws
            # Followers
            if not result['followers']:
                fc = obj.get('followingInfo') or obj.get('followerCount')
                if isinstance(fc, dict):
                    cnt = fc.get('followerCount') or fc.get('count')
                    if cnt is not None:
                        result['followers'] = str(cnt)
                elif isinstance(fc, int):
                    result['followers'] = str(fc)
            # Recurse into nested dicts/lists
            for v in obj.values():
                if isinstance(v, (dict, list)):
                    _walk_voyager(v, depth + 1)

        for code_el in soup.find_all('code'):
            raw = (code_el.string or '').strip()
            if not raw.startswith('{') and not raw.startswith('['):
                continue
            try:
                blob = json.loads(raw)
                _walk_voyager(blob)
            except Exception:
                pass

        # --- HTML fallbacks for all About-section fields ---
        # LinkedIn About pages use a consistent label → value structure.
        # We try data-test-id patterns first, then simpler label-based regex.

        def _extract_after_label(label: str, html: str, max_len: int = 200) -> str | None:
            """Extract text that appears after a visible label in LinkedIn's About HTML."""
            # data-test-id pattern (LinkedIn's structured markup)
            pat1 = rf'data-test-id="about-us__{label.lower().replace(" ", "")}"[^>]*>.*?{label}.*?<[^<]{{0,20}}>\s*([^<]{{2,{max_len}}})<'
            m = re.search(pat1, html, re.S | re.I)
            if m:
                return m.group(1).strip()
            # Generic label → next tag content (works for both /about/ and main page)
            pat2 = rf'>{re.escape(label)}<.*?>([^<]{{2,{max_len}}})<'
            m = re.search(pat2, html, re.S | re.I)
            if m:
                val = m.group(1).strip()
                # Skip if value looks like another heading (Title Case, short)
                if not re.match(r'^[A-Z][a-z]+ [A-Z]', val) or len(val) > 30:
                    return val
            return None

        if not result['followers']:
            m = re.search(r'([\d,]+)\s*followers', html, re.I)
            if m:
                result['followers'] = m.group(1).strip().replace(',', '')

        if not result['location']:
            val = _extract_after_label('Headquarters', html)
            if val:
                result['location'] = val

        if not result['website']:
            m = re.search(r'href="(https?://(?!(?:www\.)?linkedin\.com)[^"]{5,100})"[^>]*>\s*(?:Visit website|Website|website)', html, re.I)
            if m:
                result['website'] = m.group(1)

        if not result['phone']:
            val = _extract_after_label('Phone', html, max_len=30)
            if not val:
                m = re.search(r'>Phone<.*?>([+\d][\d\s\-\(\).]{7,25})<', html, re.S)
                if m:
                    val = m.group(1).strip()
            if val and re.search(r'[\d]{5,}', val):  # must have at least 5 digits
                result['phone'] = val

        if not result['industry']:
            val = _extract_after_label('Industry', html)
            if val:
                result['industry'] = val

        if not result['founded']:
            val = _extract_after_label('Founded', html, max_len=10)
            if not val:
                m = re.search(r'>Founded<.*?>(\d{4})<', html, re.S)
                if m:
                    val = m.group(1)
            if val:
                m2 = re.search(r'\d{4}', val)
                if m2:
                    result['founded'] = m2.group(0)

        if not result['specialties']:
            val = _extract_after_label('Specialties', html, max_len=500)
            if not val:
                m = re.search(r'>Specialties<.*?>([^<]{15,500})<', html, re.S)
                if m:
                    val = m.group(1).strip()
            if val:
                result['specialties'] = val

        if not result['description']:
            # Overview paragraph text
            m = re.search(r'class="[^"]*about-us__description[^"]*"[^>]*>([^<]{30,2000})<', html, re.S)
            if not m:
                m = re.search(r'data-test-id="about-us__description"[^>]*>([^<]{30,2000})<', html, re.S)
            if m:
                result['description'] = m.group(1).strip()

        # Decode HTML entities in all text fields (&amp; → & etc.)
        for _k in ('description', 'tagline', 'specialties', 'industry', 'location'):
            if result[_k]:
                result[_k] = _html.unescape(result[_k])

        # Reject aggregator / data-broker sites
        if result['website']:
            ws_domain = urlparse(result['website']).netloc.replace('www.', '')
            if any(ws_domain == s or ws_domain.endswith('.' + s) for s in _SKIP_DOMAINS):
                result['website'] = None

    except Exception as e:
        print(f"LinkedIn scrape error for {linkedin_url}: {e}")

    # Jina fallback — only if not already attempted at the top (avoids double-fetch).
    if not fast and not _jina_attempted:
        missing_key = not result.get('industry') or not result.get('employee_count') or not result.get('specialties')
        if missing_key:
            try:
                jina_md = _jina_fetch_linkedin_md(linkedin_url)
                if jina_md:
                    _parse_jina_linkedin_md(jina_md, result)
            except Exception:
                pass

    return result
