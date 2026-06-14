-- Add Google Books rating fields to the books cache table.
-- Both columns are nullable — enrichment is best-effort and not all books
-- have ratings. ADD COLUMN IF NOT EXISTS makes this idempotent.

alter table public.books
  add column if not exists average_rating numeric(3,1),
  add column if not exists ratings_count  int;
