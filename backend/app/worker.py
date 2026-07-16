"""SQS consumer — runs as a standalone process inside the worker pod.
Run with: python -m app.worker
"""
import json
import os
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed

import boto3
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

from .queue import QUEUE_URLS, QUEUE_TIMEOUTS, update_job

# ─── Supabase client ──────────────────────────────────────────────────────────
supabase = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_KEY'],
)

sqs = boto3.client('sqs', region_name=os.getenv('AWS_REGION', 'us-east-1'))

VISIBILITY_TIMEOUT = 300   # seconds — must exceed the longest job duration
POLL_WAIT          = 10    # SQS long-poll window (max 20 s)


# ─── Job handlers ─────────────────────────────────────────────────────────────

def _handle_bulk_enrichment(job_id: str, user_id: str, payload: dict):
    """LinkedIn + website autofill for a batch of companies."""
    from .company_prefill import (
        scrape_linkedin_data,
        search_linkedin_url_by_domain,
        search_linkedin_url_direct,
        search_company_website,
        clean_name_for_search,
    )
    from .website_analyzer import fetch_website_content, classify_company_type_rules

    company_ids   = payload.get('company_ids', [])
    openrouter_key = payload.get('openrouter_key', '')
    li_cookie     = payload.get('li_cookie', '')

    if company_ids:
        co_res = supabase.table('companies').select('*').in_('id', company_ids).eq('user_id', user_id).execute()
    else:
        co_res = supabase.table('companies').select('*').eq('user_id', user_id).execute()
    companies = co_res.data or []

    completed = 0
    errors    = 0

    def _enrich_one(company):
        nonlocal completed, errors
        cid  = company['id']
        name = company.get('name', '')
        update: dict = {}

        try:
            # LinkedIn URL discovery
            li_url = company.get('linkedin_url') or ''
            if not li_url:
                domain = company.get('website', '').replace('https://', '').replace('http://', '').split('/')[0]
                li_url = (
                    search_linkedin_url_by_domain(domain, name) if domain
                    else search_linkedin_url_direct(name)
                )
                if li_url:
                    update['linkedin_url'] = li_url

            # LinkedIn data scrape
            if li_url:
                li_data = scrape_linkedin_data(li_url, fast=True, li_cookie=li_cookie)
                for field in ('followers', 'tagline', 'location', 'employee_count',
                              'description', 'industry', 'website', 'phone', 'founded', 'specialties'):
                    if li_data.get(field) and not company.get(field):
                        update[field] = li_data[field]

            # Website classification
            website = update.get('website') or company.get('website', '')
            if website and not company.get('company_type'):
                html = fetch_website_content(website)
                if html:
                    ct = classify_company_type_rules(html, name)
                    if ct:
                        update['company_type'] = ct

            if update:
                supabase.table('companies').update(update).eq('id', cid).eq('user_id', user_id).execute()
            completed += 1
        except Exception:
            errors += 1

        update_job(job_id, supabase, completed=completed, errors=errors, status='running')

    with ThreadPoolExecutor(max_workers=10) as pool:
        list(pool.map(_enrich_one, companies))


def _handle_bulk_maps_enrich(job_id: str, user_id: str, payload: dict):
    """Google Maps Places enrichment for a batch of companies."""
    import re as _re
    import requests as _requests

    company_ids = payload.get('company_ids', [])
    maps_key    = payload.get('maps_key') or os.getenv('GOOGLE_MAPS_API_KEY', '')

    if not maps_key:
        raise ValueError('Google Maps API key required')

    if company_ids:
        co_res = supabase.table('companies').select('*').in_('id', company_ids).eq('user_id', user_id).execute()
    else:
        co_res = supabase.table('companies').select('*').eq('user_id', user_id).execute()
    companies = co_res.data or []

    completed = 0
    errors    = 0

    def _enrich_one(company):
        nonlocal completed, errors
        cid  = company['id']
        name = company.get('name', '')
        try:
            # Places text search
            search_resp = _requests.get(
                'https://maps.googleapis.com/maps/api/place/textsearch/json',
                params={'query': name, 'key': maps_key},
                timeout=8,
            ).json()
            results = search_resp.get('results', [])
            if not results:
                completed += 1
                return
            place = results[0]
            place_id = place.get('place_id')

            # Places details
            details_resp = _requests.get(
                'https://maps.googleapis.com/maps/api/place/details/json',
                params={
                    'place_id': place_id,
                    'fields': 'name,formatted_address,formatted_phone_number,website,rating,url',
                    'key': maps_key,
                },
                timeout=8,
            ).json().get('result', {})

            update: dict = {}
            if details_resp.get('formatted_address') and not company.get('location'):
                update['location'] = details_resp['formatted_address']
            if details_resp.get('formatted_phone_number') and not company.get('phone'):
                update['phone'] = details_resp['formatted_phone_number']
            if details_resp.get('website') and not company.get('website'):
                update['website'] = details_resp['website']
            if details_resp.get('rating') and not company.get('rating'):
                update['rating'] = str(details_resp['rating'])

            if update:
                supabase.table('companies').update(update).eq('id', cid).eq('user_id', user_id).execute()
            completed += 1
        except Exception:
            errors += 1

        update_job(job_id, supabase, completed=completed, errors=errors, status='running')

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(_enrich_one, companies))


def _handle_bulk_analyze(job_id: str, user_id: str, payload: dict):
    """Website analysis (company_type, compliance, description) for a batch of companies."""
    from .website_analyzer import (
        fetch_website_content, classify_company_type_rules,
        analyze_with_gemini, analyze_with_openai,
        analyze_with_groq, analyze_with_openrouter,
    )

    company_ids     = payload.get('company_ids', [])
    gemini_key      = payload.get('gemini_key')      or os.getenv('GEMINI_API_KEY', '')
    openai_key      = payload.get('openai_key')      or os.getenv('OPENAI_API_KEY', '')
    groq_key        = payload.get('groq_key')        or os.getenv('GROQ_API_KEY', '')
    openrouter_key  = payload.get('openrouter_key')  or os.getenv('OPENROUTER_API_KEY', '')
    openrouter_model = payload.get('openrouter_model', '')

    if company_ids:
        co_res = supabase.table('companies').select('*').in_('id', company_ids).eq('user_id', user_id).execute()
    else:
        co_res = supabase.table('companies').select('*').eq('user_id', user_id).execute()
    companies = co_res.data or []

    completed = 0
    errors    = 0

    def _analyze_one(company):
        nonlocal completed, errors
        cid     = company['id']
        website = company.get('website', '')
        name    = company.get('name', '')
        try:
            if not website:
                completed += 1
                return
            html = fetch_website_content(website)
            if not html:
                completed += 1
                return

            update: dict = {}
            ct = classify_company_type_rules(html, name)
            if ct:
                update['company_type'] = ct

            # Try AI analysis in order of preference
            analysis = None
            if gemini_key:
                analysis = analyze_with_gemini(html, name, gemini_key)
            if not analysis and openai_key:
                analysis = analyze_with_openai(html, name, openai_key)
            if not analysis and groq_key:
                analysis = analyze_with_groq(html, name, groq_key)
            if not analysis and openrouter_key:
                analysis = analyze_with_openrouter(html, name, openrouter_key, openrouter_model)

            if analysis:
                for field in ('description', 'compliance', 'tech_stack', 'target_market'):
                    if analysis.get(field) and not company.get(field):
                        update[field] = analysis[field]

            if update:
                supabase.table('companies').update(update).eq('id', cid).eq('user_id', user_id).execute()
            completed += 1
        except Exception:
            errors += 1

        update_job(job_id, supabase, completed=completed, errors=errors, status='running')

    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(_analyze_one, companies))


def _handle_batch_dm(job_id: str, user_id: str, payload: dict):
    """Generate LinkedIn DMs for a batch of companies using Groq."""
    import requests as _requests

    company_ids = payload.get('company_ids', [])
    persona     = payload.get('persona', 'decision maker')
    groq_key    = payload.get('groq_key') or os.getenv('GROQ_API_KEY', '')

    if not groq_key:
        raise ValueError('Groq API key required for batch DM')

    if company_ids:
        co_res = supabase.table('companies').select(
            'id,name,industry,size,description,tech_stack,recent_news,job_openings'
        ).in_('id', company_ids).eq('user_id', user_id).execute()
    else:
        co_res = supabase.table('companies').select(
            'id,name,industry,size,description,tech_stack,recent_news,job_openings'
        ).eq('user_id', user_id).execute()
    companies = co_res.data or []

    completed = 0
    errors    = 0

    def _dm_one(company):
        nonlocal completed, errors
        cid  = company['id']
        name = company.get('name', '')
        try:
            stack = company.get('tech_stack') or []
            news  = company.get('recent_news') or []
            jobs  = company.get('job_openings') or []
            context = (
                f"Company: {name}\nIndustry: {company.get('industry') or ''}\n"
                f"Size: {company.get('size') or ''}\n"
                f"Description: {(company.get('description') or '')[:300]}\n"
                f"Tech stack: {', '.join(stack[:5]) if isinstance(stack, list) else ''}\n"
                f"Recent news: {news[0].get('title', '') if isinstance(news, list) and news else ''}\n"
                f"Open role: {jobs[0].get('title', '') if isinstance(jobs, list) and jobs else ''}"
            )
            res = _requests.post(
                'https://api.groq.com/openai/v1/chat/completions',
                headers={'Authorization': f'Bearer {groq_key}', 'Content-Type': 'application/json'},
                json={
                    'model': 'llama-3.1-70b-versatile',
                    'messages': [{'role': 'user', 'content': (
                        f"Write a short, personalised LinkedIn cold outreach message (under 300 chars) "
                        f"to a {persona} at {name}.\n\nContext:\n{context}\n\n"
                        "Rules:\n- Specific observation about their company\n- One value prop\n"
                        "- Soft CTA\n- No emojis. Under 300 chars.\nReturn ONLY the message text."
                    )}],
                    'max_tokens': 120,
                    'temperature': 0.7,
                },
                timeout=12,
            )
            if res.status_code == 200:
                msg = res.json()['choices'][0]['message']['content'].strip().strip('"')
                supabase.table('companies').update({'linkedin_dm': msg}).eq('id', cid).eq('user_id', user_id).execute()
            completed += 1
        except Exception:
            errors += 1
        update_job(job_id, supabase, completed=completed, errors=errors, status='running')

    with ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(_dm_one, companies))


_DM_TITLES = (
    'CEO OR Founder OR "Co-Founder" OR CTO OR COO OR CMO OR CFO OR CISO OR CRO OR CPO '
    'OR President OR "Vice President" OR "VP " OR Director OR "Head of"'
)

_HEADERS_WORKER = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'en-US,en;q=0.9',
}


def _ddg_linkedin_search(company_name: str, limit: int = 10) -> list[dict]:
    """
    Search for LinkedIn decision-maker profiles via the Vercel backend's
    /internal/search-profiles endpoint. Vercel IPs are not blocked by search
    engines; EC2 IPs are.
    """
    import requests as _req

    api_base = os.getenv('API_BASE_URL', 'https://leadgenengineplatform-api.vercel.app/api')
    token    = os.getenv('INTERNAL_TOKEN', '')

    if not token:
        print('[worker] INTERNAL_TOKEN not set — cannot search for profiles', flush=True)
        return []

    try:
        resp = _req.get(
            f'{api_base}/internal/search-profiles',
            params={'company': company_name, 'token': token},
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json().get('results', [])
        print(f'[worker] search-profiles returned {resp.status_code}: {resp.text[:200]}', flush=True)
    except Exception as e:
        print(f'[worker] search-profiles error: {e}', flush=True)
    return []


def _jina_fetch(url: str) -> str:
    """Fetch a URL via Firecrawl. Returns markdown or empty string."""
    from .enrichment import _fc_scrape
    try:
        return _fc_scrape(url, wait_ms=4000)
    except Exception:
        return ''


def _parse_dm_from_search(title: str, snippet: str) -> tuple[str, str]:
    """
    Extract name and job title from a DDG search result title/snippet.
    LinkedIn titles look like: "John Smith - CEO at Acme | LinkedIn"
    """
    import re
    name, job_title = '', ''

    # Title format: "First Last - Title at Company | LinkedIn"
    m = re.match(r'^(.+?)\s*[-–|]\s*(.+?)(?:\s*[|@·].*)?$', title)
    if m:
        name = m.group(1).strip()
        job_title = m.group(2).strip()
        # Remove trailing "| LinkedIn" artefacts
        job_title = re.sub(r'\s*\|\s*LinkedIn.*$', '', job_title, flags=re.IGNORECASE).strip()

    # Fallback: first part of snippet may have the title
    if not job_title and snippet:
        sm = re.search(r'(?:CEO|CTO|CFO|COO|CMO|CRO|CPO|CISO|Founder|Director|VP|President|Head of[^,\n]+)', snippet, re.IGNORECASE)
        if sm:
            job_title = sm.group(0).strip()

    return name, job_title


def _handle_playwright_dm_find(job_id: str, user_id: str, payload: dict):
    """
    Find decision makers for a company via DuckDuckGo search + Jina Reader.
    No LinkedIn session or Playwright required.
    """
    company_url  = payload.get('company_url', '')
    company_db_id = payload.get('company_db_id', '')
    company_name  = payload.get('company_name', '')

    # Derive company name from LinkedIn URL slug if not provided
    if not company_name and company_url:
        slug = company_url.rstrip('/').split('/')[-1]
        company_name = slug.replace('-', ' ').title()

    if not company_name:
        raise ValueError('company_name or company_url required for dm_find')

    update_job(job_id, supabase, status='running', completed=0)
    print(f'[worker] dm_find: searching for decision makers at "{company_name}"', flush=True)

    search_results = _ddg_linkedin_search(company_name, limit=12)
    print(f'[worker] dm_find: found {len(search_results)} candidate profiles', flush=True)

    leads_to_insert = []
    seen_urls: set[str] = set()

    for r in search_results:
        profile_url = r['url'].split('?')[0].rstrip('/')
        if profile_url in seen_urls or 'linkedin.com/in/' not in profile_url:
            continue
        seen_urls.add(profile_url)

        name, job_title = _parse_dm_from_search(r['title'], r['snippet'])
        if not name:
            continue

        # Try Jina Reader for richer profile details
        md = _jina_fetch(profile_url)
        if md and 'sign in' not in md.lower()[:200]:
            import re
            # Override name from H1 if present
            h1 = re.search(r'^#\s+(.+)$', md, re.MULTILINE)
            if h1:
                name = h1.group(1).strip()
            # Override title from profile headline
            h2 = re.search(r'^##\s+(.+)$', md, re.MULTILINE)
            if h2 and not job_title:
                job_title = h2.group(1).strip()

        leads_to_insert.append({
            'user_id':     user_id,
            'name':        name,
            'title':       job_title,
            'company':     company_name,
            'profile_url': profile_url,
            'status':      'new',
            'notes':       f'Source: dm_find (search+jina). Company: {company_name}',
        })

    if not leads_to_insert:
        update_job(job_id, supabase, status='completed', completed=0)
        print(f'[worker] dm_find: no leads found for {company_name}', flush=True)
        return

    # Deduplicate against existing leads for this user
    existing_urls = {
        r['profile_url']
        for r in (
            supabase.table('leads')
            .select('profile_url')
            .eq('user_id', user_id)
            .in_('profile_url', [l['profile_url'] for l in leads_to_insert])
            .execute()
            .data or []
        )
    }
    new_leads = [l for l in leads_to_insert if l['profile_url'] not in existing_urls]

    inserted = 0
    if new_leads:
        supabase.table('leads').insert(new_leads).execute()
        inserted = len(new_leads)

    # Mark company as scanned
    if company_db_id:
        try:
            supabase.table('companies').update(
                {'dm_scan_status': 'done', 'dm_scan_count': inserted}
            ).eq('id', company_db_id).eq('user_id', user_id).execute()
        except Exception:
            pass

    update_job(job_id, supabase, status='completed', completed=inserted)
    print(f'[worker] dm_find: inserted {inserted} leads for {company_name}', flush=True)


# ─── Dispatch table ───────────────────────────────────────────────────────────

HANDLERS = {
    'bulk_enrichment':    _handle_bulk_enrichment,
    'bulk_maps_enrich':   _handle_bulk_maps_enrich,
    'bulk_analyze':       _handle_bulk_analyze,
    'batch_dm':           _handle_batch_dm,
    'playwright_dm_find': _handle_playwright_dm_find,
}


# ─── Heartbeat ────────────────────────────────────────────────────────────────

def _heartbeat_loop(n_queues: int):
    """Write a heartbeat to Supabase every 60s so the API can detect worker health."""
    while True:
        try:
            supabase.table('worker_heartbeats').update({
                'updated_at':    time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'status':        'running',
                'queues_watched': n_queues,
            }).eq('id', 'sonar-worker').execute()
        except Exception as e:
            print(f'[worker] Heartbeat failed: {e}', flush=True)
        time.sleep(60)


# ─── Main polling loop ────────────────────────────────────────────────────────

def run():
    print('[worker] Starting SQS consumer...', flush=True)
    active_queues = {k: v for k, v in QUEUE_URLS.items() if v}
    if not active_queues:
        print('[worker] No SQS queue URLs configured — exiting.', flush=True)
        sys.exit(1)

    print(f'[worker] Watching queues: {list(active_queues.keys())}', flush=True)

    import threading
    threading.Thread(target=_heartbeat_loop, args=(len(active_queues),), daemon=True).start()

    while True:
        for job_type, queue_url in active_queues.items():
            try:
                resp = sqs.receive_message(
                    QueueUrl=queue_url,
                    MaxNumberOfMessages=1,
                    WaitTimeSeconds=POLL_WAIT,
                    VisibilityTimeout=QUEUE_TIMEOUTS.get(job_type, VISIBILITY_TIMEOUT),
                )
                messages = resp.get('Messages', [])
            except Exception as e:
                print(f'[worker] SQS receive error ({job_type}): {e}', flush=True)
                time.sleep(5)
                continue

            for msg in messages:
                receipt = msg['ReceiptHandle']
                try:
                    body    = json.loads(msg['Body'])
                    job_id  = body['job_id']
                    user_id = body['user_id']
                    payload = body['payload']

                    print(f'[worker] Processing job {job_id} ({job_type})', flush=True)
                    update_job(job_id, supabase, status='running')

                    handler = HANDLERS.get(job_type)
                    if handler:
                        t_start = time.time()
                        handler(job_id, user_id, payload)
                        update_job(job_id, supabase, status='completed')
                        print(f'[worker] Job {job_id} completed', flush=True)
                        # Email notification for enrichment jobs
                        if job_type in ('bulk_enrichment', 'bulk_analyze'):
                            try:
                                job_row = supabase.table('jobs').select('completed,total').eq('id', job_id).maybe_single().execute()
                                jd = job_row.data or {}
                                dur_min = round((time.time() - t_start) / 60)
                                backend_url = os.getenv('BACKEND_URL', 'https://leadgenengineplatform-api.vercel.app')
                                import requests as _nr
                                _nr.post(
                                    f"{backend_url}/internal/notify-job-complete",
                                    params={"token": os.getenv("INTERNAL_TOKEN", "")},
                                    json={
                                        "user_id":     user_id,
                                        "count":       jd.get("completed", 0),
                                        "total":       jd.get("total", 0),
                                        "duration_min": dur_min,
                                    },
                                    timeout=15,
                                )
                            except Exception as _ne:
                                print(f'[worker] Notify email failed: {_ne}', flush=True)
                    else:
                        print(f'[worker] No handler for job type {job_type}', flush=True)

                except Exception:
                    print(f'[worker] Job {body.get("job_id")} failed:\n{traceback.format_exc()}', flush=True)
                    try:
                        update_job(
                            body.get('job_id'), supabase,
                            status='failed',
                            error_message=traceback.format_exc()[-500:],
                        )
                    except Exception:
                        pass
                finally:
                    # Always delete from queue — failed jobs are tracked in DB
                    try:
                        sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=receipt)
                    except Exception as e:
                        print(f'[worker] Failed to delete SQS message: {e}', flush=True)


if __name__ == '__main__':
    run()
