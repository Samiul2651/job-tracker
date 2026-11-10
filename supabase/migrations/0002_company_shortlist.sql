-- Companies you want to keep an eye on, separate from individual jobs.
-- The app also creates this table on its own the first time it is needed.
create table if not exists shortlisted_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  added_by text not null default 'me' check (added_by in ('me','claude')),
  created_at timestamptz not null default now()
);
create unique index if not exists shortlisted_companies_name_unique on shortlisted_companies (lower(name));
alter table shortlisted_companies enable row level security;
