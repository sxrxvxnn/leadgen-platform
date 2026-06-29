import requests
from bs4 import BeautifulSoup
import re
import json
from .prompt_security import (
    sanitize_scraped_text, sanitize_company_name, sanitize_description,
    validate_ai_output, SYSTEM_INSTRUCTION,
)


def check_app_store_presence(company_name: str, domain: str = '') -> dict:
    """
    Check whether a company has a mobile app via the iTunes Search API (free, no auth).
    Falls back to domain-keyword matching for confidence.
    Returns {'has_ios_app': bool, 'has_android_app': bool, 'app_name': str}.
    """
    result = {'has_ios_app': False, 'has_android_app': False, 'app_name': ''}
    if not company_name:
        return result

    # Strip common suffixes for cleaner search
    search_term = re.sub(r'\s*(?:pvt\.?|ltd\.?|llc\.?|inc\.?|corp\.?|private\s+limited|limited)\s*$', '', company_name, flags=re.I).strip()
    if not search_term:
        return result

    try:
        res = requests.get(
            'https://itunes.apple.com/search',
            params={'term': search_term, 'entity': 'software', 'country': 'us', 'limit': 5},
            timeout=6,
        )
        if res.status_code == 200:
            data = res.json()
            results = data.get('results', [])
            # Properly parse domain from full URL or bare domain
            from urllib.parse import urlparse as _itup
            _parsed_domain = _itup(domain).netloc if domain and domain.startswith('http') else domain
            domain_root = (_parsed_domain or domain or '').lower().replace('www.', '').split('/')[0].split(':')[0]

            for app in results:
                app_name   = (app.get('trackName', '') or '').lower()
                seller     = (app.get('sellerName', '') or '').lower()
                seller_url = (app.get('sellerUrl', '') or '').lower()

                search_lower = search_term.lower()
                # Match by name/seller OR by seller URL containing the company domain
                name_match   = search_lower in app_name or app_name in search_lower
                domain_match = bool(domain_root and len(domain_root) > 3 and domain_root in seller_url)
                seller_match = search_lower in seller or domain_match

                if name_match or seller_match:
                    result['has_ios_app'] = True
                    result['app_name']    = app.get('trackName', '')
                    break
    except Exception:
        pass

    return result


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

        raw_html = res.text  # keep raw for regex scanning before BeautifulSoup strips JS
        resolved_url = res.url  # canonical URL after following redirects

        # ── SPA bundle scan ─────────────────────────────────────────────────
        # React/Vue SPAs return a shell HTML with an empty <div id="root">.
        # Social links, compliance text, and app store URLs are in JS bundles.
        # We fetch the first main/app bundle and scan it for URLs.
        spa_bundle_text = ""
        _is_spa = bool(re.search(r'<div[^>]+id=["\'](?:root|app|__nuxt|__next)["\']', raw_html, re.I))
        if _is_spa and not fast:
            # Try __NEXT_DATA__ first (Next.js SSR embeds structured JSON)
            _nextdata = re.search(r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>', raw_html, re.S)
            if _nextdata:
                spa_bundle_text += _nextdata.group(1)[:50_000]
            # Find main JS bundle and fetch first 150KB
            _bundle_m = re.search(
                r'<script[^>]+src=["\']([^"\']*(?:main|app|index)[^"\']*\.js(?:\?[^"\']*)?)["\']',
                raw_html, re.I
            )
            if _bundle_m:
                try:
                    from urllib.parse import urljoin as _urljoin
                    _burl = _urljoin(resolved_url, _bundle_m.group(1))
                    _br = requests.get(_burl, headers=headers, timeout=10, stream=True)
                    if _br.status_code == 200:
                        _content = b''
                        for _chunk in _br.iter_content(chunk_size=16384):
                            _content += _chunk
                            if len(_content) >= 150_000:
                                break
                        spa_bundle_text += _content.decode('utf-8', errors='ignore')
                except Exception:
                    pass

        # Combine raw HTML + bundle text for URL scanning
        scan_text = raw_html + spa_bundle_text

        soup = BeautifulSoup(raw_html, 'html.parser')

        # Extract meta tags BEFORE decomposing (they're removed in the strip step)
        meta_desc_tag = (
            soup.find('meta', attrs={'name': re.compile(r'^description$', re.I)}) or
            soup.find('meta', attrs={'property': re.compile(r'^og:description$', re.I)}) or
            soup.find('meta', attrs={'name': re.compile(r'^twitter:description$', re.I)})
        )
        meta_description = (meta_desc_tag.get('content', '') if meta_desc_tag else '').strip()

        # ── HTML-level signals ────────────────────────────────────────────────
        # Use scan_text (raw HTML + JS bundle) so React SPAs surface their links.
        linkedin_url_in_html = None
        has_app_store_link  = bool(re.search(r'apps\.apple\.com|itunes\.apple\.com', scan_text, re.I))
        has_play_store_link = bool(re.search(r'play\.google\.com/store/apps', scan_text, re.I))

        # Social profile URLs extracted from HTML + JS bundle
        _social_pats = {
            'twitter':   re.compile(r'https?://(?:www\.)?(?:twitter|x)\.com/([A-Za-z0-9_]{1,50})', re.I),
            'instagram': re.compile(r'https?://(?:www\.)?instagram\.com/([A-Za-z0-9_.]{1,50})', re.I),
            'youtube':   re.compile(r'https?://(?:www\.)?youtube\.com/(?:c/|channel/|@)?([A-Za-z0-9_\-]{2,80})', re.I),
            'facebook':  re.compile(r'https?://(?:www\.)?facebook\.com/([A-Za-z0-9_.]{3,80})', re.I),
            'linkedin':  re.compile(r'https?://(?:www\.)?linkedin\.com/company/([A-Za-z0-9_-]{1,80})', re.I),
        }
        _skip_handles = {'sharer', 'share', 'login', 'signup', 'intent', 'home', 'watch', 'results', 'search', 'in', 'out', 'tr', 'p'}
        scraped_socials: dict = {}
        for platform, pat in _social_pats.items():
            for m in pat.finditer(scan_text):
                handle = m.group(1).rstrip('/').lower()
                if handle and handle not in _skip_handles and len(handle) > 1:
                    scraped_socials[platform] = m.group(0).split('?')[0]
                    break
        has_web_app_link    = False

        # Apple Smart App Banner meta tag — placed in <head> even by SPAs
        if not has_app_store_link:
            apple_meta = soup.find('meta', attrs={'name': re.compile(r'apple-itunes-app', re.I)})
            if apple_meta:
                has_app_store_link = True

        has_mobile_app = has_app_store_link or has_play_store_link

        try:
            from urllib.parse import urlparse as _urlparse
            _resolved_parsed = _urlparse(resolved_url)
            _base_dom = _resolved_parsed.netloc.replace('www.', '').split(':')[0]
        except Exception:
            _base_dom = ''

        # Also extract LinkedIn URL from scan_text (catches SPAs)
        if not linkedin_url_in_html:
            _li_m = re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', scan_text)
            if _li_m:
                slug = _li_m.group(1)
                if slug not in ('linkedin', 'company', 'showcase', 'school', ''):
                    linkedin_url_in_html = f'https://www.linkedin.com/company/{slug}/'

        for a_tag in soup.find_all('a', href=True):
            href = a_tag.get('href', '') or ''

            # LinkedIn company URL (HTML anchor fallback)
            if not linkedin_url_in_html:
                m = re.search(r'linkedin\.com/company/([a-zA-Z0-9_-]+)', href)
                if m:
                    slug = m.group(1)
                    if slug not in ('linkedin', 'company', 'showcase', 'school', ''):
                        linkedin_url_in_html = f'https://www.linkedin.com/company/{slug}/'

            # App Store (iOS)
            if not has_app_store_link and re.search(r'apps\.apple\.com|itunes\.apple\.com', href, re.I):
                has_app_store_link = True

            # Google Play Store
            if not has_play_store_link and re.search(r'play\.google\.com/store/apps', href, re.I):
                has_play_store_link = True

            # Web app: link to app./dashboard./console./portal. subdomain of this domain
            if not has_web_app_link and _base_dom:
                if re.search(
                    r'https?://(app|dashboard|portal|workspace|console|my|account)\.' + re.escape(_base_dom),
                    href, re.I
                ):
                    has_web_app_link = True

            # Web app: internal link to /login /signin /dashboard /app /console /workspace
            if not has_web_app_link and re.search(
                r'(?:^|/)(?:login|signin|sign-in|sign_in|signup|sign-up|register|dashboard|app|console|workspace)(?:/|$|\?)',
                href, re.I
            ):
                has_web_app_link = True

        # Re-evaluate has_mobile_app after all scans
        has_mobile_app = has_app_store_link or has_play_store_link

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

        # Only real compliance certifications — not frameworks or methodologies
        compliance_map = {
            'SOC 2':    ['soc 2', 'soc2', 'soc ii', 'soc-2', 'soc type ii', 'soc type 2'],
            'ISO 27001':['iso 27001', 'iso27001', 'iso/iec 27001'],
            'GDPR':     ['gdpr compliant', 'gdpr certified', 'general data protection regulation compliant'],
            'HIPAA':    ['hipaa compliant', 'hipaa certified', 'hipaa-compliant'],
            'PCI DSS':  ['pci dss', 'pci-dss', 'pci compliant', 'pci certified'],
            'CCPA':     ['ccpa compliant', 'ccpa certified', 'california consumer privacy'],
            'CERT-In':  ['cert-in certified', 'cert-in empanelled', 'cert in empanelled'],
            'ISO 9001': ['iso 9001'],
            'CSA STAR': ['csa star', 'cloud security alliance'],
        }
        # Scan badge images first (most reliable — actual certification logos)
        badge_scan = ' '.join(
            (t.get('alt', '') + ' ' + t.get('src', ''))
            for t in soup.find_all('img')
        ).lower()
        # Also scan full page text for explicit certification claims
        compliance_scan = badge_scan + ' ' + (full_text + ' ' + scan_text[:10_000]).lower()
        found_compliance = []
        for cert_name, keywords in compliance_map.items():
            if any(k.lower() in compliance_scan for k in keywords):
                found_compliance.append(cert_name)

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
            'resolved_url': resolved_url,   # canonical URL after redirect (e.g. way.com not waycom.io)
            'resolved_domain': _base_dom,   # clean domain of resolved URL
            'header': header_text,
            'footer': footer_text,
            'nav': nav_text,
            'hero': hero_text,
            'pricing': pricing_text,
            'full_text': full_text,
            'has_login_detected': has_login,
            'has_pricing_detected': has_pricing_text if not fast else False,
            'has_mobile_app': has_mobile_app,
            'has_app_store_link': has_app_store_link,
            'has_play_store_link': has_play_store_link,
            'has_web_app_link': has_web_app_link,
            'compliance_detected': found_compliance,
            'social_profiles_detected': scraped_socials,
            'meta_description': meta_description,
            'first_para': first_para,
            'location': location,
            'linkedin_url': linkedin_url_in_html,
        }
    except Exception:
        return None


def build_content_block(website_data: dict) -> str:
    """Build the sanitized website content section for the AI prompt."""
    return (
        f"HEADER/NAV:\n"
        f"{sanitize_scraped_text(website_data.get('header', ''), 500)}\n"
        f"{sanitize_scraped_text(website_data.get('nav', ''), 300)}\n\n"
        f"HERO/MAIN CONTENT:\n"
        f"{sanitize_scraped_text(website_data.get('hero', ''), 1200)}\n\n"
        f"FOOTER:\n"
        f"{sanitize_scraped_text(website_data.get('footer', ''), 500)}\n\n"
        f"PRICING SECTION:\n"
        f"{sanitize_scraped_text(website_data.get('pricing', ''), 500)}\n\n"
        f"ADDITIONAL PAGE TEXT:\n"
        f"{sanitize_scraped_text(website_data.get('full_text', ''), 800)}"
    )


def build_analysis_prompt(website_data: dict, company_name: str) -> str:
    """
    Build the user-turn content for AI classification.
    Instructions live in SYSTEM_INSTRUCTION (system role).
    This function returns only the sanitized content + schema.
    """
    safe_name = sanitize_company_name(company_name)

    pre_detected_login     = website_data.get('has_login_detected', False)
    pre_detected_pricing   = website_data.get('has_pricing_detected', False)
    pre_detected_mobile    = website_data.get('has_mobile_app', False)
    pre_detected_webapp    = website_data.get('has_web_app_link', False)
    pre_detected_appstore  = website_data.get('has_app_store_link', False)
    pre_detected_playstore = website_data.get('has_play_store_link', False)
    pre_detected_compliance = website_data.get('compliance_detected', [])

    content = build_content_block(website_data)

    itunes_app   = website_data.get('_itunes_app_name', '') if website_data else ''
    itunes_found = bool(itunes_app) or (website_data.get('has_mobile_app') and not website_data.get('has_app_store_link') and not website_data.get('has_play_store_link'))

    return f"""Analyze the website of company "{safe_name}".

FACTS CONFIRMED BY AUTOMATED DETECTION (treat as 100% ground truth):
- Login/signup page or button found: {pre_detected_login}
- Subscription pricing text found (/month, /year, per-seat, billed annually): {pre_detected_pricing}
- iOS App Store link found in HTML/JS: {pre_detected_appstore}
- Google Play Store link found in HTML/JS: {pre_detected_playstore}
- Mobile app confirmed via iTunes Search API: {itunes_found}{f" (app: {itunes_app})" if itunes_app else ""}
- Mobile app present (any source): {pre_detected_mobile or itunes_found}
- Web app link found (app.domain, /dashboard, /login, /console): {pre_detected_webapp}
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

CLASSIFICATION RULES — follow exactly:

company_type:
- "Product" = the company has built software (web app, mobile app, SaaS platform) that end-users or businesses USE directly. They own the product. Signals: App Store/Play Store links, web app login, self-serve signup, subscription pricing. The customer pays to access the product.
- "Service" = the company sells expertise, time, or people. They BUILD things for clients or provide consulting/staffing/outsourcing. No product of their own that customers use. Customers contact them for a quote, not self-serve.
- "Hybrid" = company BOTH has its own software product AND offers services/consulting. Both must be clearly present.
- Mobile app detected (App Store or Play Store link) → STRONG Product signal. Use "Product" unless clear evidence they built the app for a client.
- Web app link detected (/login, /dashboard, app.domain.com) → STRONG Product signal. Same exception for client portals.
- Indian IT/software companies (Technopark, Bangalore, Kerala, Kochi) that say "platform" or "solution" WITHOUT a login link or app link → Service (these are marketing words, not products).

is_saas:
- RULE 1: company_type = Service → is_saas MUST be false. Always.
- RULE 2: If a web login, web app, OR mobile app is confirmed → default is_saas = true UNLESS there is explicit evidence of on-premise / one-time license / downloadable desktop software.
- RULE 3: Absence of a visible pricing page does NOT mean Non-SaaS. Enterprise SaaS hides pricing ("Contact Sales"). Mobile apps price via App Store. Treat these as SaaS.
- Non-SaaS signals (only these justify is_saas = false for a Product): "on-premise", "on-prem", "installed locally", "perpetual license", "one-time license", "desktop application", "download and install".
- In short: web app or mobile app → SaaS. On-premise software → Non-SaaS. No software at all → Non-SaaS.

classification:
- Use "SaaS" only as the classification when the primary product is a generic cloud SaaS platform and no other industry label fits better.
- Prefer the specific vertical: a SaaS cybersecurity company → "Cybersecurity", not "SaaS". A SaaS HR tool → "Other" or best fit.
- "IT Services" = outsourcing, consulting, staffing, custom software development firms.

products_or_services:
- List the ACTUAL named products or specific services the company offers (e.g. "Vulnerability scanner", "Staff augmentation", "HRMS platform", "Mobile app development").
- Do NOT list generic buzzwords like "Digital transformation", "Innovation", "Solutions". Be specific.
- compliance: ONLY include certifications explicitly confirmed from the website content above. Do NOT guess or infer from industry. If not found in website content, return [].
- If login pre-detected as true AND pricing pre-detected as true → Product or Hybrid (strong signal)
- If login pre-detected as true BUT pricing pre-detected as false → could be a client portal for a Service company — look for service keywords before defaulting to Product"""


def parse_ai_response(content: str) -> dict:
    content = content.strip()
    content = re.sub(r'^```json\s*', '', content)
    content = re.sub(r'^```\s*', '', content)
    content = re.sub(r'\s*```$', '', content)
    return json.loads(content)


def force_override_with_scraped(result: dict, website_data: dict) -> dict:
    """Override AI result with hard ground-truth facts from HTML scraping."""
    if website_data.get('has_login_detected'):
        result['has_login'] = True
    # Compliance: only use what was actually detected on the website, ignore AI guesses
    # AI tends to hallucinate compliance certs it "expects" a company to have
    detected = website_data.get('compliance_detected', [])
    if detected:
        result['compliance'] = detected
    else:
        result['compliance'] = []

    # Mobile app detected → must be Product or Hybrid, never pure Service
    if website_data.get('has_mobile_app'):
        if result.get('company_type') == 'Service':
            result['company_type'] = 'Product'
            result['company_type_reason'] = (
                result.get('company_type_reason', '') +
                ' [Override: App Store/Play Store link found — company ships its own app.]'
            )

    # Normalise "Services" → "Service"
    if result.get('company_type') == 'Services':
        result['company_type'] = 'Service'

    # Hard rule: Service → never SaaS
    if result.get('company_type') == 'Service':
        result['is_saas'] = False

    # If Product/Hybrid and AI said non-SaaS, check if web/mobile delivery
    # contradicts that — a web login or mobile app IS SaaS delivery by definition
    elif result.get('company_type') in ('Product', 'Hybrid') and result.get('is_saas') is False:
        has_mobile  = website_data.get('has_mobile_app')
        has_web_app = website_data.get('has_web_app_link')
        has_login   = website_data.get('has_login_detected')
        full_lower  = website_data.get('full_text', '').lower()
        non_saas_override = any(s in full_lower for s in [
            'on-premise', 'on premise', 'on-prem',
            'one-time license', 'perpetual license',
            'desktop app', 'installed locally',
        ])
        if (has_mobile or has_web_app or has_login) and not non_saas_override:
            result['is_saas'] = True

    return result


def analyze_with_gemini(website_data: dict, company_name: str, gemini_key: str) -> dict:
    """Use Google Gemini 2.0 Flash — free, accurate, generous quota."""
    if not gemini_key or not website_data:
        return {}
    user_content = build_analysis_prompt(website_data, company_name)
    try:
        res = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}',
            headers={'Content-Type': 'application/json'},
            json={
                # system_instruction keeps instructions out of the content turn
                'system_instruction': {'parts': [{'text': SYSTEM_INSTRUCTION}]},
                'contents': [{'role': 'user', 'parts': [{'text': user_content}]}],
                'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 900, 'responseMimeType': 'application/json'},
            },
            timeout=30
        )
        data = res.json()
        if 'error' in data:
            return {}
        content = data['candidates'][0]['content']['parts'][0]['text']
        result = validate_ai_output(parse_ai_response(content))
        return force_override_with_scraped(result, website_data)
    except Exception:
        return {}


def analyze_with_openai(website_data: dict, company_name: str, openai_key: str) -> dict:
    """Use GPT-4o — most accurate but paid."""
    if not openai_key or not website_data:
        return {}
    user_content = build_analysis_prompt(website_data, company_name)
    try:
        res = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {openai_key}', 'Content-Type': 'application/json'},
            json={
                'model': 'gpt-4o',
                'messages': [
                    {'role': 'system', 'content': SYSTEM_INSTRUCTION},
                    {'role': 'user',   'content': user_content},
                ],
                'max_tokens': 900,
                'temperature': 0.1,
                'response_format': {'type': 'json_object'},
            },
            timeout=30
        )
        data = res.json()
        if 'error' in data:
            return {'_openai_error': data['error'].get('message', 'unknown error')}
        content = data['choices'][0]['message']['content']
        result = validate_ai_output(parse_ai_response(content))
        return force_override_with_scraped(result, website_data)
    except Exception:
        return {}


def analyze_with_groq(website_data: dict, company_name: str, industry: str, description: str, groq_key: str) -> dict:
    """Use Groq Llama 70B — free, fast, good for classification."""
    if not groq_key:
        return {}

    safe_name = sanitize_company_name(company_name)
    if website_data:
        user_content = build_analysis_prompt(website_data, company_name)
    else:
        safe_industry = sanitize_scraped_text(industry or 'Unknown', 100)
        safe_desc     = sanitize_description(description or '')
        user_content = (
            f'Company: {safe_name}\n'
            f'Industry: {safe_industry}\n'
            f'Description: {safe_desc}\n\n'
            f'Return ONLY this JSON:\n'
            f'{{"company_type": "Product" or "Service" or "Hybrid", '
            f'"company_type_reason": "one sentence", '
            f'"classification": "one of: Fintech, Healthtech, SaaS, Cybersecurity, IT Services, '
            f'E-commerce, Edtech, Logistics, Manufacturing, Banking, Insurance, '
            f'VC / Investment, Media, Consulting, Retail, Real Estate, Government, Non-profit, Other", '
            f'"is_saas": true or false, '
            f'"target_market": "B2B" or "B2C" or "Both" or "Unknown", '
            f'"has_login": false, "compliance": [], "products_or_services": [], '
            f'"website_summary": "Based on company name and industry only."}}'
        )

    try:
        res = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={'Authorization': f'Bearer {groq_key}', 'Content-Type': 'application/json'},
            json={
                'model': 'llama-3.3-70b-versatile',
                'messages': [
                    {'role': 'system', 'content': SYSTEM_INSTRUCTION},
                    {'role': 'user',   'content': user_content},
                ],
                'max_tokens': 900,
                'temperature': 0.1,
                'response_format': {'type': 'json_object'},
            },
            timeout=20
        )
        data = res.json()
        if 'error' in data or 'choices' not in data:
            return {}
        content = data['choices'][0]['message']['content']
        result = validate_ai_output(parse_ai_response(content))
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

    safe_name = sanitize_company_name(company_name)
    if website_data:
        user_content = build_analysis_prompt(website_data, company_name)
    else:
        user_content = (
            f'Company: {safe_name}\n\n'
            f'Return ONLY this JSON:\n'
            f'{{"company_type": "Product" or "Service" or "Hybrid", '
            f'"company_type_reason": "one sentence", '
            f'"classification": "one of: Fintech, Healthtech, SaaS, Cybersecurity, IT Services, '
            f'E-commerce, Edtech, Logistics, Manufacturing, Banking, Insurance, '
            f'VC / Investment, Media, Consulting, Retail, Real Estate, Government, Non-profit, Other", '
            f'"is_saas": true or false, '
            f'"target_market": "B2B" or "B2C" or "Both" or "Unknown", '
            f'"has_login": false, "compliance": [], "products_or_services": [], '
            f'"website_summary": "Based on company name only."}}'
        )

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
                'messages': [
                    {'role': 'system', 'content': SYSTEM_INSTRUCTION},
                    {'role': 'user',   'content': user_content},
                ],
                'max_tokens': 900,
                'temperature': 0.1,
            },
            timeout=30,
        )
        data = res.json()
        if 'error' in data or 'choices' not in data:
            return {}
        content = data['choices'][0]['message']['content']
        result = validate_ai_output(parse_ai_response(content))
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
    text = sanitize_description(description).lower()
    if website_data:
        text += " " + " ".join([
            sanitize_scraped_text(website_data.get("header", ""), 500),
            sanitize_scraped_text(website_data.get("hero", ""), 800),
            sanitize_scraped_text(website_data.get("nav", ""), 300),
            sanitize_scraped_text(website_data.get("footer", ""), 500),
            sanitize_scraped_text(website_data.get("pricing", ""), 300),
            sanitize_scraped_text(website_data.get("full_text", "")[:2000], 2000),
        ]).lower()

    # ── Structural signals (most reliable — from HTML, not text) ──────────
    has_login        = bool(website_data and website_data.get("has_login_detected"))
    has_pricing      = bool(website_data and (
        website_data.get("pricing", "").strip() or
        website_data.get("has_pricing_detected")
    ))
    has_mobile_app   = bool(website_data and website_data.get("has_mobile_app"))
    has_web_app      = bool(website_data and website_data.get("has_web_app_link"))
    site_loaded      = bool(website_data)

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

    # ── Scoring — HTML-level signals weighted highest ───────────────
    if has_mobile_app:   p_strong_count += 5  # App Store/Play Store link = ships own product
    if has_web_app:      p_strong_count += 3  # /login or app. subdomain = has web product
    if has_login:        p_strong_count += 2
    if has_pricing:      p_strong_count += 2

    p_score = p_strong_count * 2 + p_weak_count
    s_score = s_strong_count * 2 + s_weak_count

    # ── Decision tree ──────────────────────────────────────────────

    # Tier 0 (ABSOLUTE): Mobile app confirmed = company ships own product.
    # A company with its own App Store / Play Store app is NEVER a pure Service.
    # Text signals (even from a wrong LinkedIn description) cannot override this.
    # Exception: if there are 3+ strong service keywords AND no other product signals,
    # classify Hybrid so the AI can refine (but still not Service).
    if has_mobile_app:
        if s_strong_count >= 3 and not has_login and not has_web_app and not has_pricing:
            return "Hybrid", "High"
        return "Product", "High"

    # Tier 1: Web app + pricing OR web app + login = Product
    if has_web_app and has_pricing and s_strong_count == 0:
        return "Product", "High"
    if has_web_app and has_pricing and s_strong_count >= 1:
        return "Hybrid", "High"
    if has_web_app and has_login and s_strong_count == 0:
        return "Product", "High"

    # Tier 2: Login + pricing without app links — still Product (was Tier 1 before)
    if has_login and has_pricing and s_strong_count == 0:
        return "Product", "High"
    if has_login and has_pricing and s_strong_count >= 1:
        return "Hybrid", "High"

    # Tier 3: Strong explicit service keywords → high confidence
    if s_strong_count >= 2:
        return "Service", "High"
    if s_strong_count >= 1 and not has_login and not has_pricing and not has_mobile_app and not has_web_app:
        return "Service", "High"

    # Tier 4: Strong product text keywords without service signals
    if p_strong_count >= 5 and s_score == 0:
        return "Product", "High"
    if p_strong_count >= 3 and s_score <= 1:
        return "Product", "Medium"
    if (has_login or has_web_app) and p_strong_count >= 1 and s_strong_count == 0:
        return "Product", "Medium"

    # Tier 5: One explicit service keyword with some product language → Hybrid
    if s_strong_count >= 1 and p_score >= 3:
        return "Hybrid", "Medium"

    # Tier 6: Weak signals only
    if s_score >= 4 and p_score <= 1:
        return "Service", "Medium"
    if p_score >= 4 and s_score == 0:
        return "Product", "Medium"
    if s_weak_count >= 2 and not has_login and not has_pricing and not has_mobile_app and not has_web_app and p_strong_count == 0:
        return "Service", "Medium"

    # Tier 7: Site loaded with content but zero product signals → lean Service
    # Only fires if NO app, login, pricing, or web-app links were found.
    meaningful_content = site_loaded and len(text.strip()) > 200
    if meaningful_content and not has_login and not has_pricing and not has_mobile_app and not has_web_app and p_strong_count == 0:
        return "Service", "Low"

    return None, "Low"


# Keep backward compatibility
def analyze_website_with_openai(website_data: dict, company_name: str, openai_key: str) -> dict:
    return analyze_with_openai(website_data, company_name, openai_key)