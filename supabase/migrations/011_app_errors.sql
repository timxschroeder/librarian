-- 011_app_errors.sql
-- A queryable error log. We debug by querying Postgres via the Management API (the one
-- store that's reliably queryable here — function/edge logs were effectively opaque),
-- so failures should land in a table, not just stdout. The librarian Edge Function
-- writes a row on any 500 (with a correlation id it also returns to the client), and
-- the client reports its own caught failures here too. See src/lib/errorLog.ts.
--
-- Inspect with, e.g.:
--   select created_at, source, context->>'mode' as mode, message
--   from app_errors order by created_at desc limit 50;
--
-- Idempotent.

create table if not exists public.app_errors (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source     text not null,                 -- 'edge' | 'client'
  user_id    uuid references auth.users(id) on delete set null,
  context    jsonb not null default '{}'::jsonb,  -- { mode, fn, route, ... }
  message    text not null,
  stack      text
);

create index if not exists app_errors_created_at_idx on public.app_errors (created_at desc);

alter table public.app_errors enable row level security;

-- Authenticated users may record their own (or pre-auth) client errors. Nobody reads
-- via the API — errors are inspected out-of-band via the Management API / service_role
-- (which bypasses RLS), so there is deliberately no SELECT policy.
drop policy if exists app_errors_insert_own on public.app_errors;
create policy app_errors_insert_own on public.app_errors
  for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- GRANTs (Management-API-created tables don't auto-grant — see 003/009).
grant insert on public.app_errors to authenticated;
grant select, insert on public.app_errors to service_role;
