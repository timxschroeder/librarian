import { supabase } from './supabase'
import type { Book, Profile, UserBook } from '../types'

// Single home for every Supabase table call. The Supabase JS client never throws —
// it returns `{ data, error }` — so each function checks `error` and throws once,
// here, instead of re-implementing that contract at every call site (where it was
// repeatedly forgotten, producing silent failures). Components must call these
// functions and never import `supabase` directly.

function today(): string {
  return new Date().toISOString().split('T')[0]
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as Profile) ?? null
}

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Profile not found — try signing out and back in.')
}

export async function getUserBooks(userId: string): Promise<UserBook[]> {
  const { data, error } = await supabase
    .from('user_books')
    .select('*, book:books(*), profile:profiles(id, name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as UserBook[]) ?? []
}

export async function upsertBookAndUserBook(
  userId: string,
  book: Book,
  rating: number,
): Promise<void> {
  const { error: bookErr } = await supabase.from('books').upsert(book, { onConflict: 'id' })
  if (bookErr) throw bookErr

  const { error: ubErr } = await supabase.from('user_books').upsert(
    { user_id: userId, book_id: book.id, rating: rating || null, read_at: today() },
    { onConflict: 'user_id,book_id' },
  )
  if (ubErr) throw ubErr
}

export interface OnboardingBook {
  book: Book
  rating: number
}

export async function completeOnboarding(
  userId: string,
  genres: string[],
  books: OnboardingBook[],
): Promise<void> {
  if (books.length > 0) {
    const { error: booksErr } = await supabase
      .from('books')
      .upsert(books.map(b => b.book), { onConflict: 'id' })
    if (booksErr) throw booksErr

    const { error: ubErr } = await supabase.from('user_books').upsert(
      books.map(b => ({
        user_id: userId,
        book_id: b.book.id,
        rating: b.rating || null,
        read_at: today(),
      })),
      { onConflict: 'user_id,book_id' },
    )
    if (ubErr) throw ubErr
  }

  await updateProfile(userId, { genres, onboarded_at: new Date().toISOString() })
}
