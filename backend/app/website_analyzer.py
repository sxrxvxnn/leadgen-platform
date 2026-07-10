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
            # ScrapingBee fallback for blocked/JS-gated sites
            sb_key = os.environ.get("SCRAPINGBEE_API_KEY", "")
            if sb_key and not fast:
                try:
                    sb_res = requests.get(
                        "https://app.scrapingbee.com/api/v1/",
                        params={
                            "api_key": sb_key,
                            "url": url,
                            "render_js": "true",
                            "premium_proxy": "false",
                            "block_ads": "true",
                        },
                        timeout=35,
                    )
                    if sb_res.status_code == 200 and len(sb_res.text) > 2000:
                        res = sb_res
                    else:
                        return None
                except Exception:
                    return None
            else:
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

        # ScrapingBee fallback for SPAs where bundle fetch still left minimal content
        _visible_len = len(BeautifulSoup(raw_html, 'html.parser').get_text(strip=True))
        if _visible_len < 300 and not fast:
            sb_key = os.environ.get("SCRAPINGBEE_API_KEY", "")
            if sb_key:
                try:
                    sb_res = requests.get(
                        "https://app.scrapingbee.com/api/v1/",
                        params={
                            "api_key": sb_key,
                            "url": url,
                            "render_js": "true",
                            "premium_proxy": "false",
                            "block_ads": "true",
                        },
                        timeout=35,
                    )
                    if sb_res.status_code == 200 and len(sb_res.text) > 2000:
                        raw_html = sb_res.text
                        spa_bundle_text = ""  # SB returns rendered HTML, no need for bundle
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
        title_tag = soup.find('title')
        page_title = (title_tag.get_text(strip=True) if title_tag else '').strip()

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
            'title': page_title,
            'meta_description': meta_description,
            'first_para': first_para,
            'location': location,
            'linkedin_url': linkedin_url_in_html,
            'scan_text': scan_text[:50_000] if not fast else '',  # raw HTML+bundle for tech stack
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
                'model': 'llama-3.1-70b-versatile',
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
        # Management platform signals — SaaS products use these, not service companies
        'management system', 'management platform', 'management software',
        'performance management', 'hr platform', 'hr software', 'hr system',
        'built for hr', 'built for teams', 'built for managers',
        'get a demo', 'request a demo', 'book a demo', 'schedule a demo',
        # Nav-level pricing signal — service companies rarely have a Pricing nav item
        'pricing', 'see pricing', 'view pricing',
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
    # NOTE: 'technology company', 'tech company', 'software development company',
    # 'it company', 'it firm' removed — too generic, apply equally to SaaS products
    service_strong = [
        'it services', 'software services', 'managed services', 'managed service provider',
        'consulting services', 'outsourcing', 'staff augmentation', 'body shopping',
        'offshore development', 'onshore development', 'nearshore development',
        'delivery center', 'engineering services', 'development services',
        'service provider', 'technology services', 'digital services',
        'it solutions and services', 'software development services',
        'digital agency', 'solutions company', 'engineering company', 'it consulting',
        'dedicated team', 'hire developers', 'hire our', 'talent solutions',
        'digital transformation services', 'digital transformation company',
        'erp implementation', 'crm implementation', 'system integration',
        'software delivery', 'agile delivery', 'project delivery',
    ]
    # Weak: pattern common in service companies, less definitive
    # NOTE: 'talent' removed — HR SaaS products use "talent management" heavily
    service_weak = [
        'for our clients', 'client engagement', 'client projects', 'client work',
        'custom development', 'bespoke', 'tailored solutions', 'custom software',
        'resource augmentation', 'workforce solutions',
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

    # Tier 7: No confident signals — return None so AI/Groq can decide.
    # Removed the old "lean Service" default: JS-rendered SaaS sites (like PerformYard)
    # can't have their login/pricing buttons detected by BeautifulSoup, causing false
    # Service classifications. Better to leave it blank than be confidently wrong.
    return None, "Low"


def classify_website_saas(
    website_data: dict | None,
    url: str = "",
    description: str = "",
    ddgs_snippets: str = "",
) -> dict:
    """Weighted scoring classifier per the SonarLeads Classification Engine spec.

    Returns:
        {
            "category":       "SaaS" | "Non-SaaS Product" | "Service",
            "company_type":   "Product" | "Service" | "Hybrid",
            "is_saas":        bool,
            "confidence":     int (0-100),
            "scores":         {"saas": int, "product": int, "service": int},
            "low_confidence": bool,   # True when top-two within 3 points
        }
    """

    # ── Keyword signal tables (term → weight) ────────────────────────────────
    _SAAS = {
        'free trial': 5, 'start free trial': 5, 'try for free': 5,
        'dashboard': 5,
        'pricing': 4, 'pricing plan': 4, 'view pricing': 4,
        'log in': 4, 'login': 4, 'sign in': 4,
        'subscription': 4, 'subscribe': 3,
        ' api ': 4, 'api access': 4, 'rest api': 4, 'graphql': 3,
        'per user': 2, 'per seat': 2, 'per month': 3, 'per year': 3,
        'sign up': 2, 'create account': 2, 'get started free': 3,
        'billing': 3, 'upgrade plan': 3, 'cancel anytime': 3,
        'saas': 5, 'software as a service': 5,
        'cloud platform': 4, 'cloud-based': 3,
        'integrations': 3, 'workflow automation': 3,
        'onboarding': 2, 'in-app': 2,
        # Management / HR / vertical SaaS patterns
        'management software': 4, 'management platform': 4,
        'hr platform': 4, 'hr software': 4, 'hr system': 3,
        'performance management': 3, 'talent management': 3,
        'performance review': 3, 'employee engagement': 3,
        'project management': 3, 'crm software': 4, 'erp software': 4,
        'accounting software': 4, 'payroll software': 4,
        'built for teams': 2, 'built for hr': 2,
    }
    _PRODUCT = {
        'hardware': 5, 'device': 4, 'equipment': 3,
        'buy now': 4, 'add to cart': 4, 'shop now': 3,
        'one-time purchase': 3, 'one time payment': 3,
        'cart': 3, 'checkout': 3,
        'download': 3, 'install': 2,
        'warranty': 3, 'specifications': 2,
        'license key': 3, 'perpetual license': 3,
        'on-premise': 4, 'on premise': 4, 'on-prem': 4,
        'desktop app': 3, 'desktop application': 3,
        'physical product': 3, 'ships to': 2, 'shipping': 2,
    }
    # Service signals — STRICT: only terms exclusive to service/agency companies.
    # REMOVED intentionally:
    #   'consulting' / 'it consulting' — appears in customer review industry labels on SaaS sites
    #     (e.g. G2 reviewers say "Jason J. | IT Consulting" — this is the reviewer's industry)
    #   'project delivery' / 'client projects' — generic; appear in HR SaaS AI demo content
    #   'professional services' / 'development services' — SaaS companies have PS teams
    #   'it services' — too broad
    _SERVICE = {
        'consultancy': 5,
        'consulting firm': 5, 'consulting company': 5,
        'digital agency': 5, 'creative agency': 5, 'marketing agency': 5,
        'advertising agency': 5, 'design agency': 5, 'we are an agency': 5,
        'request a quote': 5, 'request quote': 5, 'get a quote': 5, 'request a proposal': 5,
        'staff augmentation': 5, 'outsourcing': 5,
        'dedicated team': 4, 'hire developers': 4, 'hire our': 4,
        'offshore development': 4, 'nearshore development': 4,
        'managed services': 4, 'managed service provider': 4,
        'custom development': 4, 'bespoke': 4,
        'implementation services': 3,
    }

    # ── Nav tab signals ───────────────────────────────────────────────────────
    _NAV_SAAS    = ['pricing', 'api', 'integrations', 'documentation', 'docs', 'changelog', 'status']
    _NAV_PRODUCT = ['shop', 'store', 'cart', 'catalog', 'buy']
    # 'solutions', 'industries', 'case studies' removed — SaaS companies use all of these
    _NAV_SERVICE = ['services', 'clients', 'our work', 'expertise', 'what we do']

    # ── CTA button patterns ───────────────────────────────────────────────────
    _CTA_SAAS    = ['start free trial', 'get started free', 'try for free', 'start for free',
                    'sign up free', 'create free account', 'get started']
    _CTA_PRODUCT = ['buy now', 'add to cart', 'shop now', 'order now', 'purchase']
    # 'contact us', 'get in touch', 'book a demo', 'schedule a call' removed —
    # enterprise SaaS companies use all of these as primary CTAs
    _CTA_SERVICE = ['request a quote', 'request quote', 'get a quote', 'request a proposal',
                    'get a proposal']

    # ── URL / subdomain signals ───────────────────────────────────────────────
    _URL_SAAS    = [r'app\.', r'dashboard\.', r'api\.', r'/pricing', r'/signup', r'/login', r'/docs']
    _URL_PRODUCT = [r'/shop', r'/store', r'/cart', r'/products', r'/catalog', r'store\.']
    _URL_SERVICE = [r'/services', r'/consulting', r'/agency', r'/portfolio']

    # ── Tech stack fingerprints (in raw HTML/JS) ─────────────────────────────
    _TECH_SAAS = [
        ('js.stripe.com', 4), ('stripe.com/v3', 4),
        ('auth0.com', 4), ('okta.com', 3),
        ('widget.intercom.io', 3), ('app.intercom.io', 3),
        ('chargebee.com', 4), ('recurly.com', 4), ('paddle.com', 3),
        ('segment.com', 2), ('cdn.segment.com', 2),
        ('mixpanel.com', 2), ('amplitude.com', 2),
        ('launchdarkly.com', 3),
        ('pendo.io', 2), ('heap.io', 2),
        ('app.getbeamer.com', 2),
        ('appcues.com', 2), ('userpilot.com', 2),
    ]
    _TECH_PRODUCT = [
        ('cdn.shopify.com', 5), ('shopify.com', 4),
        ('woocommerce', 4), ('wc-api', 3),
        ('bigcommerce.com', 4), ('bigcommerce', 3),
        ('magento', 3), ('mage', 2),
        ('snipcart.com', 3), ('ecwid.com', 3),
        ('squarespace.com/commerce', 2),
    ]

    # ─────────────────────────────────────────────────────────────────────────
    scores = {'saas': 0, 'product': 0, 'service': 0}

    if not website_data and not description and not ddgs_snippets:
        return {
            'category': 'Service', 'company_type': 'Service',
            'is_saas': False, 'confidence': 0,
            'scores': scores, 'low_confidence': True,
        }

    # Build text corpus from page content (weight: 1.0×)
    # Title is explicitly included so "Performance Management Platform" in <title> scores SaaS
    page_text = ' '.join(filter(None, [
        website_data.get('title', '') if website_data else '',
        website_data.get('header', '') if website_data else '',
        website_data.get('nav', '') if website_data else '',
        website_data.get('hero', '') if website_data else '',
        website_data.get('pricing', '') if website_data else '',
        website_data.get('full_text', '')[:3000] if website_data else '',
        website_data.get('meta_description', '') if website_data else '',
        description,
    ])).lower()

    # Meta corpus — title + meta_description only (company's own words, not page body)
    meta_corpus = ' '.join(filter(None, [
        website_data.get('title', '') if website_data else '',
        website_data.get('meta_description', '') if website_data else '',
        description,
    ])).lower()

    nav_text  = (website_data.get('nav', '') if website_data else '').lower()
    full_text = (website_data.get('full_text', '') if website_data else '').lower()
    scan_text = (website_data.get('scan_text', '') if website_data else '').lower()

    # 1. Keyword scoring (1.0× weight) ────────────────────────────────────────
    for term, weight in _SAAS.items():
        if term in page_text:
            scores['saas'] += weight
    for term, weight in _PRODUCT.items():
        if term in page_text:
            scores['product'] += weight
    for term, weight in _SERVICE.items():
        if term in page_text:
            scores['service'] += weight

    # 2. Nav tab scoring (1.0× weight) ────────────────────────────────────────
    for tab in _NAV_SAAS:
        if tab in nav_text:
            scores['saas'] += 3
    for tab in _NAV_PRODUCT:
        if tab in nav_text:
            scores['product'] += 3
    for tab in _NAV_SERVICE:
        if tab in nav_text:
            scores['service'] += 2

    # 3. CTA button scoring (1.0× weight) ─────────────────────────────────────
    for cta in _CTA_SAAS:
        if cta in page_text:
            scores['saas'] += 4
    for cta in _CTA_PRODUCT:
        if cta in page_text:
            scores['product'] += 4
    for cta in _CTA_SERVICE:
        if cta in page_text:
            scores['service'] += 3

    # 4. URL / subdomain patterns (1.0× weight) ────────────────────────────────
    url_l = url.lower()
    for pat in _URL_SAAS:
        if re.search(pat, url_l):
            scores['saas'] += 3
    for pat in _URL_PRODUCT:
        if re.search(pat, url_l):
            scores['product'] += 3
    for pat in _URL_SERVICE:
        if re.search(pat, url_l):
            scores['service'] += 2

    # 5. HTML structural signals (1.0× weight) ────────────────────────────────
    if website_data:
        if website_data.get('has_login_detected'):    scores['saas'] += 4
        if website_data.get('has_web_app_link'):      scores['saas'] += 3
        if website_data.get('has_pricing_detected'):  scores['saas'] += 4
        if website_data.get('has_mobile_app'):        scores['saas'] += 3
        if website_data.get('has_app_store_link'):    scores['saas'] += 3
        if website_data.get('has_play_store_link'):   scores['saas'] += 3

    # 6. Tech stack fingerprints (0.7× weight) ────────────────────────────────
    if scan_text:
        for fingerprint, weight in _TECH_SAAS:
            if fingerprint in scan_text:
                scores['saas'] += int(weight * 0.7)
        for fingerprint, weight in _TECH_PRODUCT:
            if fingerprint in scan_text:
                scores['product'] += int(weight * 0.7)

    # 7. Meta tag scoring (0.9× weight) — title + meta_description only ─────────
    # These are the company's own words, so signal quality is high but weight is
    # slightly reduced vs body text to avoid over-indexing short descriptions.
    _META_SAAS    = ['software', 'platform', 'saas', 'crm', 'erp', 'tool', 'app',
                     'suite', 'solution', 'management system', 'cloud service']
    _META_SERVICE = ['consulting', 'consultancy', 'agency', 'advisory',
                     'outsourcing', 'managed services']
    if meta_corpus:
        for term in _META_SAAS:
            if term in meta_corpus:
                scores['saas'] += int(2 * 0.9)  # +1 (floored) per meta SaaS term
        for term in _META_SERVICE:
            if term in meta_corpus:
                scores['service'] += int(2 * 0.9)

    # 8. DDG/G2/Capterra/LinkedIn snippets (0.8× weight) ─────────────────────
    if ddgs_snippets:
        snip_l = ddgs_snippets.lower()
        for term, weight in _SAAS.items():
            if term in snip_l:
                scores['saas'] += int(weight * 0.8)
        for term, weight in _SERVICE.items():
            if term in snip_l:
                scores['service'] += int(weight * 0.8)
        for term, weight in _PRODUCT.items():
            if term in snip_l:
                scores['product'] += int(weight * 0.8)
        # G2/Capterra presence is a very strong SaaS signal
        if 'g2.com' in snip_l or 'capterra.com' in snip_l or 'getapp.com' in snip_l:
            scores['saas'] += int(8 * 0.9)

    # ── Decision ─────────────────────────────────────────────────────────────
    total = scores['saas'] + scores['product'] + scores['service']
    if total == 0:
        return {
            'category': 'Service', 'company_type': 'Service',
            'is_saas': False, 'confidence': 0,
            'scores': scores, 'low_confidence': True,
        }

    winner = max(scores, key=scores.get)
    win_score = scores[winner]
    sorted_scores = sorted(scores.values(), reverse=True)
    runner_up = sorted_scores[1] if len(sorted_scores) > 1 else 0

    confidence = int(win_score / total * 100)
    low_confidence = (win_score - runner_up) <= 3

    # Map winner to output fields
    if winner == 'saas':
        category, company_type, is_saas = 'SaaS', 'Product', True
    elif winner == 'product':
        category, company_type, is_saas = 'Non-SaaS Product', 'Product', False
    else:
        category, company_type, is_saas = 'Service', 'Service', False

    # Hybrid: substantial service AND saas scores together
    if winner == 'saas' and scores['service'] >= scores['saas'] * 0.5:
        company_type = 'Hybrid'
    if winner == 'service' and scores['saas'] >= scores['service'] * 0.5:
        company_type = 'Hybrid'; is_saas = False

    return {
        'category':     category,
        'company_type': company_type,
        'is_saas':      is_saas,
        'confidence':   confidence,
        'scores':       scores,
        'low_confidence': low_confidence,
    }


# Keep backward compatibility
def analyze_website_with_openai(website_data: dict, company_name: str, openai_key: str) -> dict:
    return analyze_with_openai(website_data, company_name, openai_key)