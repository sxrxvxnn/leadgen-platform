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
    words = re.sub(r'[^a-z0-9 ]', '', name.lower()).split()
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


def _domain_is_relevant(domain: str, company_name: str) -> bool:
    """Check if a domain plausibly belongs to the company (not a directory/news site)."""
    # Strip common TLDs and check if any company word appears in the domain
    name_words = [w for w in re.sub(r'[^a-z0-9 ]', '', company_name.lower()).split() if len(w) > 2]
    domain_clean = re.sub(r'\.(com|io|co|in|net|org|ai|app|tech|dev)$', '', domain.lower())
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
                        if any(s in domain for s in _SKIP_DOMAINS):
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
    """Search DuckDuckGo for company's LinkedIn page URL directly."""
    query = f"{company_name} linkedin.com/company"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    try:
        res = requests.get(
            'https://html.duckduckgo.com/html/',
            params={'q': query, 'kl': 'us-en'},
            headers=headers,
            timeout=10
        )
        soup = BeautifulSoup(res.text, 'html.parser')
        for link in soup.select('a.result__a'):
            href = link.get('href', '')
            if 'uddg=' in href:
                parsed = urlparse(href if href.startswith('http') else 'https:' + href)
                params = parse_qs(parsed.query)
                url = params.get('uddg', [None])[0]
                if url:
                    url = unquote(url)
                    match = re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', url)
                    if match:
                        slug = match.group(1)
                        if slug not in ('linkedin', 'company', 'showcase', 'school'):
                            return f'https://www.linkedin.com/company/{slug}/'
    except Exception as e:
        print(f"DuckDuckGo LinkedIn search error: {e}")
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


_LI_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
}


def scrape_linkedin_data(linkedin_url: str) -> dict:
    """Scrape public LinkedIn company page for followers, location, employee count, description."""
    result = {
        'followers': None,
        'location': None,
        'employee_count': None,
        'description': None,
        'industry': None,
    }
    try:
        url = linkedin_url.rstrip('/') + '/'
        res = requests.get(url, headers=_LI_HEADERS, timeout=15, allow_redirects=True)
        if res.status_code != 200:
            return result
        html = res.text
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

    except Exception as e:
        print(f"LinkedIn scrape error for {linkedin_url}: {e}")
    return result
