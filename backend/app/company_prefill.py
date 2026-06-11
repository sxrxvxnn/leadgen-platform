import re
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import unquote, urlparse, parse_qs


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
            if r.status_code < 400:
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
    # 1. Try guessing the domain directly first (fastest, most accurate for known companies)
    guessed = _guess_domain(company_name)
    if guessed:
        return guessed

    # 2. Search with ddgs and require the domain to be relevant to the company name
    try:
        from ddgs import DDGS
        queries = [
            f'"{company_name}" official website',
            f'{company_name} company official site',
        ]
        with DDGS() as ddgs:
            for q in queries:
                try:
                    for r in ddgs.text(q, max_results=8):
                        href = r.get('href', '')
                        title = r.get('title', '')
                        if not href:
                            continue
                        domain = urlparse(href).netloc.replace('www.', '')
                        # Match whole domain (not substring) to avoid "x.com" hitting "sequantix.com"
                        if any(domain == s or domain.endswith('.' + s) for s in _SKIP_DOMAINS):
                            continue
                        # Require domain or title to mention the company
                        if _domain_is_relevant(domain, company_name) or company_name.lower() in title.lower():
                            return href
                except Exception:
                    continue
    except ImportError:
        pass
    except Exception as e:
        print(f"DDGS search error: {e}")

    return None


def search_linkedin_url_direct(company_name: str) -> str | None:
    """Search for company's LinkedIn page URL using ddgs."""
    queries = [
        f'site:linkedin.com/company "{company_name}"',
        f'{company_name} linkedin company page',
    ]
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            for q in queries:
                try:
                    for r in ddgs.text(q, max_results=6):
                        href = r.get('href', '') or r.get('url', '')
                        match = re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', href)
                        if match:
                            slug = match.group(1)
                            if slug not in ('linkedin', 'company', 'showcase', 'school', 'about'):
                                return f'https://www.linkedin.com/company/{slug}/'
                except Exception:
                    continue
    except ImportError:
        pass
    except Exception as e:
        print(f"DDGS LinkedIn search error: {e}")
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


def _fetch_linkedin_html(url: str) -> str | None:
    """Try fetching a LinkedIn URL with multiple user agents, return HTML on first 200."""
    for ua in _LI_UA_LIST:
        try:
            r = requests.get(url, headers={**_LI_HEADERS, 'User-Agent': ua},
                             timeout=14, allow_redirects=True)
            if r.status_code == 200 and len(r.text) > 3000:
                return r.text
        except Exception:
            continue
    return None


def scrape_linkedin_data(linkedin_url: str) -> dict:
    """Scrape public LinkedIn company page for followers, location, employee count, description."""
    result = {
        'followers': None,
        'location': None,
        'employee_count': None,
        'description': None,
        'industry': None,
        'website': None,
    }
    try:
        url = linkedin_url.rstrip('/') + '/'
        html = _fetch_linkedin_html(url)
        if not html:
            return result
        soup = BeautifulSoup(html, 'html.parser')

        # --- Followers from og:description: "Company | 1,234,567 followers on LinkedIn" ---
        og_desc = soup.find('meta', {'property': 'og:description'}) or soup.find('meta', {'name': 'description'})
        if og_desc:
            desc_content = og_desc.get('content', '')
            m = re.search(r'([\d,]+)\s*followers', desc_content, re.I)
            if m:
                result['followers'] = m.group(0).strip()

        # --- JSON-LD Organization block: address, numberOfEmployees, description ---
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '')
                items = data.get('@graph', [data]) if isinstance(data, dict) else [data]
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    if item.get('@type') == 'Organization':
                        # Location
                        addr = item.get('address', {})
                        if isinstance(addr, dict):
                            parts = [
                                addr.get('addressLocality'),
                                addr.get('addressRegion'),
                                addr.get('addressCountry'),
                            ]
                            parts = [p for p in parts if p]
                            if parts:
                                result['location'] = ', '.join(parts)
                        # Employee count
                        emp = item.get('numberOfEmployees', {})
                        if isinstance(emp, dict) and emp.get('value'):
                            result['employee_count'] = str(emp['value'])
                        # Description
                        if item.get('description') and not result['description']:
                            result['description'] = item['description'][:300]
                        # Website URL from Organization.url or sameAs
                        if not result['website']:
                            org_url = item.get('url', '')
                            if org_url and 'linkedin.com' not in org_url:
                                result['website'] = org_url
                        if not result['website']:
                            same_as = item.get('sameAs') or []
                            if isinstance(same_as, str):
                                same_as = [same_as]
                            for same in same_as:
                                if isinstance(same, str) and 'linkedin.com' not in same and same.startswith('http'):
                                    result['website'] = same
                                    break
                        break
            except Exception:
                pass

        # --- Fallback: followers from page text ---
        if not result['followers']:
            m = re.search(r'([\d,]+)\s*followers', html, re.I)
            if m:
                result['followers'] = m.group(0).strip()

        # --- Fallback: location from page body ---
        if not result['location']:
            m = re.search(r'data-test-id="about-us__headquarters"[^>]*>.*?Headquarters.*?<[^<]{0,10}>\s*([^<]{5,60})<', html, re.S)
            if m:
                result['location'] = m.group(1).strip()

        # --- Fallback: website from page body (LinkedIn shows it in about section) ---
        if not result['website']:
            # Pattern: link in the about section that is external (not linkedin.com)
            m = re.search(r'href="(https?://(?!(?:www\.)?linkedin\.com)[^"]{5,100})"[^>]*>\s*(?:Website|Visit website|website)', html, re.I)
            if m:
                result['website'] = m.group(1)

    except Exception as e:
        print(f"LinkedIn scrape error for {linkedin_url}: {e}")
    return result
