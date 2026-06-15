# Bulk import — design & implementation

> Status: planned (mock approved 2026-06-15). Feature branch: `feat/bulk-import`.
> Goal: get a reading backlog onto the shelf in one paste, with minimal per-book friction.

## North star

**"Rather a wrong book in than friction in populating."** Optimize for throughput, make
correction cheap. Every decision below bends toward this — when in doubt, prefer adding a
questionable match (clearly flagged, one tap to remove) over a confirmation step.

## The journey

1. **Entry** — an "Import a list" action on the Shelf header (next to "Add").
2. **Paste** — one freeform textarea. No format rules: a list, reading notes, or a
   half-remembered paragraph ("all of the Wayfarers books", "that new Sally Rooney one").
3. **Match** — Gemini parses the text to candidate `{title, author}` entries; each is
   resolved against Open Library to a real book + cover.
4. **Review** — matches land **straight on the shelf** in a transient "just added" batch.
   A banner reports counts; low-confidence guesses are flagged. Tap to remove a wrong one.
5. **Done** — dismiss the banner; the batch melts into the shelf. Ratings happen later.

## Settled decisions

| Decision | Choice | Why |
|---|---|---|
| Landing | Straight to shelf, no staging area | Matches "get them up, tidy later"; kills a gate |
| Review | Transient client-side "just added" batch | Reviewable as a batch without a schema migration |
| Series ("all of X's books") | Expand but flag | Magical when right; the flag covers when wrong |
| Low-confidence matches | Amber flag on the cover | Review collapses to "check the flagged ones" |
| Fixing a wrong guess | Delete-and-repaste, **not** inline swap | Simpler; deletion is the friction-free correction |
| Duplicates | Skip silently, **report** in the banner | Nothing feels dropped |
| Ratings/notes | Excluded — set later on the shelf | Keep the paste about titles only |

Known blind spot: a *plausible-but-wrong* match (right cover/title, wrong book) won't be
caught by visual cover scanning. Accepted risk for a two-person app; not designed around.

## Architecture

Follows the existing seams — no new tables, no migration.

### 1. Parse (Gemini) — `supabase/functions/librarian/index.ts`

New `mode: 'parse'`. Input `{ text }`; output JSON only:

```json
{ "entries": [
  { "title": "", "author": "", "confidence": 0.0, "source_line": "", "series_expanded": false }
] }
```

- `confidence` 0..1 — the model's certainty the title/author is correct and unambiguous.
- `source_line` — the original fragment, so the UI can show "from: …" and the user knows
  what produced a bad match.
- `series_expanded: true` — this entry was inferred from a series/author instruction rather
  than named directly; always treated as low-confidence for flagging.

Reuses the existing `gemini()` helper + `match(/\{[\s\S]*\}/)` JSON extraction pattern.
Low temperature (≈0.2), like `profile`/`recommend`.

### 2. Match (Open Library) — client, `src/lib/openLibrary.ts`

For each parsed entry, `searchBooks(\`${title} ${author}\`)` and take the top result →
`toBook(result)`. A new helper `matchEntry(entry)` wraps this and returns
`{ book, matchConfidence, flagged }` where `flagged = entry.series_expanded ||
entry.confidence < THRESHOLD || no OL result`. Entries with no OL hit become **unmatched**
(reported, not added). **Skip `enrichBook()` in bulk** — it's an extra Google Books call
per title; Open Library covers are enough for the shelf. Enrichment can happen lazily later.

### 3. Persist (batch) — `src/lib/db.ts`

New `bulkAddBooks(userId, books): Promise<{ added: UserBook[]; skipped: number }>`:

1. Fetch the user's existing `book_id`s.
2. Partition incoming books into new vs. already-present (→ `skipped` count).
3. `upsert` new books into `books`, then insert the new `user_books` rows.
4. Return the inserted `user_books` (joined like `getUserBooks`) so the Shelf can show
   the batch immediately, plus the skipped count for the banner.

Covered in `src/lib/db.test.ts`: builds the right payload, partitions correctly, throws on
error, returns the added rows.

### 4. UI

- `src/components/BulkImportModal.tsx` — paste box → parse → match → calls `bulkAddBooks`
  → hands the result up via `onImported(batch)`. Mirrors `AddBookModal`'s structure,
  error handling, and design tokens.
- `src/pages/Shelf.tsx` — holds a `batch` review state. When set: render a banner
  ("Added N · M already on your shelf · X couldn't be found") and tag the batch's
  `BookCard`s. Flagged cards get an amber marker + a quick remove (`deleteUserBook`).
  Dismissing the banner clears the batch state — the books remain on the shelf.
- `BookCard` gains optional `flagged?` and `onRemove?` props for the review affordance;
  unchanged in normal shelf use.

## Where to extend later

- **Confidence threshold** lives in one constant in `matchEntry`. Tune from real pastes.
- **Series expansion bound** — cap how many books one instruction can yield (prompt + a
  client clamp) so "all of Brandon Sanderson" can't dump 40 books.
- **Inline swap** — if delete-and-repaste proves annoying, the review card is the natural
  home for a "wrong? pick the right one" search.
- **Photo / OCR import** — a spine photo could feed the same parse→match→review pipeline;
  only the input stage changes.
- **Persisted batch** — if review-later (not just review-now) is ever wanted, add an
  `import_batch_id` column to `user_books`; the current design deliberately avoids it.

## Testing

- `db.test.ts` — `bulkAddBooks` payload/partition/error cases (highest value).
- `openLibrary.test.ts` — `matchEntry` flagging logic (pure, mock `searchBooks`).
- `BulkImportModal.test.tsx` — paste → parse(mocked) → review hand-off; mock `../lib/db`
  and `../lib/librarian`.
- One manual check against real Supabase + Gemini before merge (per CLAUDE.md DoD).
