import { supabase } from './supabase'
import type { ParsedEntry, SlateBook, TasteAxes } from '../types'

export async function initializeTastePortrait(
  books: { title: string; author: string }[],
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('librarian', {
    body: { mode: 'initialize', books },
  })
  if (error) throw error
  return (data as { taste_summary: string }).taste_summary
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
 * Recompute the structured 5-axis taste profile. The edge function reads the
 * user's shelf + portrait, projects them onto the axes, and persists `taste_axes`
 * server-side; it also returns the fresh axes so the caller can update the UI.
 */
export async function recomputeTasteProfile(): Promise<TasteAxes> {
  const { data, error } = await supabase.functions.invoke('librarian', {
    body: { mode: 'profile' },
  })
  if (error) throw error
  return (data as { taste_axes: TasteAxes }).taste_axes
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
