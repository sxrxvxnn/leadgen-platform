"""
github_scraper.py — Sonar proprietary contact database builder.

Pulls publicly available profile data from GitHub:
  name, email (profile or commit history), company, location, bio, GitHub URL.

Rate limits (authenticated):
  Core API  — 5 000 req / hr
  Search    — 30 req / min (1 000 results per query max)
"""
import os
import re
import time
import requests
from datetime import datetime, timezone

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_COLLAB_TOKEN", "")
GITHUB_BASE  = "https://api.github.com"

# Queries run in rotation by the daily cron job.
# Each yields up to 1 000 users; rotate them to avoid overlap.
SCRAPE_QUERIES = [
    "type:user followers:>100",
    "type:user followers:>50 repos:>10",
    "type:user followers:>30 language:python",
    "type:user followers:>30 language:javascript",
    "type:user followers:>30 language:typescript",
    "type:user followers:>30 language:go",
    "type:user followers:>20 repos:>20",
    "type:user followers:>50 location:india",
    "type:user followers:>50 location:usa",
    "type:user followers:>50 location:uk",
    "type:user followers:>50 location:canada",
    "type:user followers:>50 location:australia",
    "type:user followers:>50 location:germany",
    "type:user followers:>50 location:singapore",
]


# ── GitHub API helpers ────────────────────────────────────────────────────────

def _headers() -> dict:
    h = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"token {GITHUB_TOKEN}"
    return h


def _get(path: str, params: dict | None = None, retries: int = 2):
    """GET from GitHub API with automatic rate-limit back-off."""
    for attempt in range(retries + 1):
        try:
            res = requests.get(
                f"{GITHUB_BASE}{path}",
                params=params,
                headers=_headers(),
                timeout=15,
            )
            if res.status_code == 200:
                return res.json()
            if res.status_code == 403:
                reset = int(res.headers.get("X-RateLimit-Reset", time.time() + 60))
                wait  = max(reset - int(time.time()), 1)
                print(f"[GitHub] Rate limited — waiting {wait}s")
                time.sleep(min(wait, 60))
                continue
            if res.status_code == 404:
                return None
        except Exception as e:
            print(f"[GitHub] Request error ({attempt}): {e}")
            time.sleep(2)
    return None


# ── Email extraction ──────────────────────────────────────────────────────────

_NOREPLY_RE = re.compile(r'@users\.noreply\.github\.com$', re.IGNORECASE)


def _email_from_events(username: str) -> str:
    """Find a real email in the user's public push events (commit author field)."""
    events = _get(f"/users/{username}/events/public", {"per_page": 20})
    if not events:
        return ""
    for event in events:
        if event.get("type") != "PushEvent":
            continue
        for commit in (event.get("payload") or {}).get("commits", []):
            email = ((commit.get("author") or {}).get("email") or "").strip().lower()
            if email and "@" in email and not _NOREPLY_RE.search(email):
                return email
    return ""


# ── Domain extraction ─────────────────────────────────────────────────────────

def _clean_domain(raw: str) -> str:
    """Extract a bare domain from a GitHub company or blog field."""
    if not raw:
        return ""
    raw = raw.strip().lstrip("@").lower()
    raw = raw.replace("https://", "").replace("http://", "").replace("www.", "")
    raw = raw.split("/")[0].split("?")[0]
    if "." in raw and " " not in raw and len(raw) > 3:
        return raw
    return ""


# ── Profile scraping ──────────────────────────────────────────────────────────

def _enrich_profile(username: str) -> dict | None:
    """
    Fetch and enrich a single GitHub user profile.
    Returns a sonar_contacts-ready dict, or None if profile is unusable.
    """
    profile = _get(f"/users/{username}")
    if not profile or profile.get("type") != "User":
        return None

    name    = (profile.get("name") or "").strip()
    email   = (profile.get("email") or "").strip().lower()
    company = (profile.get("company") or "").strip().lstrip("@")
    blog    = (profile.get("blog") or "").strip()
    loc     = (profile.get("location") or "").strip()

    # Email: profile first, then commit history
    if not email:
        email = _email_from_events(username)

    # Domain: from email, then company field, then blog
    domain = ""
    if email and "@" in email:
        domain = email.split("@")[1]
    if not domain:
        domain = _clean_domain(company) or _clean_domain(blog)

    # Location parts
    loc_parts   = [p.strip() for p in loc.split(",")]
    loc_city    = loc_parts[0]  if loc_parts              else ""
    loc_country = loc_parts[-1] if len(loc_parts) > 1     else ""

    # Name split
    name_parts = name.split(" ", 1)
    first_name = name_parts[0]                          if name_parts      else username
    last_name  = name_parts[1]                          if len(name_parts) > 1 else ""

    return {
        "full_name":           name or username,
        "first_name":          first_name,
        "last_name":           last_name,
        "email":               email or None,
        "job_company_name":    company or None,
        "job_company_website": f"https://{_clean_domain(blog)}" if _clean_domain(blog) else (f"https://{domain}" if domain else None),
        "location_locality":   loc_city or None,
        "location_country":    loc_country or None,
        "github_url":          profile.get("html_url") or f"https://github.com/{username}",
        "profile_pic_url":     profile.get("avatar_url") or None,
        "bio":                 (profile.get("bio") or "").strip() or None,
        "source":              "github",
        "source_id":           username,
        "domain":              domain or None,
        "followers":           profile.get("followers", 0),
        "public_repos":        profile.get("public_repos", 0),
        "scraped_at":          datetime.now(timezone.utc).isoformat(),
        "updated_at":          datetime.now(timezone.utc).isoformat(),
    }


# ── Batch scraper ─────────────────────────────────────────────────────────────

def scrape_query(query: str, max_users: int = 200) -> list[dict]:
    """
    Run one GitHub user search query and enrich each result.
    Returns list of sonar_contacts-ready dicts.
    Respects the 30 req/min search limit with short sleeps.
    """
    contacts = []
    per_page = min(max_users, 100)
    pages    = (max_users + per_page - 1) // per_page

    for page in range(1, pages + 1):
        result = _get("/search/users", {
            "q":        query,
            "per_page": per_page,
            "page":     page,
            "sort":     "followers",
            "order":    "desc",
        })
        if not result or not result.get("items"):
            break

        items = result["items"]
        print(f"[GitHub] query='{query}' page={page} items={len(items)}")

        for item in items:
            username = item.get("login", "")
            if not username:
                continue
            contact = _enrich_profile(username)
            if contact:
                contacts.append(contact)
            # Stay under 5 000 req/hr core limit (≈ 1.4/s)
            time.sleep(0.8)

        # Search API: 30 req/min — one search req per page
        time.sleep(2.5)

        if len(contacts) >= max_users:
            break

    return contacts


def upsert_contacts(supabase_client, contacts: list[dict]) -> dict:
    """Upsert a batch of contacts into sonar_contacts."""
    if not contacts:
        return {"upserted": 0, "errors": 0}

    upserted = 0
    errors   = 0

    # Batch in chunks of 50 to avoid payload size limits
    chunk_size = 50
    for i in range(0, len(contacts), chunk_size):
        chunk = contacts[i : i + chunk_size]
        try:
            supabase_client.table("sonar_contacts").upsert(
                chunk,
                on_conflict="source,source_id",
            ).execute()
            upserted += len(chunk)
        except Exception as e:
            print(f"[DB] Upsert error (chunk {i}): {e}")
            # Fall back to one-by-one
            for c in chunk:
                try:
                    supabase_client.table("sonar_contacts").upsert(
                        c, on_conflict="source,source_id"
                    ).execute()
                    upserted += 1
                except Exception as e2:
                    print(f"[DB] Single upsert error ({c.get('source_id')}): {e2}")
                    errors += 1

    return {"upserted": upserted, "errors": errors}


def run_scrape_job(supabase_client, query_index: int = 0, max_users: int = 200) -> dict:
    """
    Entry point for the cron job.
    Picks one query from SCRAPE_QUERIES (rotating by index) and scrapes it.
    """
    query    = SCRAPE_QUERIES[query_index % len(SCRAPE_QUERIES)]
    print(f"[GitHub] Starting scrape: query='{query}' max={max_users}")

    contacts = scrape_query(query, max_users=max_users)
    result   = upsert_contacts(supabase_client, contacts)

    print(f"[GitHub] Done: scraped={len(contacts)} upserted={result['upserted']} errors={result['errors']}")
    return {
        "query":    query,
        "scraped":  len(contacts),
        "upserted": result["upserted"],
        "errors":   result["errors"],
    }
