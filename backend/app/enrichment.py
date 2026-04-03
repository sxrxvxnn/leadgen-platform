import requests
import os
from dotenv import load_dotenv

load_dotenv()

HUNTER_API_KEY = os.getenv("HUNTER_API_KEY")
APOLLO_API_KEY = os.getenv("APOLLO_API_KEY")


def extract_domain(website: str) -> str:
    if not website:
        return None
    website = website.replace("https://", "").replace("http://", "").replace("www.", "")
    return website.split("/")[0].strip()


def enrich_with_hunter(first_name: str, last_name: str, domain: str) -> dict:
    if not HUNTER_API_KEY or not domain or not first_name:
        return {}
    try:
        url = "https://api.hunter.io/v2/email-finder"
        params = {
            "domain": domain,
            "first_name": first_name,
            "last_name": last_name or "",
            "api_key": HUNTER_API_KEY
        }
        res = requests.get(url, params=params, timeout=10)
        data = res.json()
        if data.get("data") and data["data"].get("email"):
            return {
                "email": data["data"]["email"],
                "email_confidence": data["data"].get("score", 0),
                "source": "hunter"
            }
    except Exception as e:
        print(f"Hunter error: {e}")
    return {}


def enrich_with_apollo(name: str, company: str) -> dict:
    if not APOLLO_API_KEY or not name:
        return {}
    try:
        url = "https://api.apollo.io/v1/people/match"
        headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": APOLLO_API_KEY
        }
        parts = name.strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

        payload = {
            "first_name": first_name,
            "last_name": last_name,
            "organization_name": company or "",
        }
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        data = res.json()
        person = data.get("person", {})
        if person:
            result = {}
            if person.get("email"):
                result["email"] = person["email"]
                result["source"] = "apollo"
            if person.get("phone_numbers"):
                result["phone"] = person["phone_numbers"][0].get("sanitized_number", "")
            if person.get("linkedin_url"):
                result["profile_url"] = person["linkedin_url"]
            return result
    except Exception as e:
        print(f"Apollo error: {e}")
    return {}


def enrich_lead(name: str, company: str, website: str = None) -> dict:
    result = {}

    # Try Apollo first — richer data
    apollo_data = enrich_with_apollo(name, company)
    result.update(apollo_data)

    # If no email yet try Hunter
    if not result.get("email") and website:
        domain = extract_domain(website)
        parts = (name or "").strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""
        hunter_data = enrich_with_hunter(first_name, last_name, domain)
        result.update(hunter_data)

    return result