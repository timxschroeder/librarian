-- Table-level GRANTs for the application roles.
--
-- RLS policies (defined in 001_initial.sql) are only evaluated *after* a role
-- passes table-level privilege checks. Because these tables are created via the
-- Supabase Management API rather than the dashboard's normal path, the
-- `authenticated`/`anon` roles never received the GRANTs that the policies assume —
-- so writes failed in production with `permission denied for table books`
-- (Postgres 42501, a missing GRANT, not an RLS denial).
--
-- GRANT/REVOKE are idempotent, so re-running this migration is always safe.
-- Per-row scoping is still enforced by the existing RLS policies; these GRANTs
-- only open the table to the role so the policies can run.

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on public.books          to authenticated;
grant select, insert, update, delete on public.user_books     to authenticated;
grant select, insert, update, delete on public.profiles       to authenticated;
grant select, insert, update, delete on public.recommendations to authenticated;
