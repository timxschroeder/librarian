-- 012_app_events.sql
-- A queryable behavioural event log — the analytics twin of app_errors (011). We have
-- no third-party analytics; instead, products events land in Postgres and are inspected
-- out-of-band via the Management API (the one store that's reliably queryable here).
-- This exists because a user once reported "fiction got selected without me choosing
-- it" and there was no trail to reconstruct what they actually did. Now there is.
--
-- Written fire-and-forget from the client via src/lib/events.ts → db.ts:logAppEvent.
-- Never blocks the UI and never surfaces to the user.
--
-- Inspect with, e.g. (or use scripts/analytics.sh):
--   select created_at, name, props from app_events
--   where user_id = '<id>' order by created_at;            -- replay one user's session
--
--   select * from app_event_counts;                        -- per-day, per-event counts
--
-- Idempotent.

create table if not exists public.app_events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete set null,
  name       text not null,                       -- 'onboarding_genre_toggled', ...
  props      jsonb not null default '{}'::jsonb    -- { key, selected, source, ... }
);

create index if not exists app_events_created_at_idx on public.app_events (created_at desc);
create index if not exists app_events_name_created_at_idx on public.app_events (name, created_at desc);
create index if not exists app_events_user_id_idx on public.app_events (user_id, created_at desc);

alter table public.app_events enable row level security;

-- Authenticated users may record their own (or pre-auth) events. Nobody reads via the
-- API — events are inspected out-of-band via the Management API / service_role (which
-- bypasses RLS), so there is deliberately no SELECT policy. Mirrors app_errors.
drop policy if exists app_events_insert_own on public.app_events;
create policy app_events_insert_own on public.app_events
  for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- GRANTs (Management-API-created tables don't auto-grant — see 003/009).
grant insert on public.app_events to authenticated;
grant select, insert on public.app_events to service_role;

-- Convenience rollup so day-by-day event volume is one `select * from app_event_counts`
-- away rather than a hand-written group-by each time. CREATE OR REPLACE = idempotent.
create or replace view public.app_event_counts as
  select
    date_trunc('day', created_at)::date as day,
    name,
    count(*) as events,
    count(distinct user_id) as users
  from public.app_events
  group by 1, 2
  order by 1 desc, 3 desc;

grant select on public.app_event_counts to service_role;
