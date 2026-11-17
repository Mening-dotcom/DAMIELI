-- Daily usage counters for the AI endpoints (cost protection).
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run.

create table if not exists usage_daily (
  identity text not null,          -- userId, or 'ip:<address>' for anonymous
  day      date not null,
  kind     text not null,          -- 'match' | 'generate' | 'roles'
  count    integer not null default 0,
  primary key (identity, day, kind)
);
