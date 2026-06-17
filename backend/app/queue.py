"""SQS job dispatch and job-status helpers."""
import boto3
import json
import os
import uuid
from datetime import datetime, timezone

_sqs = None


def _client():
    global _sqs
    if _sqs is None:
        _sqs = boto3.client('sqs', region_name=os.getenv('AWS_REGION', 'us-east-1'))
    return _sqs


QUEUE_URLS: dict[str, str] = {
    'bulk_enrichment':  os.getenv('SQS_BULK_ENRICHMENT_URL', ''),
    'bulk_maps_enrich': os.getenv('SQS_BULK_MAPS_ENRICH_URL', ''),
    'bulk_analyze':     os.getenv('SQS_BULK_ANALYZE_URL', ''),
    'batch_dm':         os.getenv('SQS_BATCH_DM_URL', ''),
}


def dispatch_job(job_type: str, user_id: str, payload: dict, supabase) -> str:
    """Create a job record in the DB and enqueue it on SQS. Returns the job_id."""
    queue_url = QUEUE_URLS.get(job_type)
    if not queue_url:
        raise ValueError(f"No SQS queue configured for job type: {job_type}")

    job_id = str(uuid.uuid4())
    total = len(
        payload.get('company_ids') or payload.get('lead_ids') or []
    )

    supabase.table('jobs').insert({
        'id':         job_id,
        'user_id':    user_id,
        'type':       job_type,
        'status':     'queued',
        'total':      total,
        'completed':  0,
        'errors':     0,
        'payload':    json.dumps(payload),
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }).execute()

    _client().send_message(
        QueueUrl=queue_url,
        MessageBody=json.dumps({
            'job_id':   job_id,
            'job_type': job_type,
            'user_id':  user_id,
            'payload':  payload,
        }),
        # FIFO queues: group per user so one user's jobs don't block another's
        MessageGroupId=user_id,
        MessageDeduplicationId=job_id,
    )

    return job_id


def update_job(job_id: str, supabase, *, completed: int = None,
               errors: int = None, status: str = None, error_message: str = None):
    update: dict = {'updated_at': datetime.now(timezone.utc).isoformat()}
    if completed is not None:
        update['completed'] = completed
    if errors is not None:
        update['errors'] = errors
    if status is not None:
        update['status'] = status
    if error_message is not None:
        update['error_message'] = error_message
    supabase.table('jobs').update(update).eq('id', job_id).execute()


def get_job(job_id: str, user_id: str, supabase) -> dict | None:
    res = supabase.table('jobs').select('*').eq('id', job_id).eq('user_id', user_id).maybe_single().execute()
    return res.data
