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

from .queue import QUEUE_URLS, update_job

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


# ─── Dispatch table ───────────────────────────────────────────────────────────

HANDLERS = {
    'bulk_enrichment':  _handle_bulk_enrichment,
    'bulk_maps_enrich': _handle_bulk_maps_enrich,
    'bulk_analyze':     _handle_bulk_analyze,
}


# ─── Main polling loop ────────────────────────────────────────────────────────

def run():
    print('[worker] Starting SQS consumer...', flush=True)
    active_queues = {k: v for k, v in QUEUE_URLS.items() if v}
    if not active_queues:
        print('[worker] No SQS queue URLs configured — exiting.', flush=True)
        sys.exit(1)

    print(f'[worker] Watching queues: {list(active_queues.keys())}', flush=True)

    while True:
        for job_type, queue_url in active_queues.items():
            try:
                resp = sqs.receive_message(
                    QueueUrl=queue_url,
                    MaxNumberOfMessages=1,
                    WaitTimeSeconds=POLL_WAIT,
                    VisibilityTimeout=VISIBILITY_TIMEOUT,
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
                        handler(job_id, user_id, payload)
                        update_job(job_id, supabase, status='completed')
                        print(f'[worker] Job {job_id} completed', flush=True)
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
