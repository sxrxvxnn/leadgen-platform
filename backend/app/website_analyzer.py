import requests
from bs4 import BeautifulSoup
import re
import json


def fetch_website_content(url: str) -> dict:
    if not url:
        return None
    if not url.startswith('http'):
        url = 'https://' + url
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        res = requests.get(url, headers=headers, timeout=12, allow_redirects=True)
        if res.status_code != 200:
            return None
        soup = BeautifulSoup(res.text, 'html.parser')
        for tag in soup(['script', 'style', 'meta', 'noscript', 'svg', 'img']):
            tag.decompose()

        header_text = ''
        footer_text = ''
        nav_text = ''
        hero_text = ''
        pricing_text = ''

        header = soup.find('header') or soup.find(id=re.compile(r'header', re.I)) or soup.find(class_=re.compile(r'header|navbar', re.I))
        if header:
            header_text = header.get_text(separator=' ', strip=True)[:1000]

        footer = soup.find('footer') or soup.find(id=re.compile(r'footer', re.I))
        if footer:
            footer_text = footer.get_text(separator=' ', strip=True)[:1000]

        nav = soup.find('nav')
        if nav:
            nav_text = nav.get_text(separator=' ', strip=True)[:500]

        main = soup.find('main') or soup.find(id=re.compile(r'main|hero|home', re.I))
        if main:
            hero_text = main.get_text(separator=' ', strip=True)[:1500]

        pricing = soup.find(id=re.compile(r'pricing|plans', re.I)) or soup.find(class_=re.compile(r'pricing|plans', re.I))
        if pricing:
            pricing_text = pricing.get_text(separator=' ', strip=True)[:500]

        full_text = soup.get_text(separator=' ', strip=True)[:4000]

        login_keywords = ['sign in', 'log in', 'login', 'sign up', 'get started',
                         'start free', 'try free', 'create account', 'register',
                         'free trial', 'start trial', 'get access', 'book a demo',
                         'request demo', 'schedule demo']
        has_login = any(k.lower() in full_text.lower() for k in login_keywords)
        login_buttons = soup.find_all(
            ['a', 'button'],
            string=re.compile(r'sign in|log in|login|sign up|get started|start free|try free|free trial|start trial|get access', re.I)
        )
        has_login = has_login or len(login_buttons) > 0

        compliance_map = {
            'SOC 2': ['soc 2', 'soc2', 'soc ii'],
            'ISO 27001': ['iso 27001', 'iso27001'],
            'GDPR': ['gdpr'],
            'HIPAA': ['hipaa'],
            'PCI DSS': ['pci dss', 'pci-dss'],
            'OWASP': ['owasp'],
            'CERT-In': ['cert-in', 'cert in'],
        }
        found_compliance = []
        for name, keywords in compliance_map.items():
            if any(k.lower() in full_text.lower() for k in keywords):
                found_compliance.append(name)

        return {
            'url': url,
            'header': header_text,
            'footer': footer_text,
            'nav': nav_text,
            'hero': hero_text,
            'pricing': pricing_text,
            'full_text': full_text,
            'has_login_detected': has_login,
            'compliance_detected': found_compliance,
        }
    except Exception as e:
        print(f"Website fetch error for {url}: {e}")
        return None


def build_analysis_prompt(website_data: dict, company_name: str) -> str:
    pre_detected_login = website_data.get('has_login_detected', False)
    pre_detected_compliance = website_data.get('compliance_detected', [])

    content = f"""HEADER/NAV:
{website_data.get('header', '')[:500]}
{website_data.get('nav', '')[:300]}

HERO/MAIN CONTENT:
{website_data.get('hero', '')[:1000]}

FOOTER:
{website_data.get('footer', '')[:500]}

PRICING SECTION:
{website_data.get('pricing', '')[:300]}"""

    return f"""Analyze the website of company "{company_name}".

FACTS CONFIRMED BY HTML SCRAPING (treat as 100% accurate):
- Login/signup buttons found: {pre_detected_login}
- Compliance standards found: {pre_detected_compliance}

WEBSITE CONTENT:
{content}

Return ONLY this JSON (no markdown, no explanation):
{{
  "company_type": "Product" or "Services" or "Hybrid",
  "company_type_reason": "one sentence",
  "is_saas": true or false,
  "target_market": "B2B" or "B2C" or "Both" or "Unknown",
  "has_login": true or false,
  "login_evidence": "what login elements were found",
  "compliance": ["array of compliance standards"],
  "compliance_evidence": "what compliance text was found",
  "products_or_services": ["list max 5"],
  "website_summary": "2-3 sentence summary"
}}

RULES:
- If login pre-detected as true, set has_login to true
- Include all pre-detected compliance in compliance array
- SaaS/product companies have pricing pages, trials, dashboards
- Services companies offer consulting, outsourcing, custom work"""


def parse_ai_response(content: str) -> dict:
    content = content.strip()
    content = re.sub(r'^```json\s*', '', content)
    content = re.sub(r'^```\s*', '', content)
    content = re.sub(r'\s*```$', '', content)
    return json.loads(content)


def force_override_with_scraped(result: dict, website_data: dict) -> dict:
    """Always override AI result with ground truth HTML scraping data."""
    if website_data.get('has_login_detected'):
        result['has_login'] = True
    if website_data.get('compliance_detected'):
        existing = result.get('compliance', [])
        result['compliance'] = list(set(website_data['compliance_detected'] + existing))
    return result


def analyze_with_gemini(website_data: dict, company_name: str, gemini_key: str) -> dict:
    """Use Google Gemini Flash — free, accurate, generous quota."""
    if not gemini_key or not website_data:
        return {}
    prompt = build_analysis_prompt(website_data, company_name)
    try:
        res = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}',
            headers={'Content-Type': 'application/json'},
            json={
                'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 800}
            },
            timeout=30
        )
        data = res.json()
        if 'error' in data:
            print(f"Gemini error: {data['error']}")
            return {}
        content = data['candidates'][0]['content']['parts'][0]['text']
        result = parse_ai_response(content)
        return force_override_with_scraped(result, website_data)
    except Exception as e:
        print(f"Gemini analysis error: {e}")
        return {}


def analyze_with_openai(website_data: dict, company_name: str, openai_key: str) -> dict:
    """Use GPT-4o — most accurate but paid."""
    if not openai_key or not website_data:
        return {}
    prompt = build_analysis_prompt(website_data, company_name)
    try:
        res = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {openai_key}', 'Content-Type': 'application/json'},
            json={
                'model': 'gpt-4o',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 800,
                'temperature': 0.1
            },
            timeout=30
        )
        data = res.json()
        if 'error' in data:
            msg = data['error'].get('message', '')
            print(f"OpenAI error: {msg}")
            return {'_openai_error': msg}
        content = data['choices'][0]['message']['content']
        result = parse_ai_response(content)
        return force_override_with_scraped(result, website_data)
    except Exception as e:
        print(f"OpenAI error: {e}")
        return {}


def analyze_with_groq(website_data: dict, company_name: str, industry: str, description: str, groq_key: str) -> dict:
    """Use Groq Llama 70B — free, fast, good for classification."""
    if not groq_key:
        return {}
    prompt = build_analysis_prompt(website_data, company_name) if website_data else f"""Company: {company_name}
Industry: {industry or 'Unknown'}
Description: {description or 'No description'}

Return ONLY this JSON:
{{"company_type": "Product" or "Services" or "Hybrid", "company_type_reason": "one sentence", "is_saas": true or false, "target_market": "B2B" or "B2C" or "Both" or "Unknown", "has_login": false, "login_evidence": "No website analyzed", "compliance": [], "compliance_evidence": "No website analyzed", "products_or_services": [], "website_summary": "Based on company name and industry only."}}"""

    try:
        res = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={'Authorization': f'Bearer {groq_key}', 'Content-Type': 'application/json'},
            json={
                'model': 'llama-3.3-70b-versatile',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 800,
                'temperature': 0.1
            },
            timeout=20
        )
        data = res.json()
        content = data['choices'][0]['message']['content']
        result = parse_ai_response(content)
        if website_data:
            result = force_override_with_scraped(result, website_data)
        return result
    except Exception as e:
        print(f"Groq error: {e}")
        return {}


def classify_with_groq(company_name: str, industry: str, description: str, groq_key: str) -> dict:
    """Quick Groq classification without website — used when no website available."""
    return analyze_with_groq(None, company_name, industry, description, groq_key)


# Keep backward compatibility
def analyze_website_with_openai(website_data: dict, company_name: str, openai_key: str) -> dict:
    return analyze_with_openai(website_data, company_name, openai_key)