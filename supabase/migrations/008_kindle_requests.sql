-- 008_kindle_requests.sql
-- "Send to Kindle": the public app records *intent* only. A private, local worker
-- (not in this repo) polls this table, acquires the book, and emails it to the
-- user's Kindle. So this migration adds (a) where to deliver and (b) the queue.
--
-- One request row per (user_id, book_id): re-sending / retrying re-uses the row and
-- resets it to 'pending' (see db.ts createKindleRequest upsert). Owner-only RLS — a
-- user only sees/queues their own rows; the worker uses the service-role key (which
-- bypasses RLS) to read every pending row and each user's kindle_email.
--
-- Idempotent throughout. New table needs an explicit GRANT (003_grants.sql pattern) —
-- the deploy's "Verify table grants" step asserts it.

-- Where to deliver. Covered by the existing profiles GRANT (003) and owner-only RLS (004).
alter table public.profiles
  add column if not exists kindle_email text;

-- Request lifecycle. pending = queued (worker hasn't picked it up); fetching = worker
-- is actively downloading; no_source = no source had the book (distinct from a
-- transient failure, though the UI treats both as "couldn't find it").
do $$
begin
  if not exists (select 1 from pg_type where typname = 'kindle_status') then
    create type public.kindle_status as enum ('pending', 'fetching', 'sent', 'failed', 'no_source');
  end if;
end $$;

create table if not exists public.kindle_requests (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  book_id     text references public.books(id) on delete cascade not null,
  status      public.kindle_status not null default 'pending',
  source      text,
  error       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  sent_at     timestamptz,
  unique (user_id, book_id)
);

-- Worker scans for work ordered by recency of request, filtered by status.
create index if not exists kindle_requests_status_idx
  on public.kindle_requests (status, updated_at);

alter table public.kindle_requests enable row level security;

drop policy if exists "kindle_requests_select" on public.kindle_requests;
create policy "kindle_requests_select" on public.kindle_requests
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "kindle_requests_write" on public.kindle_requests;
create policy "kindle_requests_write" on public.kindle_requests
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RLS runs only after table-level privilege checks — without this GRANT, writes fail
-- with "permission denied for table kindle_requests" (42501), not an RLS denial.
grant select, insert, update, delete on public.kindle_requests to authenticated;
