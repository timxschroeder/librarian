import { supabase } from './supabase'
import type { DiscoverSlate, ParsedEntry, SlateBook, TasteAxes } from '../types'

/**
 * Recompute the whole taste profile — prose portrait AND structured 5-axis model —
 * in one server pass. The edge function reads the shelf, the current portrait, and
 * recent conversation, rewrites both together, and persists them on the profile,
 * returning the fresh values. It's signature-guarded server-side: when nothing has
 * changed it returns the cache without calling the model, so callers can trigger it
 * freely after any book mutation or chat turn. Pass `force` to bypass the guard.
 */
export async function recomputeTaste(
  opts: { force?: boolean } = {},
): Promise<{ taste_summary: string | null; taste_axes: TasteAxes }> {
  const { data, error } = await supabase.functions.invoke('librarian', {
    body: { mode: 'recompute', force: opts.force ?? false },
  })
  if (error) throw error
  return data as { taste_summary: string | null; taste_axes: TasteAxes }
}

/**
 * One unified librarian turn. The librarian always leads with books on the table:
 * it returns a spoken `message` plus a fresh `recommendations` slate. Pass the
 * current `table` (each book carrying its `pinned` flag) so pinned picks survive the
 * re-roll and the reader can refine ("more like the second one"). `recommendations`
 * comes back empty only on a pure-conversation turn — the client keeps the existing
 * (sticky) table in that case. See project_librarian_chat.
 */
export async function converse(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  table: SlateBook[],
): Promise<{ message: string; recommendations: SlateBook[] }> {
  const { data, error } = await supabase.functions.invoke('librarian', {
    body: { mode: 'converse', message, history, table },
  })
  if (error) throw error
  return data as { message: string; recommendations: SlateBook[] }
}

/**
 * Recompute the cached Discover slate. The edge function reads the shelf + portrait,
 * generates the rows (best picks / stretch / "because you loved X"), resolves them
 * against Open Library, and persists `discover_slate` server-side; it returns the
 * fresh slate so the caller can render it without re-reading the profile.
 */
export async function computeDiscover(): Promise<DiscoverSlate> {
  const { data, error } = await supabase.functions.invoke('librarian', {
    body: { mode: 'discover' },
  })
  if (error) throw error
  return (data as { discover_slate: DiscoverSlate }).discover_slate
}

/**
 * Parse a freeform pasted reading list into candidate books. The edge function runs
 * Gemini over the raw text and resolves half-remembered references to real titles.
 * See docs/bulk-import.md.
 */
export async function parseReadingList(text: string): Promise<ParsedEntry[]> {
  const { data, error } = await supabase.functions.invoke('librarian', {
    body: { mode: 'parse', text },
  })
  if (error) throw error
  return (data as { entries: ParsedEntry[] }).entries ?? []
}
