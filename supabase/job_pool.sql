-- Accumulating job pool: every job any search fetches is stored here, so the
-- pool grows day by day instead of resetting to each board's newest ~100.
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run.

create table if not exists job_pool (
  url          text primary key,
  source       text not null default '',
  title        text not null default '',
  company      text not null default '',
  description  text not null default '',
  location     text not null default '',
  "remoteType" text not null default 'unknown',
  eligibility  text not null default 'unknown',
  "salaryText" text,
  "postedAt"   text,
  "firstSeen"  timestamptz not null default now(),
  "lastSeen"   timestamptz not null default now()
);

create index if not exists job_pool_last_seen on job_pool ("lastSeen" desc);
