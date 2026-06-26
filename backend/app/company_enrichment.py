"""
Company deep-enrichment helpers — tech stack, jobs, email pattern,
news, revenue estimate, social profiles, traffic, review presence.
"""
import re
import os
import requests

_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
_HEADERS = {"User-Agent": _UA, "Accept-Language": "en-US,en;q=0.9"}


# ─── 1. Tech Stack ────────────────────────────────────────────────────────────

_TECH_SIGS: dict[str, list[str]] = {
    # Frontend
    "React":        ["react-dom", "data-reactroot", "_reactFiber", "react.production"],
    "Next.js":      ["_next/static", "__NEXT_DATA__", "next/dist"],
    "Vue.js":       ["vue.runtime", "__vue__", "data-v-", "/vue.min.js"],
    "Nuxt":         ["_nuxt/", "__nuxt"],
    "Angular":      ["ng-version", "zone.js", "/angular.min.js"],
    "Svelte":       ["svelte", "__svelte"],
    "Gatsby":       ["gatsby-", "___gatsby"],
    "Webflow":      ["webflow.com", "data-wf-"],
    "WordPress":    ["wp-content/", "wp-includes/", "wpemoji"],
    "Shopify":      ["shopify.com/s/files", "Shopify.theme", "myshopify.com"],
    "Wix":          ["wix.com/", "wixstatic.com"],
    # Analytics
    "Google Analytics": ["google-analytics.com/analytics.js", "gtag/js", "ga('send"],
    "Google Tag Manager": ["googletagmanager.com/gtm.js", "GTM-"],
    "Segment":      ["segment.io/analytics.js", "analytics.load("],
    "Mixpanel":     ["mixpanel.com/lib", "mixpanel.init("],
    "Hotjar":       ["hotjar.com/c/hotjar", "hjSiteSettings"],
    "Amplitude":    ["amplitude.com/libs", "amplitude.getInstance"],
    "Heap":         ["heap.io/js", "heap.load("],
    "PostHog":      ["posthog.com/static", "posthog.init("],
    # CRM / Marketing
    "HubSpot":      ["js.hs-scripts.com", "js.hubspot.com", "hbspt.forms"],
    "Salesforce":   ["salesforce.com", "pardot.com/pd.js", "force.com"],
    "Marketo":      ["marketo.net/js/forms2", "Munchkin.init("],
    "Pardot":       ["pi.pardot.com", "pardot.com/pd.js"],
    "ActiveCampaign": ["activehosted.com", "activecampaign.com"],
    # Chat / Support
    "Intercom":     ["widget.intercom.io", "intercomSettings", "app.intercom.io/widget"],
    "Zendesk":      ["static.zdassets.com", "ekr.zdassets.com", "zESettings"],
    "Drift":        ["js.driftt.com", "window.drift"],
    "Crisp":        ["client.crisp.chat", "window.$crisp"],
    "Freshchat":    ["wchat.freshchat.com", "freshchat.com/js"],
    "Tawk.to":      ["tawk.to/s1/", "Tawk_API"],
    # Payments
    "Stripe":       ["js.stripe.com", "Stripe("],
    "PayPal":       ["paypalobjects.com", "paypal.Buttons"],
    "Braintree":    ["braintreegateway.com", "braintree.client.create"],
    "Paddle":       ["paddle.com/product", "Paddle.Setup("],
    "Chargebee":    ["chargebee.com/js", "Chargebee.init("],
    # Infrastructure
    "Cloudflare":   ["cdnjs.cloudflare.com", "__cfduid", "cf-ray"],
    "AWS CloudFront": ["cloudfront.net"],
    "Fastly":       ["fastly.net"],
    # Scheduling
    "Calendly":     ["calendly.com/assets", "initInlineWidget"],
    "Chili Piper":  ["chilipiper.com"],
    # Forms
    "Typeform":     ["typeform.com/to/", "embed.typeform.com"],
    "SurveyMonkey": ["surveymonkey.com/r/"],
    # ABM / Intent
    "6sense":       ["6sense.com"],
    "Demandbase":   ["demandbase.com/js"],
    "Clearbit":     ["clearbit.com/v1/companies"],
}


_HEADER_TECH_SIGS: dict[str, list[str]] = {
    "Next.js":     ["x-powered-by: next.js", "x-nextjs"],
    "Vercel":      ["x-vercel-id", "x-vercel-cache", "server: vercel"],
    "Cloudflare":  ["cf-ray", "server: cloudflare"],
    "Fastly":      ["x-served-by: cache", "fastly-restarts"],
    "AWS CloudFront": ["x-amz-cf-id", "x-amz-cf-pop"],
    "Nginx":       ["server: nginx"],
    "Apache":      ["server: apache"],
    "WordPress":   ["x-pingback", "x-powered-by: php", "link: <https://api.w.org/>"],
    "Shopify":     ["x-shopify-stage", "x-shopid"],
    "Ghost":       ["x-ghost-cache-status"],
}


def detect_tech_stack(website_url: str) -> list[str]:
    if not website_url:
        return []
    try:
        r = requests.get(website_url, headers=_HEADERS, timeout=12, allow_redirects=True)
        html = r.text
        # Include HTTP response headers in scan (catches Next.js, Vercel, Cloudflare even on SPAs)
        headers_text = " ".join(f"{k.lower()}: {v.lower()}" for k, v in r.headers.items())
        body = html.lower()
        combined = body + " " + headers_text
        found = []
        for tech, sigs in _TECH_SIGS.items():
            if any(s.lower() in combined for s in sigs):
                found.append(tech)
        for tech, sigs in _HEADER_TECH_SIGS.items():
            if tech not in found and any(s.lower() in headers_text for s in sigs):
                found.append(tech)
        return found
    except Exception:
        return []


# ─── 2. Job Openings ──────────────────────────────────────────────────────────

def fetch_job_openings(website_url: str, company_name: str) -> list[dict]:
    if not website_url:
        return []
    from urllib.parse import urlparse, urljoin
    # Resolve redirects first (e.g. waycom.io → way.com) so career pages resolve correctly
    try:
        _r = requests.get(website_url, headers=_HEADERS, timeout=8, allow_redirects=True)
        _final = _r.url
    except Exception:
        _final = website_url
    base = f"{urlparse(_final).scheme}://{urlparse(_final).netloc}"

    career_slugs = [
        "/careers", "/jobs", "/join", "/join-us", "/work-with-us",
        "/we-are-hiring", "/openings", "/open-positions", "/opportunities",
        "/hiring", "/team/join", "/about/careers",
    ]

    # Job title patterns to extract from HTML
    _job_re = re.compile(
        r'(?:<(?:h[1-4]|li|td|div)[^>]*>\s*)([A-Z][A-Za-z\s\/\-&,\.]{8,80}(?:Engineer|Developer|Manager|Director|Designer|Lead|Analyst|Specialist|Sales|Marketing|Product|Head|VP|CTO|CEO|Officer|Associate|Intern|Recruiter|Architect|Scientist|Researcher|Consultant|Executive)[A-Za-z\s\/\-,\.]{0,40})(?:\s*<\/)',
        re.I
    )

    seen: set[str] = set()
    jobs: list[dict] = []

    for slug in career_slugs:
        if len(jobs) >= 15:
            break
        try:
            url = urljoin(base, slug)
            r = requests.get(url, headers=_HEADERS, timeout=8, allow_redirects=True)
            if r.status_code != 200:
                continue
            # Check it's actually a careers page, not a generic 200
            page_text = r.text.lower()
            if not any(kw in page_text for kw in ["job", "position", "career", "hiring", "opening", "role", "apply"]):
                continue

            page_jobs = _job_re.findall(r.text)
            for raw in page_jobs:
                title = re.sub(r'\s+', ' ', raw).strip()
                key = title.lower()
                if key not in seen and len(title) > 6:
                    seen.add(key)
                    jobs.append({"title": title, "url": url})
        except Exception:
            continue

    # No DDG fallback — it returns unrelated results when site: filters aren't respected.
    # Only return jobs found directly on the company's own career pages.
    return jobs[:12]


# ─── 3. Email Pattern ─────────────────────────────────────────────────────────

def detect_email_pattern(domain: str, hunter_key: str = "") -> str:
    """Detect company email pattern. Uses Hunter if key available, else infers from DDG."""
    if not domain:
        return ""
    domain = domain.replace("www.", "").split("/")[0].strip()

    # Hunter domain search
    if hunter_key:
        try:
            r = requests.get(
                "https://api.hunter.io/v2/domain-search",
                params={"domain": domain, "api_key": hunter_key, "limit": 1},
                timeout=10,
            )
            if r.status_code == 200:
                data = r.json().get("data", {})
                pattern = data.get("pattern")
                if pattern:
                    return pattern  # e.g. "{first}.{last}"
        except Exception:
            pass

    # DDG fallback — look for email addresses mentioning the domain
    try:
        from ddgs import DDGS
        with DDGS() as d:
            for res in d.text(f'email "{domain}" "@{domain}"', max_results=8):
                snippet = (res.get("body") or res.get("snippet") or "")
                emails = re.findall(r'\b([a-z0-9._%+-]+)@' + re.escape(domain) + r'\b', snippet, re.I)
                if emails:
                    return _infer_pattern(emails)
    except Exception:
        pass
    return ""


def _infer_pattern(emails: list[str]) -> str:
    """Guess email pattern from a list of email local-parts."""
    patterns: dict[str, int] = {}
    for local in emails:
        local = local.lower().strip()
        if re.match(r'^[a-z]+\.[a-z]+$', local):
            patterns["{first}.{last}"] = patterns.get("{first}.{last}", 0) + 1
        elif re.match(r'^[a-z]+$', local) and len(local) > 3:
            patterns["{first}"] = patterns.get("{first}", 0) + 1
        elif re.match(r'^[a-z]\.[a-z]+$', local):
            patterns["{f}.{last}"] = patterns.get("{f}.{last}", 0) + 1
        elif re.match(r'^[a-z]+[a-z]$', local) and len(local) <= 8:
            patterns["{first}{l}"] = patterns.get("{first}{l}", 0) + 1
    if not patterns:
        return ""
    return max(patterns, key=lambda k: patterns[k])


# ─── 4. Recent News ───────────────────────────────────────────────────────────

def _extract_date_from_url(url: str) -> str:
    """Pull YYYY-MM-DD from URL path if present."""
    m = re.search(r'[/_-](\d{4})[/_-](\d{2})[/_-](\d{2})', url)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m2 = re.search(r'[/_-](\d{4})[/_-](\d{2})[/_-]', url)
    if m2:
        return f"{m2.group(1)}-{m2.group(2)}"
    return ""


_BLOG_PATH_KW = re.compile(
    r'/(blog|news|press|articles?|insights?|updates?|posts?|stories|announcements?|resources?)/',
    re.I
)


def _is_article_url(href: str, listing_url: str) -> bool:
    """True if href looks like an individual article, not a nav/footer/category link."""
    from urllib.parse import urlparse
    path = urlparse(href).path.rstrip("/")
    listing_path = urlparse(listing_url).path.rstrip("/")
    # Must be deeper than the listing page (i.e. a child path)
    if not path.startswith(listing_path) or path == listing_path:
        return False
    # Path must contain a blog-section keyword segment
    if not _BLOG_PATH_KW.search(path):
        return False
    # Exclude pagination and category pages: /blog/page/2, /blog/tag/foo
    if re.search(r'/(page|tag|category|author|topic|feed|rss|sitemap)(/|$)', path, re.I):
        return False
    # Must have a slug segment after the keyword (not just /blog/ itself)
    after = _BLOG_PATH_KW.split(path)
    if len(after) < 3 or not after[-1].strip("/"):
        return False
    return True


def _scrape_blog_page(url: str, base_domain: str) -> list[dict]:
    """Scrape a blog/news listing page and extract only article links + titles."""
    from urllib.parse import urljoin, urlparse
    try:
        r = requests.get(url, headers=_HEADERS, timeout=10, allow_redirects=True)
        if r.status_code != 200:
            return []
        # After redirect (e.g. waycom.io → way.com) use the resolved domain
        resolved_domain = urlparse(r.url).netloc.lower().replace("www.", "")
        if resolved_domain and resolved_domain != base_domain:
            base_domain = resolved_domain
        # Confirm page has article-listing signals
        page_lower = r.text.lower()
        if not any(kw in page_lower for kw in ["article", "post", "read more", "published", "blog"]):
            return []

        from html.parser import HTMLParser

        class _ArticleParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.articles = []
                self._current_href = None
                self._current_text = []
                self._in_link = False
                self._pending_date = ""

            def handle_starttag(self, tag, attrs):
                attrs_d = dict(attrs)
                if tag == "time":
                    dt = attrs_d.get("datetime", "")
                    if dt:
                        self._pending_date = dt[:10]
                if tag == "a":
                    href = attrs_d.get("href", "")
                    if not href or href.startswith("#") or href.startswith("javascript"):
                        return
                    abs_href = urljoin(url, href)
                    if base_domain not in abs_href:
                        return
                    # Only keep links that are clearly individual article URLs
                    if _is_article_url(abs_href, url):
                        self._current_href = abs_href
                        self._current_text = []
                        self._in_link = True

            def handle_endtag(self, tag):
                if tag == "a" and self._in_link and self._current_href:
                    text = re.sub(r'\s+', ' ', " ".join(self._current_text)).strip()
                    # Headline-length text only (nav items are short; full paragraphs are too long)
                    if 20 < len(text) < 180:
                        date = self._pending_date or _extract_date_from_url(self._current_href)
                        self.articles.append({
                            "title": text,
                            "url": self._current_href,
                            "date": date,
                            "snippet": "",
                        })
                    self._in_link = False
                    self._current_href = None
                    self._current_text = []

            def handle_data(self, data):
                if self._in_link:
                    self._current_text.append(data.strip())

        parser = _ArticleParser()
        parser.feed(r.text)

        seen: set[str] = set()
        results = []
        for a in parser.articles:
            if a["url"] not in seen and a["url"] != url:
                seen.add(a["url"])
                results.append(a)

        results.sort(key=lambda x: x["date"], reverse=True)
        return results[:10]
    except Exception:
        return []


def fetch_recent_news(company_name: str, domain: str = "", website_url: str = "") -> list[dict]:
    from urllib.parse import urlparse, urljoin
    articles: list[dict] = []
    seen_urls: set[str] = set()

    # ── Step 1: Scrape company's own blog/news pages ──────────────────────────
    base_url = website_url or (f"https://{domain}" if domain else "")
    if base_url:
        # Resolve redirects to get the real domain (e.g. waycom.io → way.com)
        try:
            _r = requests.get(base_url, headers=_HEADERS, timeout=8, allow_redirects=True)
            base_url = _r.url
        except Exception:
            pass
        parsed = urlparse(base_url)
        base_domain = parsed.netloc.lower().replace("www.", "") or domain or ""
        base_root = f"{parsed.scheme}://{parsed.netloc}"

        blog_slugs = ["/blog", "/news", "/press", "/articles", "/insights",
                      "/updates", "/announcements", "/resources/blog", "/en/blog"]
        for slug in blog_slugs:
            if len(articles) >= 5:
                break
            page_url = urljoin(base_root, slug)
            scraped = _scrape_blog_page(page_url, base_domain)
            for item in scraped:
                if len(articles) >= 5:
                    break
                if item["url"] not in seen_urls:
                    seen_urls.add(item["url"])
                    articles.append(item)

    # ── Step 2: DDG site: search as fallback if website had no blog ───────────
    if len(articles) < 3 and domain:
        try:
            from ddgs import DDGS
            clean_domain = domain.replace("www.", "").split("/")[0]
            with DDGS() as d:
                for r in d.text(f'site:{clean_domain}', max_results=10):
                    if len(articles) >= 5:
                        break
                    href = r.get("href") or r.get("url") or ""
                    title = (r.get("title") or "").strip()
                    snippet = (r.get("body") or "").strip()
                    if not href or href in seen_urls:
                        continue
                    # Only articles/blog paths
                    path = urlparse(href).path.lower()
                    if not any(kw in path for kw in ["/blog", "/news", "/press", "/article", "/post", "/insight", "/update"]):
                        continue
                    date = _extract_date_from_url(href)
                    seen_urls.add(href)
                    articles.append({"title": title[:150], "url": href, "snippet": snippet[:200], "date": date})
        except Exception:
            pass

    return articles[:5]


# ─── 5. Revenue Estimate ──────────────────────────────────────────────────────

# Revenue per employee by industry keyword (LinkedIn industry names → RPE)
_INDUSTRY_RPE: list[tuple[str, int]] = [
    ("banking",         300_000),
    ("financial",       250_000),
    ("fintech",         250_000),
    ("insurance",       200_000),
    ("cybersecurity",   200_000),
    ("semiconductor",   300_000),
    ("software",        180_000),
    ("saas",            180_000),
    ("internet",        160_000),
    ("information tech",160_000),
    ("computer",        160_000),
    ("artificial intel",180_000),
    ("health",          150_000),
    ("biotech",         160_000),
    ("pharma",          200_000),
    ("retail",          150_000),
    ("e-commerce",      120_000),
    ("consumer goods",  130_000),
    ("manufactur",      200_000),
    ("automotive",      200_000),
    ("aerospace",       250_000),
    ("telecom",         160_000),
    ("media",           100_000),
    ("entertainment",   100_000),
    ("education",       100_000),
    ("logistics",       130_000),
    ("transportation",  130_000),
    ("consulting",       90_000),
    ("staffing",         80_000),
    ("real estate",     150_000),
]

def estimate_revenue(employee_count, industry: str, classification: str = "") -> str:
    if not employee_count:
        return ""
    # Coerce to string — DB may return int for exact headcount values
    nums = re.findall(r'\d+', str(employee_count).replace(",", ""))
    if not nums:
        return ""
    # Use midpoint of range or single value
    if len(nums) >= 2:
        emp = (int(nums[0]) + int(nums[1])) // 2
    else:
        emp = int(nums[0])
    if emp <= 0:
        return ""

    ind_lower = (industry or "").lower()
    rpe = 100_000  # default fallback
    for keyword, rate in _INDUSTRY_RPE:
        if keyword in ind_lower:
            rpe = rate
            break
    arr = emp * rpe

    if arr < 1_000_000:
        estimate = f"< $1M"
    elif arr < 10_000_000:
        low = round(arr / 1_000_000, 1)
        high = round((arr * 1.5) / 1_000_000, 1)
        estimate = f"${low}M – ${high}M"
    elif arr < 100_000_000:
        low = round(arr / 1_000_000)
        high = round((arr * 1.4) / 1_000_000)
        estimate = f"${low}M – ${high}M"
    elif arr < 1_000_000_000:
        low = round(arr / 1_000_000)
        high = round((arr * 1.3) / 1_000_000)
        estimate = f"${low}M – ${high}M"
    else:
        low = round(arr / 1_000_000_000, 1)
        estimate = f"${low}B+"

    return estimate


# ─── 6. Social Profiles ───────────────────────────────────────────────────────

_SOCIAL_PATTERNS = {
    "twitter":   re.compile(r'https?://(?:www\.)?(?:twitter|x)\.com/([A-Za-z0-9_]{1,50})', re.I),
    "instagram": re.compile(r'https?://(?:www\.)?instagram\.com/([A-Za-z0-9_.]{1,50})', re.I),
    "youtube":   re.compile(r'https?://(?:www\.)?youtube\.com/(?:c/|channel/|@)?([A-Za-z0-9_\-]{2,80})', re.I),
    "facebook":  re.compile(r'https?://(?:www\.)?facebook\.com/([A-Za-z0-9_.]{3,80})', re.I),
    "tiktok":    re.compile(r'https?://(?:www\.)?tiktok\.com/@([A-Za-z0-9_.]{2,50})', re.I),
}

_SOCIAL_SKIP = {"sharer", "share", "login", "signup", "intent", "home", "watch", "results", "search"}


def extract_social_profiles(website_url: str, company_name: str = "") -> dict:
    if not website_url:
        return {}
    result = {}
    # Step 1: scrape website HTML (works for server-rendered sites)
    try:
        r = requests.get(website_url, headers=_HEADERS, timeout=10, allow_redirects=True)
        # Scan raw HTML + also fetch the final redirected URL's base page
        html = r.text
        for platform, pat in _SOCIAL_PATTERNS.items():
            for m in pat.finditer(html):
                handle = m.group(1).rstrip("/").lower()
                if handle and handle not in _SOCIAL_SKIP and len(handle) > 1:
                    result[platform] = m.group(0).split("?")[0]
                    break
    except Exception:
        pass

    # Step 2: DDG fallback for SPAs where social links are in JS bundles
    if len(result) < 2:
        try:
            from ddgs import DDGS
            domain = website_url.replace("https://", "").replace("http://", "").split("/")[0]
            search_term = company_name or domain
            with DDGS() as d:
                for res in d.text(f'"{search_term}" social media twitter instagram linkedin', max_results=8):
                    snippet = (res.get("body") or "") + " " + (res.get("title") or "") + " " + (res.get("href") or "")
                    for platform, pat in _SOCIAL_PATTERNS.items():
                        if platform not in result:
                            for m in pat.finditer(snippet):
                                handle = m.group(1).rstrip("/").lower()
                                if handle and handle not in _SOCIAL_SKIP and len(handle) > 1:
                                    result[platform] = m.group(0).split("?")[0]
                                    break
                    if len(result) >= 3:
                        break
        except Exception:
            pass

    return result


# ─── 7. Traffic Estimate ─────────────────────────────────────────────────────

def fetch_traffic_estimate(domain: str) -> str:
    if not domain:
        return ""
    domain = domain.replace("www.", "").split("/")[0].strip()

    try:
        from ddgs import DDGS
        queries = [
            f'site:similarweb.com "{domain}"',
            f'"{domain}" monthly visitors traffic',
            f'"{domain}" web traffic rank',
        ]
        with DDGS() as d:
            for q in queries:
                for res in d.text(q, max_results=4):
                    snippet = (res.get("body") or res.get("snippet") or "")
                    title = (res.get("title") or "")
                    combined = (title + " " + snippet).lower()

                    # Look for monthly visitor numbers — must start with a digit
                    m = re.search(
                        r'(\d[\d,.]*\s*[KMBkmb]?)\s*(?:monthly\s+)?(?:unique\s+)?(?:visitors?|visits?)',
                        combined, re.I
                    )
                    if m:
                        raw = m.group(1).strip().upper()
                        # Sanity check: skip if it's clearly just "1" or "2" (noise)
                        digits = re.sub(r'[^0-9]', '', raw)
                        if len(digits) < 3 and not any(c in raw for c in 'KMBkmb'):
                            pass
                        else:
                            return f"~{raw} monthly visitors"

                    # Look for global rank
                    rank_m = re.search(
                        r'(?:global|world(?:wide)?)\s+rank(?:ing)?[:\s#]+([0-9,]+)',
                        combined, re.I
                    )
                    if rank_m:
                        rank_str = rank_m.group(1).replace(",", "")
                        try:
                            rank = int(rank_str)
                            if rank < 1_000:
                                return f"Top 1K globally (rank #{rank:,})"
                            elif rank < 10_000:
                                return f"Top 10K globally (rank #{rank:,})"
                            elif rank < 100_000:
                                return f"Top 100K globally (rank #{rank:,})"
                            elif rank < 1_000_000:
                                return f"Top 1M globally (rank #{rank:,})"
                            else:
                                return f"Rank #{rank:,} globally"
                        except ValueError:
                            pass
    except Exception:
        pass

    return ""


# ─── 8. Review Presence ───────────────────────────────────────────────────────

def fetch_review_presence(company_name: str, domain: str = "") -> dict:
    result: dict[str, dict] = {}
    _clean = re.sub(r'[^a-z0-9 ]', '', company_name.lower()).strip()

    platforms = {
        "g2":        f'site:g2.com "{company_name}"',
        "capterra":  f'site:capterra.com "{company_name}"',
        "trustpilot": f'site:trustpilot.com "{company_name}"',
    }

    try:
        from ddgs import DDGS
        with DDGS() as d:
            for platform, query in platforms.items():
                try:
                    for res in d.text(query, max_results=3):
                        href = res.get("href") or res.get("url") or ""
                        snippet = res.get("body") or res.get("snippet") or ""
                        title = res.get("title") or ""

                        # Validate it's actually about this company
                        if _clean and not any(w in (title + snippet).lower() for w in _clean.split() if len(w) > 2):
                            continue

                        if platform not in href.lower():
                            continue

                        entry: dict = {"url": href}

                        # Extract rating
                        rating_m = re.search(r'(\d+\.?\d*)\s*(?:out of\s*)?(?:\/\s*)?5(?:\.0)?(?:\s*stars?)?', snippet, re.I)
                        if rating_m:
                            entry["rating"] = rating_m.group(1)

                        # Extract review count
                        count_m = re.search(r'([\d,]+)\s+(?:reviews?|ratings?)', snippet, re.I)
                        if count_m:
                            entry["reviews"] = count_m.group(1).replace(",", "")

                        result[platform] = entry
                        break
                except Exception:
                    continue
    except Exception:
        pass

    return result
