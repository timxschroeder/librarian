-- 009_reading_goal.sql
-- A simple yearly reading goal the user sets in Settings (number of books).
-- The shelf reads it to render a progress bar and trigger the celebration
-- animation once the goal is met. Null means "no goal set".
--
-- Idempotent. No new GRANT needed: 003_grants.sql already grants all
-- privileges on public.profiles to `authenticated` at the table level,
-- which covers new columns. Owner-only RLS from 004_isolation.sql applies
-- unchanged.

alter table public.profiles
  add column if not exists reading_goal integer;
