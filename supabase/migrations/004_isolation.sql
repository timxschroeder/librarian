-- 004_isolation.sql
-- Enforce strict per-user data isolation.
--
-- Previously:
--   • profiles_select  — all authenticated users could read every profile row
--   • user_books_select — all authenticated users could read every shelf row
--     ("partners see each other's shelves")
--
-- New policy: every user may access ONLY their own rows.
-- books is a shared metadata cache and is intentionally left as-is.
--
-- All DROP/CREATE pairs are idempotent — safe to re-run on every deploy.

-- ── profiles ──────────────────────────────────────────────────────────────────
-- Replace the unrestricted SELECT with an owner-only SELECT.
-- INSERT and UPDATE were already owner-only in 001_initial.sql; leave them.

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- ── user_books ────────────────────────────────────────────────────────────────
-- Replace the unrestricted SELECT with an owner-only SELECT.
-- The existing "user_books_write" ALL policy already scopes to auth.uid() = user_id;
-- re-create it here so this migration is the single authoritative definition of
-- the full policy set for this table going forward.

drop policy if exists "user_books_select" on public.user_books;
create policy "user_books_select" on public.user_books
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user_books_write" on public.user_books;
create policy "user_books_write" on public.user_books
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── recommendations ───────────────────────────────────────────────────────────
-- Already owner-only in 001_initial.sql; re-create idempotently to make this
-- migration self-documenting as the complete isolation specification.

drop policy if exists "recommendations_select" on public.recommendations;
create policy "recommendations_select" on public.recommendations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "recommendations_write" on public.recommendations;
create policy "recommendations_write" on public.recommendations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── books ─────────────────────────────────────────────────────────────────────
-- Intentionally left as-is: books is a shared Open Library metadata cache,
-- not personal data.  The policies in 001_initial.sql (books_select,
-- books_insert, books_update) remain in effect unchanged.
