import { supabase } from './supabase'
import type { ParsedEntry, TasteAxes } from '../types'

export interface RecommendationSlate {
  title: string
  author: string
  type: 'comfort' | 'stretch' | 'sure_thing'
  reasoning: string
}

export async function initializeTastePortrait(
  books: { title: string; author: string }[],
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('librarian', {
    body: { mode: 'initialize', books },
  })
  if (error) throw error
  return (data as { taste_summary: string }).taste_summary
}

export async function chat(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<{ message: string; taste_summary_update: string | null }> {
  const { data, error } = await supabase.functions.invoke('librarian', {
    body: { mode: 'chat', message, history },
  })
  if (error) throw error
  return data as { message: string; taste_summary_update: string | null }
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

export async function recommend(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<{ intro: string; recommendations: RecommendationSlate[] }> {
  const { data, error } = await supabase.functions.invoke('librarian', {
    body: { mode: 'recommend', message, history },
  })
  if (error) throw error
  return data as { intro: string; recommendations: RecommendationSlate[] }
}
