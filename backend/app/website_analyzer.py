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


def _fc_website_data(url: str, wait_ms: int = 4000) -> dict | None:
    """Try Firecrawl scrape and wrap result into the website_data dict format.
    Returns None when Firecrawl returns no usable content or has no keys left.
    """
    try:
        from .enrichment import _fc_scrape as _fc_scrape_wd
        fc_md = _fc_scrape_wd(url, wait_ms=wait_ms)
        if fc_md and len(fc_md) > 300:
            return {
                "url": url,
                "full_text": fc_md,
                "scan_text": fc_md,
                "compliance_detected": [],
                "has_mobile_app": False,
                "social_profiles": {},
                "title": "",
                "meta_description": "",
                "review_presence": None,
                "app_store_presence": None,
            }
    except Exception:
        pass
    return None


def fetch_website_content(url: str, fast: bool = False) -> dict:
    """Scrape and parse website content.
    Firecrawl is tried first (handles JS-heavy/bot-protected sites accurately).
    Falls back to direct HTTP for speed when Firecrawl credits are exhausted.
    fast=True: skip Firecrawl (4s HTTP timeout) — used only inside bulk autofill inner loops.
    """
    if not url:
        return None
    if not url.startswith('http'):
        url = 'https://' + url

    # ── Firecrawl primary (not fast mode) ─────────────────────────────────────
    if not fast:
        fc_data = _fc_website_data(url, wait_ms=5000)
        if fc_data:
            return fc_data

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
            if fast:
                return None
            # Firecrawl fallback for blocked/JS-gated sites
            from .enrichment import _fc_scrape as _fc_scrape_wa
            fc_md = _fc_scrape_wa(url, wait_ms=4000)
            if fc_md and len(fc_md) > 200:
                return {
                    "url": url, "full_text": fc_md, "scan_text": fc_md,
                    "compliance_detected": [], "has_mobile_app": False,
                    "social_profiles": {}, "title": "", "meta_description": "",
                    "review_presence": None, "app_store_presence": None,
                }
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

        # Firecrawl fallback for SPAs where direct fetch left minimal visible content
        _visible_len = len(BeautifulSoup(raw_html, 'html.parser').get_text(strip=True))
        if _visible_len < 300 and not fast:
            from .enrichment import _fc_scrape as _fc_scrape_spa
            fc_md = _fc_scrape_spa(url, wait_ms=5000)
            if fc_md and len(fc_md) > 200:
                raw_html = fc_md
                spa_bundle_text = ""  # FC returns rendered markdown, no bundle scan needed

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


def fetch_extended_evidence(base_url: str, website_data: dict) -> dict:
    """Fetch key subpages when homepage evidence is weak and merge signals.

    Tries /pricing, /plans, /features, /product, /about in order.
    Stops once pricing signals are found.  Uses fast=True (no Firecrawl)
    to keep latency low — subpages are a quick HTTP pass only.

    Returns the updated website_data dict (mutates in place and returns it).
    """
    if not base_url:
        return website_data

    try:
        from urllib.parse import urlparse as _up
        parsed = _up(base_url if "://" in base_url else "https://" + base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"
    except Exception:
        return website_data

    _SUBPAGES = [
        "/pricing", "/plans", "/plan",
        "/features", "/feature",
        "/product", "/products",
        "/about", "/about-us",
        "/security", "/compliance",
    ]

    extra_text = ""
    for path in _SUBPAGES:
        if website_data.get("has_pricing_detected") and len(extra_text) > 3000:
            break
        try:
            sub = fetch_website_content(base + path, fast=True)
            if not sub or len(sub.get("full_text", "")) < 100:
                continue
            extra_text += " " + sub["full_text"][:1500]
            if sub.get("has_pricing_detected"):
                website_data["has_pricing_detected"] = True
                website_data["pricing"] = (
                    (website_data.get("pricing") or "") + " " + sub.get("pricing", "")
                ).strip()
            if sub.get("has_login_detected"):
                website_data["has_login_detected"] = True
            if sub.get("has_web_app_link"):
                website_data["has_web_app_link"] = True
            if sub.get("compliance_detected"):
                existing = website_data.get("compliance_detected") or []
                merged = list(dict.fromkeys(existing + sub["compliance_detected"]))
                website_data["compliance_detected"] = merged
        except Exception:
            continue

    if extra_text.strip():
        website_data["full_text"] = (
            (website_data.get("full_text") or "") + extra_text
        )[:6000]

    return website_data


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
- "Product" = the company has built software (web app, mobile app, SaaS platform, open-source tool, geospatial/AI tool) that end-users or businesses USE directly. They own and ship the product. Signals: App Store/Play Store links, web app login, self-serve signup, subscription pricing, named product pages ("Our Products"), open-source repos.
- "Service" = the company sells expertise, time, or people. They BUILD things for clients or provide consulting/staffing/outsourcing. No product of their own that customers use independently. Customers contact them for a quote, not self-serve.
- "Hybrid" = company BOTH has its own named software product(s) AND offers services/consulting. Both must be clearly present. KEY SIGNAL: nav has both "Products" AND "Services" tabs → almost always Hybrid.
- Mobile app detected (App Store or Play Store link) → STRONG Product signal. Use "Product" unless clear evidence they built the app for a client.
- Web app link detected (/login, /dashboard, app.domain.com) → STRONG Product signal. Same exception for client portals.
- "Our Products" / "Products" section listing named software tools → Product or Hybrid signal (NOT just services).
- Indian IT/software companies (Technopark, Bangalore, Kerala, Kochi) that say "platform" or "solution" WITHOUT a login link or app link → Service (these are marketing words, not products). EXCEPTION: if they also list named products (BrightServe, LabEdge, formsflow.ai etc.) under a Products section → Hybrid or Product.

is_saas:
- RULE 1: company_type = Service (and ONLY Service, no products at all) → is_saas MUST be false.
- RULE 2: If a web login, web app, OR mobile app is confirmed → is_saas = true UNLESS there is explicit evidence of on-premise / one-time license / downloadable desktop software.
- RULE 3: Absence of a visible pricing page does NOT mean Non-SaaS. Enterprise SaaS hides pricing ("Contact Sales"). Mobile apps price via App Store. Treat these as SaaS.
- RULE 4: A company that lists its OWN NAMED software products (even open-source) → is_saas = true. Open-source software products are still software products. "Open source" ≠ "not SaaS".
- RULE 5: Hybrid companies that have their own software products + services → is_saas = true.
- Non-SaaS signals (only these justify is_saas = false for a Product/Hybrid): "on-premise", "on-prem", "installed locally", "perpetual license", "one-time license", "desktop application", "download and install", hardware/physical device only.
- In short: has own software products (cloud, open-source, or web app) → SaaS. Pure services with zero own software → Non-SaaS. On-premise-only software → Non-SaaS.

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

    # Nav has both "Products" + "Services/Solutions" tabs → always Hybrid
    # Use nav + header combined — many sites nest nav links inside <header>
    _nav_hdr = ((website_data.get('nav', '') or '') + ' ' + (website_data.get('header', '') or '')[:300]).lower()
    if ('product' in _nav_hdr and
            any(s in _nav_hdr for s in ['service', 'solutions', 'our work', 'what we do', 'expertise', 'clients'])):
        if result.get('company_type') != 'Hybrid':
            result['company_type'] = 'Hybrid'
            result['company_type_reason'] = (
                result.get('company_type_reason', '') +
                ' [Override: nav/header has both Products + Services → Hybrid.]'
            )

    # Normalise "Services" → "Service"
    if result.get('company_type') == 'Services':
        result['company_type'] = 'Service'

    # Hard rule: pure Service with no products at all → never SaaS
    if result.get('company_type') == 'Service':
        result['is_saas'] = False

    # Product/Hybrid companies → is_saas=true unless explicit non-cloud delivery proof
    elif result.get('company_type') in ('Product', 'Hybrid'):
        full_lower  = website_data.get('full_text', '').lower()
        non_saas_signals = [
            'on-premise', 'on premise', 'on-prem',
            'one-time license', 'perpetual license',
            'desktop app', 'installed locally',
        ]
        has_non_saas = any(s in full_lower for s in non_saas_signals)
        if not has_non_saas:
            # Own software products (including open-source) → SaaS
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
        # Own named products — any company listing "our products" has own software
        'our products', 'our software products', 'product portfolio',
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

    # ── Nav-level product detection (very reliable) ──────────────────────
    # If "products" appears as a nav/header, the company has own software products.
    # Combined with "services" in nav/header → definitely Hybrid.
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
        # Spec additions — IT consulting firms that use cloud/AI keywords
        'technology consulting', 'cybersecurity consulting', 'it service management',
        'professional services', 'professional services firm', 'cloud engineering',
        'digital engineering services', 'case studies', 'industries served',
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

    # ── Nav "Products" tab — very reliable structural signal ─────────────────
    # A "Products" nav tab means the company has named software products of their own.
    # When combined with "Services" in nav/header → Hybrid regardless of other signals.
    nav_text_lower = (((website_data.get("nav", "") or "") + " " + (website_data.get("header", "") or "")[:300]).lower()) if website_data else ""
    nav_has_products = 'product' in nav_text_lower
    nav_has_services = any(s in nav_text_lower for s in ['service', 'solutions', 'our work', 'what we do', 'expertise', 'clients'])
    if nav_has_products:
        p_strong_count += 3  # company lists own software products

    # ── Scoring — HTML-level signals weighted highest ───────────────
    if has_mobile_app:   p_strong_count += 5  # App Store/Play Store link = ships own product
    if has_web_app:      p_strong_count += 3  # /login or app. subdomain = has web product
    if has_login:        p_strong_count += 2
    if has_pricing:      p_strong_count += 2

    p_score = p_strong_count * 2 + p_weak_count
    s_score = s_strong_count * 2 + s_weak_count

    # ── Decision tree ──────────────────────────────────────────────

    # Tier 0 (ABSOLUTE): Nav has both Products + Services = Hybrid.
    # This is the most reliable structural signal for Hybrid companies.
    if nav_has_products and nav_has_services:
        return "Hybrid", "High"

    # Tier 0a: Products in nav + service signals in text = Hybrid.
    # Catches companies like AOT Technologies: "Products" nav but no "Services" tab,
    # yet their page body clearly describes consulting/transformation services.
    if nav_has_products and s_strong_count >= 1:
        return "Hybrid", "Medium"

    # Tier 0b: Mobile app confirmed = company ships own product.
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


_INDUSTRY_SIGNALS: dict[str, list[str]] = {
    "Financial Technology (FinTech)": [
        "sebi", "rbi ", "rbi-", "sebi-regulated", "sebi registered", "investment advisory",
        "wealth management", "wealth protection", "personal finance", "fintech",
        "financial technology", "insurance polic", "portfolio tracking", "portfolio management",
        "account aggregator", "financial information", "digital banking", "neobank",
        "payment gateway", "payment processing", "digital payments", "mutual fund",
        "stock market", "equity market", "income tax", "tax filing",
    ],
    "Cybersecurity": [
        "cybersecurity", "cyber security", "penetration testing", "pentest", "vapt",
        "vulnerability assessment", "security testing", "threat detection", "zero-day",
        "malware", "endpoint security", "siem", "security operations center",
        "application security", "appsec", "web application firewall",
    ],
    "Healthcare Technology": [
        "healthcare platform", "health platform", "clinical", "patient management",
        "electronic health record", "ehr", "emr", "telemedicine", "telehealth",
        "hospital management", "pharmacy", "healthtech", "medical records",
    ],
    "Education Technology": [
        "learning management", "e-learning", "edtech", "lms", "education platform",
        "online learning", "mooc", "course platform", "student management", "edtech",
    ],
    "E-commerce": [
        "add to cart", "online store", "product catalog", "shopify", "woocommerce",
        "ecommerce", "e-commerce platform", "online marketplace", "retail platform",
    ],
    "Logistics & Supply Chain": [
        "logistics platform", "supply chain", "last-mile delivery", "freight management",
        "fleet management", "dispatch software", "warehouse management",
    ],
    "Real Estate Technology": [
        "real estate platform", "proptech", "property management software",
        "rental platform", "mortgage platform", "commercial property management",
    ],
    "Marketing Technology": [
        "marketing automation", "email marketing platform", "seo platform",
        "ad tech", "adtech", "demand-side platform", "crm software",
    ],
    "Human Resources Technology": [
        "hr platform", "hris", "human resource", "payroll software", "ats",
        "applicant tracking", "talent management platform", "workforce management",
    ],
}


def classify_industry_from_evidence(
    website_data: dict | None,
    description: str = "",
    tagline: str = "",
) -> str | None:
    """Derive business industry from website/product evidence.

    Returns the most specific matching industry label, or None when evidence
    is insufficient. LinkedIn's raw category must never be passed here — this
    function exclusively uses product/website signals (highest-priority source).
    """
    text = " ".join(filter(None, [
        (website_data.get("full_text", "") if website_data else "")[:8000],
        (website_data.get("meta_description", "") if website_data else ""),
        (website_data.get("title", "") if website_data else ""),
        description,
        tagline,
    ])).lower()

    if not text.strip():
        return None

    for industry, signals in _INDUSTRY_SIGNALS.items():
        if any(s in text for s in signals):
            return industry

    return None


def classify_website_saas(
    website_data: dict | None,
    url: str = "",
    description: str = "",
    ddgs_snippets: str = "",
) -> dict:
    """Classification Engine v2 — evidence-driven, multi-dimensional.

    Key principle: do NOT classify SaaS because a login or dashboard exists.
    SaaS requires explicit subscription evidence AND subscription_score > marketplace_score.
    Marketplace / FinTech / P2P-lending companies are Product but NOT SaaS.

    Returns:
        {
            "company_type":          "Product" | "Service",
            "business_model":        "SaaS" | "Marketplace" | "FinTech Platform" | ...
            "revenue_model":         "Subscription" | "Commission" | "Transaction Fee" | ...
            "delivery_model":        "Web Platform" | "Mobile App" | "API" | ...
            "is_saas":               bool,
            "category":              "SaaS" | "Non-SaaS Product" | "Service",  # compat
            "confidence":            int (0-100),
            "scores":                dict,
            "low_confidence":        bool,
            "classification_reason": str,
        }
    """

    # ── Build text corpora ────────────────────────────────────────────────────
    page_text = ' '.join(filter(None, [
        website_data.get('title', '')          if website_data else '',
        website_data.get('header', '')         if website_data else '',
        website_data.get('nav', '')            if website_data else '',
        website_data.get('hero', '')           if website_data else '',
        website_data.get('pricing', '')        if website_data else '',
        website_data.get('full_text', '')[:3000] if website_data else '',
        website_data.get('meta_description', '') if website_data else '',
        description,
        ddgs_snippets,
    ])).lower()

    meta_corpus = ' '.join(filter(None, [
        website_data.get('title', '')          if website_data else '',
        website_data.get('meta_description', '') if website_data else '',
        description,
    ])).lower()

    nav_text  = (website_data.get('nav', '')       if website_data else '').lower()
    scan_text = (website_data.get('scan_text', '') if website_data else '').lower()

    if not page_text.strip():
        return {
            'category': 'Service', 'company_type': 'Service',
            'business_model': 'Other', 'revenue_model': 'Hybrid',
            'delivery_model': 'Web Platform',
            'is_saas': False, 'confidence': 0,
            'scores': {}, 'low_confidence': True,
            'classification_reason': 'No evidence available',
        }

    # ── Score buckets ─────────────────────────────────────────────────────────
    # subscription  = explicit SaaS/recurring-billing evidence
    # marketplace   = P2P / commission / capital-provision / exchange evidence
    # service       = consulting / agency / implementation evidence
    # hardware      = physical product / e-commerce evidence
    scores = {'subscription': 0, 'marketplace': 0, 'service': 0, 'hardware': 0}

    # ── 1. Subscription signals (true SaaS evidence) ─────────────────────────
    # CRITICAL: login, dashboard, sign-up are NOT here.
    # Those exist on any lending portal, client portal, or admin panel.
    _SUBSCRIPTION = {
        'free trial': 8, 'start free trial': 8, 'try for free': 8, 'try it free': 8,
        'pricing plan': 6, 'subscription plan': 6, 'monthly plan': 6, 'annual plan': 6,
        'per user per month': 9, 'per seat per month': 9, 'per seat': 7, 'per user': 5,
        '/month': 4, '/year': 4, 'per month': 4, 'per year': 4,
        'cancel anytime': 7, 'upgrade plan': 5, 'downgrade': 4,
        'subscription': 5, 'subscribe': 4, 'recurring': 4,
        'billing cycle': 5, 'billing': 3,
        'saas': 8, 'software as a service': 8,
        'management software': 3, 'management platform': 3,  # consulting firms say "we build management platforms"
        'hr platform': 5, 'hr software': 5, 'crm software': 6, 'erp software': 6,
        'accounting software': 5, 'payroll software': 5,
        'cloud platform': 2, 'cloud-based': 2, 'cloud service': 2,  # generic; consulting firms use these too
        'workflow automation': 4, 'integrations': 3,
        ' api ': 4, 'api access': 4, 'rest api': 4, 'graphql': 3,
        'open source': 4, 'open-source': 4,
        'our products': 5, 'our software': 5,
        'project management': 4, 'performance management': 4,
        'talent management': 4, 'employee engagement': 4,
        'built for teams': 3,
        # Mobile-first / freemium SaaS signals (spec: Free Plan +40, Premium Plan +40, etc.)
        # These don't appear on lending portals or IT consulting sites
        'free plan': 10, 'free-plan': 10,
        'premium plan': 8, 'premium plans': 8, 'premium subscription': 9,
        'freemium': 10, 'upgrade to premium': 8,
        'cloud storage': 5,
        'automatic sync': 4, 'auto-sync': 4, 'sync across': 4,
        'continuous updates': 3, 'automatic updates': 3,
        # Personal finance / wealth management / document vault apps
        # These are often SPAs with no pricing page but are clearly SaaS products.
        'personal finance': 5, 'personal savings': 4, 'financial wellness': 3,
        'portfolio tracking': 5, 'investment tracking': 4,
        'organise investments': 5, 'organize investments': 5,
        'digital locker': 6, 'document locker': 5, 'digital vault': 6,
        'in one secure place': 3, 'family access': 3,
        'sebi-regulated': 4, 'sebi registered': 4,
    }

    # ── 2. Marketplace signals (P2P / commission / FinTech lending) ──────────
    # These companies are Product but NOT SaaS — they earn via transactions.
    # Guide: "Marketplace, investors, borrowers, buyers, sellers, merchants,
    #  peer-to-peer, lending, loans, commission, transaction fee, brokerage"
    _MARKETPLACE = {
        # Platform / exchange patterns
        'marketplace': 7, 'peer-to-peer': 8, 'p2p': 5,
        'borrowers': 8, 'lenders': 7, 'investors and': 6,
        'buyers and sellers': 7, 'buyers & sellers': 7,
        'merchants': 5, 'brokerage': 6, 'exchange': 4,
        'commission': 6, 'transaction fee': 7, 'listing fee': 6,
        # FinTech capital provision (beatBread, Clearco, Kavod, Capital On Tap…)
        'revenue advance': 9, 'revenue-based financing': 9, 'revenue share financing': 8,
        'merchant cash advance': 9, 'working capital loan': 9, 'business loan': 7,
        'business loans': 7, 'invoice financing': 9, 'invoice factoring': 9,
        'accounts receivable': 7, 'credit facility': 7, 'line of credit': 6,
        'equity-free funding': 8, 'equity-free capital': 8,
        'blended finance': 8, 'development finance': 7,
        'we lend': 9, 'we provide funding': 8, 'we provide capital': 8,
        'advance on future': 8, 'advance against future': 8,
        'community lending': 9, 'peer lending': 9, 'crowdlending': 8,
        'crowdfunding': 7, 'crowdinvesting': 8,
        # Crypto / NFT
        'nft marketplace': 8, 'token marketplace': 7,
        # Real estate marketplace
        'property listings': 6, 'real estate marketplace': 7,
        # Revenue-share / royalty advance (music, content)
        'royalty advance': 8, 'music advance': 8, 'advance against royalties': 9,
    }

    # ── 3. Service signals (consulting / agency) ─────────────────────────────
    _SERVICE = {
        'consultancy': 6, 'consulting firm': 6, 'consulting company': 6,
        'digital agency': 7, 'creative agency': 7, 'marketing agency': 7,
        'advertising agency': 7, 'design agency': 7,
        'request a quote': 6, 'request quote': 6, 'get a quote': 6,
        'request a proposal': 6,
        'staff augmentation': 7, 'outsourcing': 6,
        'dedicated team': 5, 'hire developers': 6, 'hire our': 5,
        'offshore development': 6, 'nearshore development': 6,
        'managed services': 5, 'managed service provider': 6,
        'custom development': 5, 'bespoke': 5,
        'implementation services': 5,
        'client portal': 4, 'client login': 4,
        'we build for': 5, 'built for your': 4,
        # IT consulting / digital engineering (spec Stage 1 service signals)
        'technology consulting': 7, 'cybersecurity consulting': 7,
        'it service management': 6, 'it consulting': 7,
        'digital engineering': 5, 'cloud engineering': 4,
        'digital transformation services': 7, 'digital transformation company': 6,
        'professional services': 6, 'professional services firm': 7,
        'software development services': 6, 'software development company': 5,
        'system integration': 6, 'erp implementation': 6, 'crm implementation': 6,
        # Client evidence signals — only service companies have these
        'case studies': 4, 'case study': 4,
        'industries served': 5, 'industries we serve': 5,
        'client success': 4, 'client projects': 4,
        # Non-profits / foundations
        'charitable foundation': 9, 'philanthropic foundation': 9,
        'grant-making': 9, 'grant making': 9, 'philanthropic': 8,
        # Property management (not marketplace)
        'property management company': 8, 'real estate management': 7,
    }

    # ── 4. Hardware / e-commerce signals ─────────────────────────────────────
    _HARDWARE = {
        'hardware': 6, 'device': 5, 'equipment': 4,
        'add to cart': 6, 'shop now': 5, 'buy now': 5,
        'one-time purchase': 5, 'one time payment': 5,
        'warranty': 5, 'ships to': 4, 'shipping': 3,
        'on-premise': 5, 'on-prem': 5, 'on premise': 5,
        'desktop application': 4, 'desktop app': 4,
        'license key': 5, 'perpetual license': 5,
        'cdn.shopify.com': 5, 'woocommerce': 5,
        # Spec negative signals
        'one-time license': 5, 'offline installer': 5,
        'physical catalogue': 7, 'physical catalog': 7, 'hardware device': 6,
    }

    # Keyword scoring
    for term, weight in _SUBSCRIPTION.items():
        if term in page_text:
            scores['subscription'] += weight
    for term, weight in _MARKETPLACE.items():
        if term in page_text:
            scores['marketplace'] += weight
    for term, weight in _SERVICE.items():
        if term in page_text:
            scores['service'] += weight
    for term, weight in _HARDWARE.items():
        if term in page_text:
            scores['hardware'] += weight

    # ── 2. Nav signals ────────────────────────────────────────────────────────
    for tab in ['pricing', 'api', 'integrations', 'documentation', 'docs', 'changelog', 'products']:
        if tab in nav_text: scores['subscription'] += 3
    for tab in ['marketplace', 'investors', 'borrowers', 'lenders', 'sellers', 'borrow', 'invest']:
        if tab in nav_text: scores['marketplace'] += 4
    for tab in ['services', 'clients', 'our work', 'expertise', 'what we do']:
        if tab in nav_text: scores['service'] += 2
    for tab in ['shop', 'store', 'cart', 'catalog']:
        if tab in nav_text: scores['hardware'] += 3

    # ── 3. CTA signals ────────────────────────────────────────────────────────
    for cta in ['start free trial', 'get started free', 'try for free', 'start for free',
                'sign up free', 'create free account']:
        if cta in page_text: scores['subscription'] += 5
    for cta in ['request a quote', 'request quote', 'get a quote', 'request a proposal']:
        if cta in page_text: scores['service'] += 4
    for cta in ['buy now', 'add to cart', 'shop now', 'order now']:
        if cta in page_text: scores['hardware'] += 4

    # ── 4. HTML structural signals ────────────────────────────────────────────
    if website_data:
        if website_data.get('has_pricing_detected'):  scores['subscription'] += 6
        if website_data.get('has_web_app_link'):      scores['subscription'] += 3
        # Mobile app is the primary distribution channel for mobile-first SaaS —
        # weight higher than before (was 2/3) to reflect that App Store presence
        # is equivalent to a pricing page for mobile-first companies.
        if website_data.get('has_mobile_app'):        scores['subscription'] += 4
        if website_data.get('has_app_store_link'):    scores['subscription'] += 5
        if website_data.get('has_play_store_link'):   scores['subscription'] += 5
        # login/dashboard do NOT add subscription points (client portals have these too)

    # ── 5. Tech stack fingerprints ────────────────────────────────────────────
    if scan_text:
        for fp, w in [('chargebee.com', 5), ('recurly.com', 5), ('paddle.com', 4),
                      ('auth0.com', 3), ('launchdarkly.com', 3), ('pendo.io', 2),
                      ('segment.com', 2), ('mixpanel.com', 2), ('amplitude.com', 2)]:
            if fp in scan_text: scores['subscription'] += int(w * 0.7)
        for fp, w in [('cdn.shopify.com', 6), ('shopify.com', 5), ('woocommerce', 5),
                      ('bigcommerce.com', 5), ('magento', 4)]:
            if fp in scan_text: scores['hardware'] += int(w * 0.7)

    # ── 6. Meta-tag scoring ───────────────────────────────────────────────────
    for term in ['software', 'platform', 'saas', 'crm', 'erp', 'tool', 'app',
                 'suite', 'solution', 'management system', 'cloud service']:
        if term in meta_corpus: scores['subscription'] += 2
    for term in ['consulting', 'consultancy', 'agency', 'advisory', 'outsourcing']:
        if term in meta_corpus: scores['service'] += 2
    for term in ['marketplace', 'exchange', 'lending platform', 'crowdfunding', 'fintech platform']:
        if term in meta_corpus: scores['marketplace'] += 3

    # ── 7. G2/Capterra presence = software product (strong subscription signal) ─
    if ddgs_snippets:
        snip_l = ddgs_snippets.lower()
        if 'g2.com' in snip_l or 'capterra.com' in snip_l or 'getapp.com' in snip_l:
            scores['subscription'] += 7

    # ── 8. Page URL weighting (spec: /services → Service; /pricing → SaaS) ──────
    # Check nav and scan text for URL patterns indicating business model
    if scan_text:
        _service_paths = ['/services', '/consulting', '/case-studies', '/case-studies',
                          '/clients', '/industries', '/our-work', '/portfolio']
        _saas_paths = ['/pricing', '/plans', '/signup', '/sign-up', '/register', '/demo']
        for p in _service_paths:
            if f'href="{p}"' in scan_text or f"href='{p}'" in scan_text:
                scores['service'] += 3
                break
        for p in _saas_paths:
            if f'href="{p}"' in scan_text or f"href='{p}'" in scan_text:
                scores['subscription'] += 3
                break

    # ── 9. Consulting penalty — IT service companies must not score as SaaS ─────
    # If 2+ consulting markers present AND no subscription anchors (trial/pricing/per-month),
    # the company is almost certainly an IT services firm, not a SaaS product.
    _CONSULTING_MARKERS = [
        'consulting', 'consultancy', 'technology consulting', 'it consulting',
        'professional services', 'managed services', 'cybersecurity consulting',
        'it service management', 'digital transformation services', 'staff augmentation',
        'outsourcing', 'case studies', 'industries served',
    ]
    _SUB_ANCHORS = [
        'free trial', 'start free trial', 'per month', 'per user', 'subscription plan',
        'billing', 'saas', 'pricing plan', 'cancel anytime',
    ]
    _consulting_hit_count = sum(1 for m in _CONSULTING_MARKERS if m in page_text)
    _has_sub_anchor = any(a in page_text for a in _SUB_ANCHORS)
    _has_pricing_struct = bool(website_data and website_data.get('has_pricing_detected'))
    if _consulting_hit_count >= 2 and not _has_sub_anchor and not _has_pricing_struct:
        scores['subscription'] = max(0, scores['subscription'] - 12)
        scores['service'] += 6

    # ── SaaS determination (v2 core rule from guide) ─────────────────────────
    # "Do not classify SaaS because a login or dashboard exists."
    # SaaS requires: explicit subscription evidence AND subscription > marketplace.
    _SUBSCRIPTION_THRESHOLD = 10
    is_saas = (
        scores['subscription'] >= _SUBSCRIPTION_THRESHOLD
        and scores['subscription'] > scores['marketplace']
    )

    # ── Business model ────────────────────────────────────────────────────────
    top_bucket = max(scores, key=scores.get)

    _fin_terms = ['lending', 'loan', 'credit', 'financing', 'fintech', 'financial',
                  'advance', 'capital', 'crowdfund', 'factoring']

    if top_bucket == 'service':
        # Service bucket wins — go to service/agency/foundation checks below
        business_model = None  # resolved in service block
    elif scores['marketplace'] > 0 and scores['marketplace'] >= scores['subscription']:
        # Marketplace or FinTech beats subscription
        if any(t in page_text for t in _fin_terms):
            business_model = 'FinTech Platform'
        else:
            business_model = 'Marketplace'
    elif is_saas:
        if any(t in page_text for t in ['healthcare', 'health platform', 'clinical', 'medical']):
            business_model = 'Healthcare Platform'
        elif any(t in page_text for t in ['learning management', 'e-learning', 'edtech', 'lms', 'education platform']):
            business_model = 'Education Platform'
        elif scores['subscription'] > 15 and any(t in page_text for t in ['api platform', 'developer platform', 'api-first']):
            business_model = 'API Platform'
        else:
            business_model = 'SaaS'
    elif top_bucket == 'hardware':
        business_model = 'E-commerce' if any(t in page_text for t in ['add to cart', 'shop now', 'shopify']) else 'Hardware'
    else:
        business_model = 'Other'

    # Service / agency / foundation override (runs after top_bucket check)
    if top_bucket == 'service' or business_model is None:
        if any(t in page_text for t in ['agency', 'digital agency', 'creative agency', 'marketing agency']):
            business_model = 'Agency'
        elif any(t in page_text for t in ['charitable foundation', 'philanthropic', 'grant-making']):
            business_model = 'Other'
        elif any(t in page_text for t in _fin_terms) and scores['marketplace'] > 0:
            business_model = 'FinTech Platform'
        else:
            business_model = 'Consulting'
    if business_model is None:
        business_model = 'Other'
    # Media override
    if any(t in page_text for t in ['media', 'news', 'publisher', 'publication']) and scores['subscription'] < 8 and business_model == 'Other':
        business_model = 'Media'

    # ── Company type ─────────────────────────────────────────────────────────
    if top_bucket == 'service' and scores['service'] > scores['subscription'] and scores['service'] > scores['marketplace']:
        company_type = 'Service'
    elif scores['service'] > max(scores['subscription'], scores['marketplace']) * 0.8 and scores['service'] > 12:
        company_type = 'Service'
    else:
        company_type = 'Product'

    # ── Non-SaaS validation gate ──────────────────────────────────────────────
    # Per spec: only classify Non-SaaS when there is explicit non-cloud evidence
    # OR marketplace revenue dominates. Mobile-first and freemium SaaS companies
    # often lack a pricing page and therefore under-score on subscription signals.
    if not is_saas and company_type == 'Product':
        _gate_non_cloud = scores['hardware'] > 8 or any(s in page_text for s in [
            'on-premise', 'on-prem', 'perpetual license', 'one-time license',
            'offline installer', 'desktop application', 'installed locally',
        ])
        _gate_marketplace = (
            scores['marketplace'] > 0 and scores['marketplace'] >= scores['subscription']
        )
        _gate_mobile_freemium = bool(
            (website_data and (
                website_data.get('has_mobile_app') or website_data.get('has_web_app_link')
            )) or
            any(s in page_text for s in ['free plan', 'premium plan', 'freemium', 'subscription app'])
        )
        if _gate_mobile_freemium and not _gate_non_cloud and not _gate_marketplace:
            is_saas = True
            if business_model in ('Other', None):
                business_model = 'SaaS'

    # ── Stage 2: Service subtype (spec requirement) ───────────────────────────
    company_subtype = None
    if company_type == 'Service':
        if any(t in page_text for t in ['staff augmentation', 'outsourcing', 'nearshore', 'offshore', 'body shopping']):
            company_subtype = 'Staff Augmentation'
        elif any(t in page_text for t in ['managed services', 'managed service provider']):
            company_subtype = 'Managed Services'
        elif any(t in page_text for t in ['system integration', 'erp implementation', 'crm implementation']):
            company_subtype = 'System Integration'
        elif any(t in page_text for t in ['digital agency', 'creative agency', 'marketing agency', 'advertising agency']):
            company_subtype = 'Digital Agency'
        elif any(t in page_text for t in ['cybersecurity consulting', 'technology consulting', 'it consulting', 'it service management']):
            company_subtype = 'IT Consulting'
        elif any(t in page_text for t in ['software development services', 'custom development', 'custom software', 'bespoke']):
            company_subtype = 'Software Development Services'
        elif any(t in page_text for t in ['digital transformation services', 'digital transformation company', 'digital transformation']):
            company_subtype = 'Digital Transformation'
        else:
            company_subtype = 'Consulting'
    elif is_saas:
        if any(t in page_text for t in ['api platform', 'developer platform', 'api-first']):
            company_subtype = 'API Platform'
        elif any(t in page_text for t in ['hr platform', 'hr software', 'talent management']):
            company_subtype = 'HR Platform'
        elif any(t in page_text for t in ['crm software', 'crm platform', 'sales platform']):
            company_subtype = 'CRM'
        else:
            company_subtype = 'SaaS'
    elif company_type == 'Product':
        company_subtype = business_model

    # ── Revenue model ─────────────────────────────────────────────────────────
    if scores['marketplace'] > 0 and scores['marketplace'] >= scores['subscription']:
        if any(t in page_text for t in ['transaction fee', 'per transaction', 'takes a fee']):
            revenue_model = 'Transaction Fee'
        else:
            revenue_model = 'Commission'
    elif is_saas:
        if any(t in page_text for t in ['free plan', 'free forever', 'freemium']):
            revenue_model = 'Freemium'
        elif any(t in page_text for t in ['usage', 'api calls', 'per call', 'per request', 'pay as you go']):
            revenue_model = 'Usage Based'
        else:
            revenue_model = 'Subscription'
    elif company_type == 'Service':
        revenue_model = 'Consulting Fee'
    elif scores['hardware'] > 8:
        if any(t in page_text for t in ['license key', 'perpetual', 'one-time']):
            revenue_model = 'Licensing'
        else:
            revenue_model = 'One-Time Purchase'
    elif any(t in page_text for t in ['advertising', 'ad revenue', 'sponsored']):
        revenue_model = 'Advertising'
    else:
        revenue_model = 'Hybrid'

    # ── Delivery model ────────────────────────────────────────────────────────
    has_mobile  = bool(website_data and website_data.get('has_mobile_app'))
    has_desktop = any(t in page_text for t in ['desktop app', 'desktop application', 'windows app', 'mac app', 'on-premise', 'on-prem'])
    has_api_prim = 'api platform' in page_text or ('api-first' in page_text)

    if scores['hardware'] > 10 and not has_mobile and not is_saas:
        delivery_model = 'Hardware'
    elif has_desktop and not is_saas:
        delivery_model = 'Desktop Software'
    elif has_api_prim:
        delivery_model = 'API'
    elif has_mobile and (is_saas or scores['marketplace'] > 5):
        delivery_model = 'Hybrid'
    else:
        delivery_model = 'Web Platform'

    # ── Confidence (evidence-weighted per guide) ──────────────────────────────
    conf = 0
    if website_data:
        conf += 10  # homepage scraped
        if website_data.get('has_pricing_detected'): conf += 20
        if description:                              conf += 15
        if len(website_data.get('full_text', '')) > 1000: conf += 10
    elif description:
        conf += 15
    winner_score = max(scores.values()) if scores else 0
    if winner_score > 25:  conf += 20
    elif winner_score > 12: conf += 10
    # Contradiction penalty
    sv = sorted(scores.values(), reverse=True)
    if len(sv) >= 2 and sv[0] > 0:
        gap = sv[0] - sv[1]
        if gap < 5:  conf -= 15
        elif gap < 10: conf -= 5
    conf = max(0, min(100, conf))

    # ── Backward-compat category field ───────────────────────────────────────
    if is_saas:
        category = 'SaaS'
    elif company_type == 'Product':
        category = 'Non-SaaS Product'
    else:
        category = 'Service'

    # ── Build evidence list (spec structured output) ─────────────────────────
    evidence = []
    if website_data and website_data.get('has_pricing_detected'):
        evidence.append('Pricing page detected.')
    if website_data and website_data.get('has_login_detected'):
        evidence.append('Login page detected.')
    if website_data and website_data.get('has_mobile_app'):
        evidence.append('Mobile app (App Store / Play Store) detected.')
    if scores['subscription'] > 0:
        evidence.append(f'Subscription signals score: {scores["subscription"]}.')
    if scores['service'] > 0:
        evidence.append(f'Service signals score: {scores["service"]}.')
    if scores['marketplace'] > 0:
        evidence.append(f'Marketplace signals score: {scores["marketplace"]}.')
    if _consulting_hit_count >= 2 and not _has_sub_anchor and not _has_pricing_struct:
        evidence.append(f'Consulting penalty applied ({_consulting_hit_count} markers, no subscription anchor).')
    if not evidence:
        evidence.append('No strong evidence available.')

    classification_reason = (
        f'Business model: {business_model}. '
        f'Subscription: {scores["subscription"]}, Marketplace: {scores["marketplace"]}, '
        f'Service: {scores["service"]}, Hardware: {scores["hardware"]}. '
        f'is_saas={is_saas} (sub>={_SUBSCRIPTION_THRESHOLD} AND sub>marketplace). '
        f'Confidence: {conf}.'
    )

    return {
        'category':               category,
        'company_type':           company_type,
        'company_subtype':        company_subtype,
        'business_model':         business_model,
        'revenue_model':          revenue_model,
        'delivery_model':         delivery_model,
        'is_saas':                is_saas,
        'confidence':             conf,
        'scores':                 scores,
        'low_confidence':         conf < 50,
        'classification_reason':  classification_reason,
        'evidence':               evidence,
    }


# Keep backward compatibility
def analyze_website_with_openai(website_data: dict, company_name: str, openai_key: str) -> dict:
    return analyze_with_openai(website_data, company_name, openai_key)