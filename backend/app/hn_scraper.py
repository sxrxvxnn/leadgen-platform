"""
hn_scraper.py — Sonar database builder: HN "Who is Hiring" threads.

Scrapes the monthly Ask HN: Who is hiring? thread posted by whoishiring.
Each top-level comment = one company posting a job.
Extracts: company, role, location, email, remote flag.
No auth required — uses public Algolia HN API + HN Firebase API.
"""
import re
import html
import time
import requests
from datetime import datetime, timezone

ALGOLIA_BASE  = "https://hn.algolia.com/api/v1"
FIREBASE_BASE = "https://hacker-news.firebaseio.com/v0"

EMAIL_RE    = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
NOREPLY_RE  = re.compile(r'(noreply|no-reply|donotreply|mailer|bounce)', re.IGNORECASE)
PIPE_RE     = re.compile(r'\s*\|\s*')


def _get(url: str, params: dict | None = None, timeout: int = 12) -> dict | list | None:
    try:
        r = requests.get(url, params=params, timeout=timeout)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"[HN] GET error {url}: {e}")
    return None


def _latest_who_is_hiring_id() -> int | None:
    """Return the objectID of the most recent 'Ask HN: Who is hiring?' thread."""
    data = _get(f"{ALGOLIA_BASE}/search", {
        "tags":          "story",
        "query":         "Ask HN: Who is hiring?",
        "hitsPerPage":   10,
        "restrictSearchableAttributes": "title",
    })
    if not data:
        return None
    for hit in data.get("hits", []):
        title  = (hit.get("title") or "").lower()
        author = hit.get("author", "")
        if "who is hiring" in title and author == "whoishiring":
            return int(hit["objectID"])
    # fallback: first hit with matching title
    for hit in data.get("hits", []):
        if "who is hiring" in (hit.get("title") or "").lower():
            return int(hit["objectID"])
    return None


def _strip_html(text: str) -> str:
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</p>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>.*?</a>', r'\1', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<[^>]+>', '', text)
    return html.unescape(text).strip()


def _parse_comment(kid_id: int, text: str) -> dict | None:
    """Parse one HN hiring comment into a sonar_contacts-ready dict."""
    clean = _strip_html(text)
    lines = [l.strip() for l in clean.split('\n') if l.strip()]
    if not lines:
        return None

    header = lines[0]
    parts  = [p.strip() for p in PIPE_RE.split(header)]

    company = parts[0][:150].strip()
    if len(company) < 2 or len(company) > 150:
        return None
    # Skip if header looks like a long description sentence
    if len(company.split()) > 8:
        return None

    job_title    = parts[1].strip()[:120] if len(parts) > 1 else None
    location_raw = parts[2].strip()[:100] if len(parts) > 2 else None

    # Email from full text — skip noreply addresses
    emails = [e for e in EMAIL_RE.findall(clean) if not NOREPLY_RE.search(e)]
    email  = emails[0] if emails else None

    full_lower = clean.lower()
    is_remote  = any(kw in full_lower for kw in ("remote", "distributed", "anywhere", "worldwide"))

    location = location_raw
    if not location and is_remote:
        location = "Remote"

    domain = email.split("@")[1].lower() if email and "@" in email else None

    now = datetime.now(timezone.utc).isoformat()
    return {
        "job_company_name": company,
        "job_title":        job_title,
        "location_locality": location,
        "email":            email,
        "domain":           domain,
        "source":           "hn_hiring",
        "source_id":        str(kid_id),
        "scraped_at":       now,
        "updated_at":       now,
    }


def scrape_who_is_hiring(max_posts: int = 150) -> list[dict]:
    """Fetch and parse the latest Who is Hiring thread."""
    story_id = _latest_who_is_hiring_id()
    if not story_id:
        print("[HN] Could not find Who is Hiring thread")
        return []

    story = _get(f"{FIREBASE_BASE}/item/{story_id}.json")
    if not story:
        print(f"[HN] Could not fetch story {story_id}")
        return []

    kids = (story.get("kids") or [])[:max_posts]
    print(f"[HN] Story {story_id}: processing {len(kids)} comments")

    contacts = []
    for i, kid_id in enumerate(kids):
        item = _get(f"{FIREBASE_BASE}/item/{kid_id}.json")
        if not item:
            continue
        # Only top-level comments (parent = story)
        if item.get("parent") != story_id:
            continue
        text = item.get("text") or ""
        if not text:
            continue
        contact = _parse_comment(kid_id, text)
        if contact:
            contacts.append(contact)
        # Respect rate limits — HN Firebase has no official limit but be polite
        if i % 20 == 19:
            time.sleep(1)

    print(f"[HN] Parsed {len(contacts)} contacts from {len(kids)} comments")
    return contacts


def upsert_contacts(supabase_client, contacts: list[dict]) -> dict:
    """Upsert HN contacts into sonar_contacts (reuses same upsert pattern as github_scraper)."""
    if not contacts:
        return {"upserted": 0, "errors": 0}

    upserted = errors = 0
    for i in range(0, len(contacts), 50):
        chunk = contacts[i:i + 50]
        try:
            supabase_client.table("sonar_contacts").upsert(
                chunk, on_conflict="source,source_id"
            ).execute()
            upserted += len(chunk)
        except Exception as e:
            print(f"[HN] Upsert chunk error: {e}")
            for c in chunk:
                try:
                    supabase_client.table("sonar_contacts").upsert(
                        c, on_conflict="source,source_id"
                    ).execute()
                    upserted += 1
                except Exception as e2:
                    print(f"[HN] Single upsert error ({c.get('source_id')}): {e2}")
                    errors += 1

    return {"upserted": upserted, "errors": errors}


def run_hn_scrape_job(supabase_client, max_posts: int = 150) -> dict:
    """Entry point for the cron job."""
    contacts = scrape_who_is_hiring(max_posts=max_posts)
    result   = upsert_contacts(supabase_client, contacts)
    print(f"[HN] Done: scraped={len(contacts)} upserted={result['upserted']} errors={result['errors']}")
    return {
        "source":   "hn_hiring",
        "scraped":  len(contacts),
        "upserted": result["upserted"],
        "errors":   result["errors"],
    }
