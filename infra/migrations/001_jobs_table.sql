-- Jobs table for SQS-backed async task tracking
-- Run in Supabase SQL editor or via supabase db push

create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            text not null,              -- bulk_enrichment | bulk_maps_enrich | bulk_analyze | batch_dm
  status          text not null default 'queued', -- queued | running | completed | failed
  total           int  not null default 0,
  completed       int  not null default 0,
  errors          int  not null default 0,
  payload         jsonb,                      -- original request payload (for retry)
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Users can only see their own jobs
alter table public.jobs enable row level security;

create policy "users see own jobs"
  on public.jobs for all
  using (auth.uid() = user_id);

-- Index for polling: GET /jobs?status=running
create index jobs_user_status_idx on public.jobs(user_id, status, created_at desc);
