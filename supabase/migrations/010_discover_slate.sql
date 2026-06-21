-- 010_discover_slate.sql
-- The cached Discover slate: a pre-computed set of recommendation rows the
-- librarian writes from the shelf + taste portrait, read by the Discover tab.
-- Stored as jsonb on the profile (same pattern as taste_axes) with the shelf
-- signature embedded so the client can tell when it's stale and recompute.
-- Shape (see src/types/index.ts → DiscoverSlate):
--   {
--     "signature":   "<bookCount>:<ratingsSum>",
--     "updated_at":  "<iso8601>",
--     "best_picks":  [ DiscoverBook, ... ],   -- "sure things"
--     "stretch":     [ DiscoverBook, ... ],   -- just outside the usual
--     "seeds":       [ { "seed_title": "...", "books": [ DiscoverBook, ... ] }, ... ]
--   }
-- where DiscoverBook = { id, title, author, cover_url, first_publish_year, reasoning }.
--
-- Idempotent. No new GRANT needed: 003_grants.sql already grants all privileges
-- on public.profiles to `authenticated` at the table level, which covers new
-- columns. Owner-only RLS from 004_isolation.sql applies unchanged.

alter table public.profiles
  add column if not exists discover_slate jsonb;
