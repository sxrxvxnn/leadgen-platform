import re
import socket
import smtplib
import requests
from collections import Counter
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}

# Generic role addresses — useless for pattern detection
_GENERIC_LOCALS = {
    "info", "support", "hello", "contact", "admin", "sales", "help",
    "noreply", "no-reply", "marketing", "press", "hr", "jobs", "careers",
    "team", "office", "mail", "email", "enquiries", "enquiry", "billing",
    "legal", "privacy", "security", "abuse", "postmaster", "webmaster",
}


def extract_domain(website: str) -> str:
    if not website:
        return None
    website = website.replace("https://", "").replace("http://", "").replace("www.", "")
    return website.split("/")[0].strip().lower()


# ─── DNS helpers ──────────────────────────────────────────────────────────────

def _has_mx(domain: str) -> bool:
    try:
        resp = requests.get(
            "https://dns.google/resolve",
            params={"name": domain, "type": "MX"},
            timeout=4,
        )
        if resp.status_code == 200:
            return bool(resp.json().get("Answer"))
    except Exception:
        pass
    return False


def _get_mx_host(domain: str) -> str | None:
    try:
        resp = requests.get(
            "https://dns.google/resolve",
            params={"name": domain, "type": "MX"},
            timeout=4,
        )
        if resp.status_code == 200:
            answers = resp.json().get("Answer") or []
            if answers:
                # Sort by priority (lowest = preferred); data is "10 mail.example.com."
                sorted_ans = sorted(answers, key=lambda a: int(a["data"].split()[0]))
                return sorted_ans[0]["data"].split()[-1].rstrip(".")
    except Exception:
        pass
    return None


# ─── Pattern helpers ──────────────────────────────────────────────────────────

def _all_patterns(first: str, last: str, domain: str) -> list[str]:
    """All common email permutations ordered by real-world frequency."""
    f = first.lower().strip()
    l = last.lower().strip() if last else ""
    if not l:
        return [f"{f}@{domain}"]
    return [
        f"{f}.{l}@{domain}",    # first.last  — most common (~45%)
        f"{f[0]}{l}@{domain}",  # flast        — second most common
        f"{f}@{domain}",         # first        — first-name only
        f"{f}{l[0]}@{domain}",  # firstl
        f"{f}_{l}@{domain}",    # first_last
        f"{l}.{f}@{domain}",    # last.first
        f"{l}{f[0]}@{domain}",  # lastf
        f"{l}@{domain}",         # last
    ]


def _classify_local(local: str, first: str = "", last: str = "") -> str | None:
    """Map a real email local-part to a named format string, using name hints when available."""
    f = first.lower() if first else ""
    l = last.lower() if last else ""

    if re.match(r'^[a-z]+\.[a-z]+$', local):
        parts = local.split(".")
        if l and parts[-1] == l:
            return "first.last"
        if f and parts[0] == f:
            return "first.last"
        return "first.last"

    if re.match(r'^[a-z]+_[a-z]+$', local):
        return "first_last"

    # Single-initial + surname: jsmith — 5-9 chars, starts with single char
    if re.match(r'^[a-z][a-z]{3,8}$', local):
        if f and local[0] == f[0] and l and local[1:] == l:
            return "flast"
        # Ambiguous — could be first name; lean flast if 5+ chars
        return "flast" if len(local) >= 5 else "first"

    if re.match(r'^[a-z]{2,8}$', local):
        return "first"

    return None


def _detect_pattern_from_emails(emails: list[str], domain: str,
                                  first: str = "", last: str = "") -> str | None:
    votes = []
    for email in emails:
        if "@" not in email:
            continue
        local = email.split("@")[0].lower()
        if local in _GENERIC_LOCALS:
            continue
        fmt = _classify_local(local, first, last)
        if fmt:
            votes.append(fmt)
    if not votes:
        return None
    return Counter(votes).most_common(1)[0][0]


def _apply_pattern(fmt: str, first: str, last: str, domain: str) -> str | None:
    f = first.lower()
    l = last.lower() if last else ""
    if not l:
        return f"{f}@{domain}"
    mapping = {
        "first.last":  f"{f}.{l}@{domain}",
        "first_last":  f"{f}_{l}@{domain}",
        "first":       f"{f}@{domain}",
        "flast":       f"{f[0]}{l}@{domain}",
        "firstl":      f"{f}{l[0]}@{domain}",
        "last.first":  f"{l}.{f}@{domain}",
        "lastf":       f"{l}{f[0]}@{domain}",
        "last":        f"{l}@{domain}",
    }
    return mapping.get(fmt)


# ─── Web helpers ──────────────────────────────────────────────────────────────

def _fetch(url: str, timeout: int = 6) -> str | None:
    try:
        resp = requests.get(url, timeout=timeout, allow_redirects=True, headers=_HEADERS)
        if resp.status_code == 200:
            return resp.text
    except Exception:
        pass
    return None


def _extract_emails_from_html(html: str, domain: str) -> list[str]:
    email_re = re.compile(r'[a-zA-Z0-9._%+\-]+@' + re.escape(domain), re.IGNORECASE)
    return [e.lower() for e in email_re.findall(html)]


# ─── Stage 1: Web search ──────────────────────────────────────────────────────

def _web_search_email(first: str, last: str, domain: str, company: str) -> dict:
    """
    Query DuckDuckGo HTML for the person's email.
    Also collects any @domain emails found for pattern fallback.
    """
    if not last:
        return {}

    email_re = re.compile(r'[a-zA-Z0-9._%+\-]+@' + re.escape(domain), re.IGNORECASE)
    name_q = f'"{first} {last}"'
    queries = [
        f'{name_q} "@{domain}"',
        f'"{first} {last}" {company} email' if company else f'{name_q} email',
    ]

    collected: list[str] = []

    for query in queries:
        try:
            resp = requests.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers=_HEADERS,
                timeout=9,
            )
            if resp.status_code != 200:
                continue
            hits = [h.lower() for h in email_re.findall(resp.text)]
            collected.extend(hits)
            # Direct hit — email contains first or last name
            for email in hits:
                local = email.split("@")[0]
                if first.lower() in local or last.lower() in local:
                    return {"email": email, "email_provider": "web", "email_score": 72, "_domain_emails": collected}
        except Exception:
            continue

    return {"_domain_emails": collected} if collected else {}


# ─── Stage 2: Site scraping ───────────────────────────────────────────────────

def _scrape_company_pages(domain: str, first: str = "", last: str = "") -> list[str]:
    """
    Scrape company website pages for real staff emails @domain.
    Checks well-known slugs + sitemap.xml. Returns personal (non-generic) emails.
    """
    slugs = [
        "", "/contact", "/about", "/about-us", "/team", "/our-team",
        "/people", "/who-we-are", "/leadership", "/management",
        "/press", "/media", "/blog",
    ]
    found: set[str] = set()

    for slug in slugs:
        html = _fetch(f"https://{domain}{slug}")
        if html:
            found.update(_extract_emails_from_html(html, domain))
        if len(found) >= 15:
            break

    # Sitemap for more coverage when site pages are sparse
    if len(found) < 3:
        sitemap = _fetch(f"https://{domain}/sitemap.xml", timeout=5)
        if sitemap:
            urls = re.findall(r'<loc>(https?://[^<]+)</loc>', sitemap)
            for url in urls[:12]:
                if domain in urlparse(url).netloc:
                    html = _fetch(url, timeout=5)
                    if html:
                        found.update(_extract_emails_from_html(html, domain))
                    if len(found) >= 15:
                        break

    personal = [e for e in found if e.split("@")[0] not in _GENERIC_LOCALS]
    return personal or list(found)


# ─── Stage 3: SMTP probing ────────────────────────────────────────────────────

def _smtp_probe_patterns(first: str, last: str, domain: str) -> dict:
    """
    Open one SMTP connection to the domain's MX and probe every pattern via RCPT-TO.
    Returns first accepted email. Returns {} if port 25 is blocked (common on cloud hosts).
    """
    mx_host = _get_mx_host(domain)
    if not mx_host:
        return {}

    patterns = _all_patterns(first, last, domain)
    try:
        with smtplib.SMTP(timeout=9) as smtp:
            smtp.connect(mx_host, 25)
            smtp.ehlo("sonar-verify.app")
            code, _ = smtp.mail("verify@sonar-verify.app")
            if code != 250:
                return {}
            for email in patterns:
                try:
                    code, _ = smtp.rcpt(email)
                    if code == 250:
                        return {"email": email, "email_provider": "smtp", "email_score": 88}
                except smtplib.SMTPException:
                    continue
    except (socket.timeout, ConnectionRefusedError, OSError):
        # Port 25 blocked on Vercel/AWS — normal, not an error
        return {}
    except Exception:
        return {}

    return {}


def _smtp_verify(email: str) -> bool | None:
    """Verify a single email via SMTP RCPT-TO. Returns True/False/None (inconclusive)."""
    domain = email.split("@")[-1]
    mx_host = _get_mx_host(domain)
    if not mx_host:
        return None
    try:
        with smtplib.SMTP(timeout=8) as smtp:
            smtp.connect(mx_host, 25)
            smtp.ehlo("sonar-verify.app")
            code, _ = smtp.mail("verify@sonar-verify.app")
            if code != 250:
                return None
            code, _ = smtp.rcpt(email)
            return code == 250
    except (socket.timeout, ConnectionRefusedError, OSError):
        return None
    except Exception:
        return None


# ─── Main waterfall ───────────────────────────────────────────────────────────

def waterfall_find_email(
    name: str,
    company: str = "",
    domain: str = "",
    # Kept for signature compatibility — Sonar no longer uses external APIs
    hunter_key: str = "",
    apollo_key: str = "",
) -> dict:
    """
    Sonar proprietary enrichment — no external paid APIs.

    Stage 1 — Web search: DuckDuckGo HTML for published email mentions
    Stage 2 — Site scraping: detect real email format from company pages → apply to person
    Stage 3 — SMTP probing: test all patterns directly against the MX server in one session
    Stage 4 — Pattern + MX: best-guess fallback (domain has email, MX confirmed)
    """
    if not name:
        return {}

    parts = name.strip().split(" ", 1)
    first = parts[0]
    last  = parts[1] if len(parts) > 1 else ""

    if not domain:
        return {}

    domain_emails_from_web: list[str] = []

    # ── Stage 1: Web search ────────────────────────────────────────────────────
    web = _web_search_email(first, last, domain, company)
    if web.get("email"):
        web.pop("_domain_emails", None)
        return web
    domain_emails_from_web = web.get("_domain_emails", [])

    # ── Stage 2: Site scraping → pattern detection ─────────────────────────────
    site_emails = _scrape_company_pages(domain, first, last)
    all_domain_emails = site_emails + domain_emails_from_web

    if all_domain_emails:
        fmt = _detect_pattern_from_emails(all_domain_emails, domain, first, last)
        if fmt:
            email = _apply_pattern(fmt, first, last, domain)
            if email:
                verified = _smtp_verify(email)
                if verified is True:
                    return {"email": email, "email_provider": "site", "email_score": 90}
                elif verified is None:
                    # Port 25 blocked — can't confirm but pattern came from real company emails
                    return {"email": email, "email_provider": "site", "email_score": 58}
                # verified False — site pattern rejected by SMTP, fall through to probing

    # ── Stage 3: SMTP probing — test every pattern directly ───────────────────
    result = _smtp_probe_patterns(first, last, domain)
    if result.get("email"):
        return result

    # ── Stage 4: Pattern + MX — best-guess last resort ────────────────────────
    if _has_mx(domain):
        patterns = _all_patterns(first, last, domain)
        if patterns:
            return {"email": patterns[0], "email_provider": "pattern", "email_score": 22}

    return {}


# Legacy wrapper
def enrich_lead(name: str, company: str, website: str = None) -> dict:
    domain = extract_domain(website) if website else ""
    return waterfall_find_email(name, company=company, domain=domain)


# ═══════════════════════════════════════════════════════════════════════════════
# FIRECRAWL — LinkedIn scraping + enhanced web search
# Falls back to Jina Reader (scrape) / DuckDuckGo (search) when credits are exhausted
# ═══════════════════════════════════════════════════════════════════════════════

import os as _os

FIRECRAWL_KEY  = _os.environ.get("FIRECRAWL_API_KEY", "")
FIRECRAWL_BASE = "https://api.firecrawl.dev/v1"

# Status codes that mean Firecrawl credits are gone — fall back immediately
_FC_EXHAUSTED_CODES = {402, 429}


def _fc_headers() -> dict:
    return {"Authorization": f"Bearer {FIRECRAWL_KEY}", "Content-Type": "application/json"}


# ── Jina Reader fallback (free, no API key) ───────────────────────────────────

def _jina_scrape(url: str) -> str:
    """Scrape a URL via Jina Reader. Free, no API key, no credits."""
    try:
        res = requests.get(
            f"https://r.jina.ai/{url}",
            headers={**_HEADERS, "Accept": "text/plain", "X-Return-Format": "markdown"},
            timeout=30,
        )
        if res.status_code == 200 and len(res.text) > 80:
            return res.text
    except Exception:
        pass
    return ""


def _ddg_search(query: str, limit: int = 5) -> list:
    """
    Web search via DuckDuckGo HTML. Free, no API key.
    Returns list of {url, title, description, markdown} — same shape as Firecrawl results.
    """
    try:
        resp = requests.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
            headers=_HEADERS,
            timeout=12,
        )
        if resp.status_code != 200:
            return []
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "html.parser")
        results = []
        for a in soup.select("a.result__a")[:limit]:
            href = a.get("href", "")
            title = a.get_text(strip=True)
            snippet_tag = a.find_parent("div", class_="result")
            snippet = ""
            if snippet_tag:
                s = snippet_tag.select_one(".result__snippet")
                snippet = s.get_text(strip=True) if s else ""
            if href:
                results.append({
                    "url": href,
                    "title": title,
                    "description": snippet,
                    "markdown": snippet,
                })
        return results
    except Exception:
        return []


# ── Firecrawl with fallback ───────────────────────────────────────────────────

def _fc_scrape(url: str, wait_ms: int = 3000) -> str:
    """Scrape a URL. Tries Firecrawl first, falls back to Jina Reader."""
    if FIRECRAWL_KEY:
        try:
            res = requests.post(
                f"{FIRECRAWL_BASE}/scrape",
                json={"url": url, "formats": ["markdown"], "onlyMainContent": True, "waitFor": wait_ms},
                headers=_fc_headers(),
                timeout=45,
            )
            if res.status_code == 200:
                return res.json().get("data", {}).get("markdown", "")
            if res.status_code not in _FC_EXHAUSTED_CODES:
                return ""
            # Credits exhausted — fall through to Jina
        except Exception:
            pass
    return _jina_scrape(url)


def _fc_search(query: str, limit: int = 5) -> list:
    """Web search. Tries Firecrawl first, falls back to DuckDuckGo."""
    if FIRECRAWL_KEY:
        try:
            res = requests.post(
                f"{FIRECRAWL_BASE}/search",
                json={"query": query, "limit": limit},
                headers=_fc_headers(),
                timeout=25,
            )
            if res.status_code == 200:
                return res.json().get("data", [])
            if res.status_code not in _FC_EXHAUSTED_CODES:
                return []
            # Credits exhausted — fall through to DDG
        except Exception:
            pass
    return _ddg_search(query, limit)


# ── LinkedIn scraper ──────────────────────────────────────────────────────────

def find_linkedin_url(first: str, last: str, company: str) -> str:
    """Find a LinkedIn profile URL via web search. No login required."""
    query = f'site:linkedin.com/in/ "{first} {last}" "{company}"'
    for r in _fc_search(query, limit=5):
        url = r.get("url", "")
        if "linkedin.com/in/" in url:
            return url
    return ""


def _parse_linkedin_md(md: str) -> dict:
    """Extract structured fields from a scraped LinkedIn public profile."""
    d = {}

    # Name — first H1
    m = re.search(r'^#\s+(.+)$', md, re.MULTILINE)
    if m:
        d['full_name'] = m.group(1).strip()

    # Headline — first H2
    m = re.search(r'^##\s+(.+)$', md, re.MULTILINE)
    if m:
        d['headline'] = m.group(1).strip()

    # Location
    for pat in [
        r'(?:Location|Based in|Lives in)[:\s]+([A-Za-z ,]+)',
        r'\n([A-Za-z][A-Za-z ,]{4,40})\s*·\s*\d+\s*connection',
    ]:
        m = re.search(pat, md, re.IGNORECASE)
        if m:
            d['location'] = m.group(1).strip()
            break

    # Current job — first entry in Experience section
    exp = re.search(
        r'(?:Experience|Work Experience)(.*?)(?:Education|Skills|Recommendations|$)',
        md, re.DOTALL | re.IGNORECASE
    )
    if exp:
        block = exp.group(1)
        jm = re.search(r'###\s+(.+?)\n(.+?)(?:\n|$)', block)
        if jm:
            d['job_title'] = jm.group(1).strip()
            raw = jm.group(2).strip()
            d['job_company_name'] = re.sub(r'^(?:at|@|·)\s*', '', raw).strip()

    # Profile picture from LinkedIn CDN
    m = re.search(r'!\[.*?\]\((https://media\.licdn\.com/[^)]+)\)', md)
    if m:
        d['profile_pic_url'] = m.group(1)

    return d


def scrape_linkedin_profile(li_url: str) -> dict:
    """
    Scrape a public LinkedIn profile. Tries Firecrawl first, falls back to Jina Reader.
    No user credentials or cookies used — only publicly accessible data.
    """
    md = _fc_scrape(li_url, wait_ms=4000)
    if not md or len(md) < 80:
        md = _jina_scrape(li_url)
    if not md or len(md) < 80:
        return {}
    return _parse_linkedin_md(md)


# ── Firecrawl-enhanced email finding ─────────────────────────────────────────

def _find_email_fc_search(first: str, last: str, domain: str) -> str:
    """Use Firecrawl web search to find a leaked/published email."""
    email_re = re.compile(rf'[a-zA-Z0-9._%+-]+@{re.escape(domain)}', re.IGNORECASE)
    for query in [
        f'"{first} {last}" "@{domain}"',
        f'"{first} {last}" {domain} email contact',
    ]:
        for r in _fc_search(query, limit=5):
            text = " ".join([r.get("markdown", ""), r.get("description", ""), r.get("url", "")])
            for email in email_re.findall(text):
                local = email.split("@")[0].lower()
                if (first.lower() in local or last.lower() in local
                        or (len(last) >= 3 and last.lower()[:3] in local)):
                    return email.lower()
    return ""


def _scrape_domain_emails_fc(domain: str) -> list:
    """Scrape company website pages for emails using Firecrawl."""
    email_re = re.compile(rf'[a-zA-Z0-9._%+-]+@{re.escape(domain)}', re.IGNORECASE)
    pages = [
        f"https://{domain}/team",
        f"https://{domain}/about",
        f"https://{domain}/contact",
        f"https://{domain}/about-us",
        f"https://{domain}/our-team",
        f"https://{domain}/people",
        f"https://{domain}/leadership",
    ]
    found = set()
    for url in pages:
        md = _fc_scrape(url, wait_ms=2000)
        if md:
            for e in email_re.findall(md):
                found.add(e.lower())
        if len(found) >= 20:
            break
    return [e for e in found if e.split("@")[0] not in _GENERIC_LOCALS]


def find_domain_contacts(domain: str) -> list:
    """
    Find all staff emails at a company domain.
    Scrapes team/about/contact pages. Returns list of {email, name_hint}.
    """
    all_emails = _scrape_domain_emails_fc(domain) or _scrape_company_pages(domain)
    # Deduplicate and sort
    seen = set()
    out  = []
    for email in all_emails:
        if email not in seen:
            seen.add(email)
            out.append({"email": email})
    return out


def waterfall_find_email_v2(first: str, last: str, domain: str, company: str = "") -> dict:
    """
    Full email finding pipeline (Firecrawl-enhanced):
    1. Firecrawl web search — leaked/published email
    2. DuckDuckGo HTML search — fallback web search
    3. Company website scrape (Firecrawl → raw HTTP) — detect pattern
    4. SMTP probing — verify patterns against MX
    5. Pattern + MX — best-guess fallback
    """
    if not first or not last or not domain:
        return {}

    # 1. Firecrawl web search
    email = _find_email_fc_search(first, last, domain)
    if email:
        return {"email": email, "email_provider": "web_search", "email_score": 82}

    # 2. DuckDuckGo HTML fallback
    web = _web_search_email(first, last, domain, company)
    if web.get("email"):
        web.pop("_domain_emails", None)
        return web
    domain_emails_web = web.get("_domain_emails", [])

    # 3. Company website scrape
    site_emails = _scrape_domain_emails_fc(domain) or _scrape_company_pages(domain, first, last)
    all_domain_emails = site_emails + domain_emails_web

    if all_domain_emails:
        fmt = _detect_pattern_from_emails(all_domain_emails, domain, first, last)
        if fmt:
            email = _apply_pattern(fmt, first, last, domain)
            if email:
                verified = _smtp_verify(email)
                if verified is True:
                    return {"email": email, "email_provider": "site_pattern", "email_score": 93}
                elif verified is None:
                    return {"email": email, "email_provider": "site_pattern", "email_score": 64}

    # 4. SMTP probing
    result = _smtp_probe_patterns(first, last, domain)
    if result.get("email"):
        return result

    # 5. Pattern + MX fallback
    if _has_mx(domain):
        patterns = _all_patterns(first, last, domain)
        if patterns:
            return {"email": patterns[0], "email_provider": "pattern", "email_score": 22}

    return {}
