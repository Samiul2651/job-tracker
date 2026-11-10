-- Job Tracker: tables for jobs and their history.
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  role text not null,
  url text,
  country text,
  work_mode text check (work_mode in ('remote','hybrid','onsite')),
  relocation text not null default 'unknown' check (relocation in ('yes','no','unknown')),
  visa_support text not null default 'unknown' check (visa_support in ('yes','no','unknown')),
  status text not null default 'saved'
    check (status in ('saved','applied','interview','offer','rejected','ghosted','withdrawn')),
  source text,
  salary_text text,
  applied_on date,
  follow_up_on date,
  cv_version text,
  cover_letter text,
  contact text,
  notes text,
  added_by text not null default 'me' check (added_by in ('me','claude')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists jobs_url_unique on jobs (url) where url is not null;
create index if not exists jobs_status_idx on jobs (status);
create index if not exists jobs_follow_up_idx on jobs (follow_up_on);

create table if not exists job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  kind text not null check (kind in ('created','status_change','note','interview')),
  from_status text,
  to_status text,
  text text,
  at timestamptz not null default now(),
  by text not null default 'me' check (by in ('me','claude'))
);

create index if not exists job_events_job_idx on job_events (job_id, at);

-- The app talks to the database from the server only.
-- Row-level security with no policies blocks Supabase's public API keys.
alter table jobs enable row level security;
alter table job_events enable row level security;
