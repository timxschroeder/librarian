-- Table-level GRANTs for the `service_role` (the Edge Functions' backend role).
--
-- Same Management-API gap that 003_grants.sql fixed for `authenticated`/`anon`:
-- because these tables are created via the Supabase Management API rather than the
-- dashboard, `service_role` never received the table privileges a normal Supabase
-- project grants it by default. It had only REFERENCES/TRIGGER/TRUNCATE — no
-- SELECT/INSERT/UPDATE/DELETE on any table.
--
-- The `librarian` Edge Function uses the service-role key, so every read and write
-- it made failed silently: it fell back to an empty shelf/portrait (degraded
-- recommendations) and could never persist `profiles.taste_summary`,
-- `profiles.taste_axes`, or `profiles.discover_slate` — they stayed null. The new
-- taste recompute *checks* its update error, which surfaced the long-standing
-- silent failure as a 500 ("Could not load your taste profile").
--
-- service_role bypasses RLS, so these GRANTs are all it needs. GRANT/ALTER DEFAULT
-- PRIVILEGES are idempotent — re-running is safe. The `all tables`/default-privileges
-- form also covers any future table, so this gap can't recur per-table.

grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
