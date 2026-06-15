-- 007_taste_axes.sql
-- The legible layer of the taste model: a structured 5-axis projection the
-- librarian writes from the shelf + chat. Stored as jsonb on the profile and
-- read by the Taste tab. Shape (see src/types/index.ts → TasteAxes):
--   {
--     "source_of_reward": { "language": 0..1, "story": 0..1, "character": 0..1, "ideas": 0..1 },
--     "weight":     { "value": -1..1, "confidence": 0..1 },
--     "propulsion": { "value": -1..1, "confidence": 0..1 },
--     "darkness":   { "value": -1..1, "confidence": 0..1 },
--     "tone":       { "value": -1..1, "confidence": 0..1 },
--     "signature":  "<bookCount>:<ratingsSum>",
--     "updated_at": "<iso8601>"
--   }
--
-- Idempotent. No new GRANT needed: 003_grants.sql already grants all privileges
-- on public.profiles to `authenticated` at the table level, which covers new
-- columns. Owner-only RLS from 004_isolation.sql applies unchanged.

alter table public.profiles
  add column if not exists taste_axes jsonb;
