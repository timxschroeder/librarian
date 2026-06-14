import { supabase } from './supabase'

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
