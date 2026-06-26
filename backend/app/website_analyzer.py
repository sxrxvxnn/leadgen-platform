import requests
from bs4 import BeautifulSoup
import re
import json


def fetch_website_content(url: str, fast: bool = False) -> dict:
    """Scrape and parse website content.
    fast=True: 4s timeout, only meta/footer extracted — for bulk autofill where speed matters.
    """
    if not url:
        return None
    if not url.startswith('http'):
        url = 'https://' + url
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        # (connect_timeout, read_timeout) — fast mode fails on bad hosts in 2s not 4s
        timeout = (2, 4) if fast else (5, 12)
        try:
            res = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        except requests.exceptions.SSLError:
            # Many Indian IT company sites have cert mismatches — retry without verification
            try:
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    res = requests.get(url, headers=headers, timeout=timeout,
                                       allow_redirects=True, verify=False)
            except Exception:
                return None
        if res.status_code != 200:
            return None
        soup = BeautifulSoup(res.text, 'html.parser')

        # Extract meta tags BEFORE decomposing (they're removed in the strip step)
        meta_desc_tag = (
            soup.find('meta', attrs={'name': re.compile(r'^description$', re.I)}) or
            soup.find('meta', attrs={'property': re.compile(r'^og:description$', re.I)}) or
            soup.find('meta', attrs={'name': re.compile(r'^twitter:description$', re.I)})
        )
        meta_description = (meta_desc_tag.get('content', '') if meta_desc_tag else '').strip()

        # Extract LinkedIn company URL from page links (before soup is modified)
        linkedin_url_in_html = None
        for a_tag in soup.find_all('a', href=True):
            href = a_tag.get('href', '')
            m = re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', href)
            if m:
                slug = m.group(1)
                if slug not in ('linkedin', 'company', 'showcase', 'school', ''):
                    linkedin_url_in_html = f'https://www.linkedin.com/company/{slug}/'
                    break

        for tag in soup(['script', 'style', 'noscript', 'svg', 'img']):
            tag.decompose()

        footer_text = ''
        footer = soup.find('footer') or soup.find(id=re.compile(r'footer', re.I))
        if footer:
            footer_text = footer.get_text(separator=' ', strip=True)[:1000]

        full_text = soup.get_text(separator=' ', strip=True)[:4000]

        # First real paragraph — better fallback than full_text[:300] which picks up nav items
        first_para = ''
        for p in soup.find_all('p'):
            txt = p.get_text(strip=True)
            if len(txt) > 60:  # skip short nav/label paragraphs
                first_para = txt[:300]
                break

        # In fast mode skip the heavy selectors (header/nav/hero/pricing/login buttons)
        header_text = ''
        nav_text    = ''
        hero_text   = ''
        pricing_text = ''
        has_login   = False

        if not fast:
            header = soup.find('header') or soup.find(id=re.compile(r'header', re.I)) or soup.find(class_=re.compile(r'header|navbar', re.I))
            if header:
                header_text = header.get_text(separator=' ', strip=True)[:1000]

            nav = soup.find('nav')
            if nav:
                nav_text = nav.get_text(separator=' ', strip=True)[:500]

            main = soup.find('main') or soup.find(id=re.compile(r'main|hero|home', re.I))
            if main:
                hero_text = main.get_text(separator=' ', strip=True)[:1500]

            pricing = soup.find(id=re.compile(r'pricing|plans', re.I)) or soup.find(class_=re.compile(r'pricing|plans', re.I))
            if pricing:
                pricing_text = pricing.get_text(separator=' ', strip=True)[:500]

            # Only true login/auth signals — exclude demo CTAs which are common on service sites
            login_strong_keywords = [
                'sign in', 'log in', 'login', 'sign up',
                'create account', 'register',
                'free trial', 'start free trial', 'try for free',
                'start free', 'try free',
            ]
            # Pricing signals are the most reliable product indicator
            pricing_keywords = [
                'per month', 'per year', '/month', '/year',
                'billed monthly', 'billed annually',
                'pricing plan', 'choose a plan', 'upgrade plan',
                'subscription plan', 'monthly plan', 'annual plan',
                'per user', 'per seat',
            ]
            full_lower = full_text.lower()
            has_login = any(k in full_lower for k in login_strong_keywords)
            has_pricing_text = any(k in full_lower for k in pricing_keywords)
            if has_pricing_text and not pricing_text:
                pricing_text = "PRICING SIGNALS FOUND IN PAGE TEXT"
            login_buttons = soup.find_all(
                ['a', 'button'],
                string=re.compile(r'sign in|log in|login|sign up|start free|try free|free trial|start trial|create account', re.I)
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

        # Location extraction from footer / schema / contact patterns
        location = None
        loc_sources = footer_text + ' ' + full_text[:2000]
        # Try "City, State/Country" pattern typical in Indian IT companies
        loc_match = re.search(
            r'\b(Trivandrum|Thiruvananthapuram|Kochi|Ernakulam|Bangalore|Bengaluru|Chennai|Hyderabad|'
            r'Mumbai|Delhi|Pune|Noida|Gurgaon|Gurugram|Kolkata|Ahmedabad|Coimbatore|Calicut|'
            r'Kozhikode|Thrissur|Kottayam|Kollam)[,\s]+(?:Kerala|Karnataka|Tamil Nadu|Maharashtra|'
            r'Telangana|Andhra Pradesh|Uttar Pradesh|India)?',
            loc_sources, re.I
        )
        if loc_match:
            location = loc_match.group(0).strip().rstrip(',').strip()
        else:
            # Generic "headquartered in / based in" pattern
            gen_match = re.search(
                r'(?:headquartered|based|located|offices?)\s+in\s+([A-Z][^,\n.]{2,35}(?:,\s*[A-Z][^,\n.]{2,25})?)',
                loc_sources, re.I
            )
            if gen_match:
                location = gen_match.group(1).strip()

        return {
            'url': url,
            'header': header_text,
            'footer': footer_text,
            'nav': nav_text,
            'hero': hero_text,
            'pricing': pricing_text,
            'full_text': full_text,
            'has_login_detected': has_login,
            'has_pricing_detected': has_pricing_text if not fast else False,
            'compliance_detected': found_compliance,
            'meta_description': meta_description,
            'first_para': first_para,
            'location': location,
            'linkedin_url': linkedin_url_in_html,
        }
    except Exception:
        return None


def build_analysis_prompt(website_data: dict, company_name: str) -> str:
    pre_detected_login   = website_data.get('has_login_detected', False)
    pre_detected_pricing = website_data.get('has_pricing_detected', False)
    pre_detected_compliance = website_data.get('compliance_detected', [])

    content = f"""HEADER/NAV:
{website_data.get('header', '')[:500]}
{website_data.get('nav', '')[:300]}

HERO/MAIN CONTENT:
{website_data.get('hero', '')[:1200]}

FOOTER:
{website_data.get('footer', '')[:500]}

PRICING SECTION:
{website_data.get('pricing', '')[:500]}

ADDITIONAL PAGE TEXT (first 800 chars):
{website_data.get('full_text', '')[:800]}"""

    return f"""Analyze the website of company "{company_name}".

FACTS CONFIRMED BY HTML SCRAPING (treat as ground truth):
- Actual login/signup buttons detected: {pre_detected_login}
- Subscription pricing text detected (/month, /year, per-seat, etc.): {pre_detected_pricing}
- Compliance standards found: {pre_detected_compliance}

WEBSITE CONTENT:
{content}

Return ONLY this JSON (no markdown, no explanation):
{{
  "company_type": "Product" or "Service" or "Hybrid",
  "company_type_reason": "one sentence explaining the evidence",
  "classification": "one of: Fintech, Healthtech, SaaS, Cybersecurity, IT Services, E-commerce, Edtech, Logistics, Manufacturing, Banking, Insurance, VC / Investment, Media, Consulting, Retail, Real Estate, Government, Non-profit, Other",
  "is_saas": true or false,
  "is_saas_reason": "one sentence",
  "target_market": "B2B" or "B2C" or "Both" or "Unknown",
  "has_login": true or false,
  "login_evidence": "what login elements were found",
  "compliance": ["array of compliance standards"],
  "compliance_evidence": "what compliance text was found",
  "products_or_services": ["list the actual product names or service names, max 5, be specific"],
  "website_summary": "2-3 sentence summary of what the company does"
}}

CLASSIFICATION RULES — read every rule carefully:

company_type:
- "Product" = the company sells software that customers pay to ACCESS or USE. Must have: pricing plans, free trial, subscription, or self-serve sign-up. The customer pays to use the product, not to hire the company.
- "Service" = the company sells expertise, time, or people. They build things FOR clients (custom software, consulting, staffing, outsourcing, digital agencies). No self-serve pricing — customers contact them for a quote.
- "Hybrid" = the company BOTH sells its own priced product AND offers professional services/consulting. Both revenue streams are clearly present.
- When uncertain between Product and Service: if there is NO subscription pricing page and NO self-serve trial → default to Service.
- Most Indian IT/software companies (Technopark, Bangalore, Kerala, Kochi) are Service even if they mention "platform" or "solution" — without a pricing page these words mean nothing.

is_saas:
- true ONLY when ALL of these are true: (1) company_type is Product or Hybrid, (2) the product is delivered over the internet/cloud, (3) customers pay on a subscription basis (monthly/annual/per-seat pricing).
- false when: company_type is Service, OR the product is on-premise/downloadable/one-time license, OR pricing is enterprise-only with no self-serve plans.
- IMPORTANT: "Service" company_type always means is_saas must be false. A consulting firm is never SaaS.

classification:
- Use "SaaS" only as the classification when the primary product is a generic cloud SaaS platform and no other industry label fits better.
- Prefer the specific vertical: a SaaS cybersecurity company → "Cybersecurity", not "SaaS". A SaaS HR tool → "Other" or best fit.
- "IT Services" = outsourcing, consulting, staffing, custom software development firms.

products_or_services:
- List the ACTUAL named products or specific services the company offers (e.g. "Vulnerability scanner", "Staff augmentation", "HRMS platform", "Mobile app development").
- Do NOT list generic buzzwords like "Digital transformation", "Innovation", "Solutions". Be specific.
- Always include all pre-detected compliance in compliance array
- If login pre-detected as true AND pricing pre-detected as true → Product or Hybrid (strong signal)
- If login pre-detected as true BUT pricing pre-detected as false → could be a client portal for a Service company — look for service keywords before defaulting to Product"""


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

    # Enforce consistency: Service companies are never SaaS
    company_type = result.get('company_type', '')
    if company_type == 'Service':
        result['is_saas'] = False

    # If no subscription pricing detected and company_type is still Product, verify
    if not website_data.get('has_pricing_detected') and company_type == 'Product':
        # Downgrade confidence — let the caller decide; don't force-flip here
        result['_low_pricing_confidence'] = True

    return result


def analyze_with_gemini(website_data: dict, company_name: str, gemini_key: str) -> dict:
    """Use Google Gemini 2.0 Flash — free, accurate, generous quota."""
    if not gemini_key or not website_data:
        return {}
    prompt = build_analysis_prompt(website_data, company_name)
    try:
        res = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}',
            headers={'Content-Type': 'application/json'},
            json={
                'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 800}
            },
            timeout=30
        )
        data = res.json()
        if 'error' in data:
            return {}
        content = data['candidates'][0]['content']['parts'][0]['text']
        result = parse_ai_response(content)
        return force_override_with_scraped(result, website_data)
    except Exception:
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
            return {'_openai_error': data['error'].get('message', 'unknown error')}
        content = data['choices'][0]['message']['content']
        result = parse_ai_response(content)
        return force_override_with_scraped(result, website_data)
    except Exception:
        return {}


def analyze_with_groq(website_data: dict, company_name: str, industry: str, description: str, groq_key: str) -> dict:
    """Use Groq Llama 70B — free, fast, good for classification."""
    if not groq_key:
        return {}
    prompt = build_analysis_prompt(website_data, company_name) if website_data else f"""Company: {company_name}
Industry: {industry or 'Unknown'}
Description: {description or 'No description'}

Return ONLY this JSON:
{{"company_type": "Product" or "Services" or "Hybrid", "company_type_reason": "one sentence", "classification": "one of: Fintech, Healthtech, SaaS, Cybersecurity, IT Services, E-commerce, Edtech, Logistics, Manufacturing, Banking, Insurance, VC / Investment, Media, Consulting, Retail, Real Estate, Government, Non-profit, Other", "is_saas": true or false, "target_market": "B2B" or "B2C" or "Both" or "Unknown", "has_login": false, "login_evidence": "No website analyzed", "compliance": [], "compliance_evidence": "No website analyzed", "products_or_services": [], "website_summary": "Based on company name and industry only."}}"""

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
        if 'error' in data or 'choices' not in data:
            return {}
        content = data['choices'][0]['message']['content']
        result = parse_ai_response(content)
        if website_data:
            result = force_override_with_scraped(result, website_data)
        return result
    except Exception:
        return {}


def classify_with_groq(company_name: str, industry: str, description: str, groq_key: str) -> dict:
    """Quick Groq classification without website — used when no website available."""
    return analyze_with_groq(None, company_name, industry, description, groq_key)


# Default OpenRouter model — free, fast, strong reasoning
OPENROUTER_DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free"


def analyze_with_openrouter(
    website_data: dict,
    company_name: str,
    openrouter_key: str,
    model: str = OPENROUTER_DEFAULT_MODEL,
) -> dict:
    """Use OpenRouter — 400+ models via one API, OpenAI-compatible format."""
    if not openrouter_key:
        return {}
    prompt = build_analysis_prompt(website_data, company_name) if website_data else f"""Company: {company_name}

Return ONLY this JSON:
{{"company_type": "Product" or "Services" or "Hybrid", "company_type_reason": "one sentence", "classification": "one of: Fintech, Healthtech, SaaS, Cybersecurity, IT Services, E-commerce, Edtech, Logistics, Manufacturing, Banking, Insurance, VC / Investment, Media, Consulting, Retail, Real Estate, Government, Non-profit, Other", "is_saas": true or false, "target_market": "B2B" or "B2C" or "Both" or "Unknown", "has_login": false, "login_evidence": "", "compliance": [], "compliance_evidence": "", "products_or_services": [], "website_summary": "Based on company name only."}}"""

    try:
        res = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {openrouter_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://leadgen.app',
                'X-Title': 'Leadgen Platform',
            },
            json={
                'model': model,
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 800,
                'temperature': 0.1,
            },
            timeout=30,
        )
        data = res.json()
        if 'error' in data or 'choices' not in data:
            return {}
        content = data['choices'][0]['message']['content']
        result = parse_ai_response(content)
        if website_data:
            result = force_override_with_scraped(result, website_data)
        return result
    except Exception:
        return {}


def classify_company_type_rules(website_data: dict | None, description: str = "") -> tuple:
    """Deterministic rule-based Product/Service/Hybrid classifier.

    Runs BEFORE the AI call. High-confidence results skip AI entirely.
    Returns (type | None, confidence: 'High'|'Medium'|'Low').

    Design principles:
    - Structural signals (login button, pricing section) are the most reliable product indicators
    - Absence of login+pricing+trial on an accessible site strongly suggests Service
    - 'platform', 'dashboard', 'solution' are NOT product signals — service companies use them constantly
    - Indian IT companies (Technopark context) default to Service when ambiguous
    """
    text = description.lower()
    if website_data:
        text += " " + " ".join([
            website_data.get("header", ""),
            website_data.get("hero", ""),
            website_data.get("nav", ""),
            website_data.get("footer", ""),
            website_data.get("pricing", ""),
            website_data.get("full_text", "")[:2000],
        ]).lower()

    # ── Structural signals (most reliable) ────────────────────────
    has_login        = bool(website_data and website_data.get("has_login_detected"))
    # has_pricing: either a dedicated pricing section was scraped OR subscription text found in page
    has_pricing      = bool(website_data and (
        website_data.get("pricing", "").strip() or
        website_data.get("has_pricing_detected")
    ))
    site_loaded = bool(website_data)  # could we even fetch the site?

    # ── Product signals ────────────────────────────────────────────
    # Strong: self-serve pricing/trial language — only product companies use these
    product_strong = [
        'free trial', 'start free trial', 'try for free', 'try free',
        'sign up free', 'get started free',
        'per month', 'per year', '/month', '/year', 'billed monthly', 'billed annually',
        'pricing plan', 'choose a plan', 'upgrade plan', 'monthly plan', 'annual plan',
        'subscription plan', 'saas', 'software as a service',
        # Mobile app signals — only companies shipping their own app have these
        'download on the app store', 'available on the app store',
        'get it on google play', 'available on google play',
        'download our app', 'download the app', 'get the app',
        'app store and google play', 'ios and android',
    ]
    # Weak: suggestive but service companies also say these
    product_weak = [
        'product-based', 'product company', 'white label', 'white-label',
        'our software product', 'software product',
        'mobile app', 'our app',  # weaker — service firms also say "we build mobile apps"
    ]
    # Counter-signals: product_weak hits don't count when these are present
    # (service company building a product FOR clients, not selling it as SaaS)
    for_client_signals = [
        'for our clients', 'for your business', 'for your industry', 'for enterprises',
        'for your team', 'build for you', 'built for you', 'tailored for',
        'we build for', 'we develop for',
    ]

    # ── Service signals ────────────────────────────────────────────
    # Strong: explicitly describes a services business model
    service_strong = [
        'it services', 'software services', 'managed services', 'managed service provider',
        'consulting services', 'outsourcing', 'staff augmentation', 'body shopping',
        'offshore development', 'onshore development', 'nearshore development',
        'delivery center', 'engineering services', 'development services',
        'service provider', 'technology services', 'digital services',
        'it solutions and services', 'software development services',
        'software development company', 'it company', 'it firm',
        'technology company', 'tech company', 'digital agency',
        'solutions company', 'engineering company', 'it consulting',
        'dedicated team', 'hire developers', 'hire our', 'talent solutions',
        'digital transformation services', 'digital transformation company',
        'erp implementation', 'crm implementation', 'system integration',
        'software delivery', 'agile delivery', 'project delivery',
    ]
    # Weak: pattern common in service companies, less definitive
    service_weak = [
        'for our clients', 'client engagement', 'client projects', 'client work',
        'custom development', 'bespoke', 'tailored solutions', 'custom software',
        'resource augmentation', 'workforce solutions', 'talent',
        'digital transformation',  # used almost exclusively by IT service firms
        'contact us to', 'talk to our', 'get in touch',  # service-only primary CTA
        'we partner with', 'our expertise', 'our capabilities',
    ]

    p_strong_count = sum(1 for s in product_strong if s in text)
    s_strong_count = sum(1 for s in service_strong if s in text)
    s_weak_count   = sum(1 for s in service_weak   if s in text)

    # Only count product_weak if no "for-client" language is present
    has_for_client = any(s in text for s in for_client_signals)
    p_weak_count   = 0 if has_for_client else sum(1 for s in product_weak if s in text)

    # ── Scoring ────────────────────────────────────────────────────
    # Structural product signals (most reliable)
    if has_login:   p_strong_count += 3
    if has_pricing: p_strong_count += 2

    p_score = p_strong_count * 2 + p_weak_count
    s_score = s_strong_count * 2 + s_weak_count

    # ── Decision tree ──────────────────────────────────────────────

    # Tier 1: Structural + keyword combination → very high confidence
    if has_login and has_pricing and s_strong_count == 0:
        return "Product", "High"
    if has_login and has_pricing and s_strong_count >= 1:
        return "Hybrid", "High"

    # Tier 2: Strong explicit service keywords → high confidence
    if s_strong_count >= 2:
        return "Service", "High"
    if s_strong_count >= 1 and not has_login and not has_pricing:
        return "Service", "High"

    # Tier 3: Strong product keywords without service signals
    if p_strong_count >= 5 and s_score == 0:
        return "Product", "High"
    if p_strong_count >= 3 and s_score <= 1:
        return "Product", "Medium"
    if has_login and p_strong_count >= 1 and s_strong_count == 0:
        return "Product", "Medium"

    # Tier 4: One explicit service keyword with some product language → Hybrid
    if s_strong_count >= 1 and p_score >= 3:
        return "Hybrid", "Medium"

    # Tier 5: Weak signals
    if s_score >= 4 and p_score <= 1:
        return "Service", "Medium"
    if p_score >= 4 and s_score == 0:
        return "Product", "Medium"
    if s_weak_count >= 2 and not has_login and not has_pricing and p_strong_count == 0:
        return "Service", "Medium"

    # Tier 6: Site loaded with real content but no product signals → lean Service
    # Rationale: product companies NEED login + pricing on their site by definition.
    # Only fire if we got substantial text (not a JS shell that returned near-empty content).
    meaningful_content = site_loaded and len(text.strip()) > 200
    if meaningful_content and not has_login and not has_pricing and p_strong_count == 0:
        return "Service", "Low"   # AI will verify, but bias is correct for Indian IT context

    return None, "Low"


# Keep backward compatibility
def analyze_website_with_openai(website_data: dict, company_name: str, openai_key: str) -> dict:
    return analyze_with_openai(website_data, company_name, openai_key)