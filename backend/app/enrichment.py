import os
import requests
from dotenv import load_dotenv

load_dotenv()


def extract_domain(website: str) -> str:
    if not website:
        return None
    website = website.replace("https://", "").replace("http://", "").replace("www.", "")
    return website.split("/")[0].strip().lower()


def _has_mx(domain: str) -> bool:
    """Check domain MX records via Google DNS-over-HTTPS (no extra packages needed)."""
    try:
        resp = requests.get(
            "https://dns.google/resolve",
            params={"name": domain, "type": "MX"},
            timeout=4
        )
        if resp.status_code == 200:
            return bool(resp.json().get("Answer"))
    except Exception:
        pass
    return False


def _guess_patterns(first: str, last: str, domain: str) -> list[str]:
    f = first.lower()
    l = last.lower() if last else ""
    patterns = [f"{f}.{l}@{domain}"] if l else []
    patterns += [
        f"{f}@{domain}",
        f"{f[0]}{l}@{domain}" if l else None,
        f"{f}{l[0]}@{domain}" if l else None,
        f"{f}_{l}@{domain}" if l else None,
    ]
    return [p for p in patterns if p]


def enrich_with_hunter(first_name: str, last_name: str, domain: str, api_key: str = "") -> dict:
    key = api_key or os.getenv("HUNTER_API_KEY", "")
    if not key or not domain or not first_name:
        return {}
    try:
        res = requests.get("https://api.hunter.io/v2/email-finder", params={
            "domain": domain,
            "first_name": first_name,
            "last_name": last_name or "",
            "api_key": key,
        }, timeout=10)
        data = res.json().get("data") or {}
        email = data.get("email")
        if email:
            return {"email": email, "email_provider": "hunter", "email_score": data.get("score", 0)}
    except Exception:
        pass
    return {}


def enrich_with_apollo(first_name: str, last_name: str, domain: str, company: str = "", api_key: str = "") -> dict:
    key = api_key or os.getenv("APOLLO_API_KEY", "")
    if not key or not first_name:
        return {}
    try:
        payload = {
            "first_name": first_name,
            "last_name": last_name or "",
            "organization_name": company or "",
        }
        if domain:
            payload["domain"] = domain
        res = requests.post(
            "https://api.apollo.io/api/v1/people/match",
            json=payload,
            headers={"X-Api-Key": key, "Content-Type": "application/json", "Cache-Control": "no-cache"},
            timeout=10,
        )
        person = (res.json().get("person") or {}) if res.status_code == 200 else {}
        email = person.get("email")
        if email:
            result = {"email": email, "email_provider": "apollo", "email_score": 75}
            if person.get("phone_numbers"):
                result["phone"] = person["phone_numbers"][0].get("sanitized_number", "")
            if person.get("linkedin_url"):
                result["profile_url"] = person["linkedin_url"]
            return result
    except Exception:
        pass
    return {}


def enrich_with_pattern(first_name: str, last_name: str, domain: str) -> dict:
    """Construct most-likely email patterns and return the top one if domain has MX records."""
    if not first_name or not domain:
        return {}
    if not _has_mx(domain):
        return {}
    patterns = _guess_patterns(first_name, last_name, domain)
    if patterns:
        return {"email": patterns[0], "email_provider": "pattern", "email_score": 30}
    return {}


def waterfall_find_email(
    name: str,
    company: str = "",
    domain: str = "",
    hunter_key: str = "",
    apollo_key: str = "",
) -> dict:
    """
    Try enrichment providers in priority order, return first hit.
    Returns dict with keys: email, email_provider, email_score (and optionally phone, profile_url).
    """
    parts = (name or "").strip().split(" ", 1)
    first = parts[0]
    last  = parts[1] if len(parts) > 1 else ""

    # 1. Hunter.io — highest confidence, requires domain
    if domain:
        result = enrich_with_hunter(first, last, domain, api_key=hunter_key)
        if result.get("email"):
            return result

    # 2. Apollo.io — works with company name even without domain
    result = enrich_with_apollo(first, last, domain, company=company, api_key=apollo_key)
    if result.get("email"):
        return result

    # 3. Pattern guess — domain required, MX verified
    if domain:
        result = enrich_with_pattern(first, last, domain)
        if result.get("email"):
            return result

    return {}


# Legacy wrapper — kept for backward compat with existing callers
def enrich_lead(name: str, company: str, website: str = None) -> dict:
    domain = extract_domain(website) if website else ""
    return waterfall_find_email(name, company=company, domain=domain)
