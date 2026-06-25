import { supabase } from './supabase'
import type { Book, ChatMessage, KindleRequest, Profile, SlateBook, UserBook } from '../types'

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

/**
 * The one deliberate exception to the throw-on-error contract above: a best-effort
 * write to the `app_errors` log. A logging failure must never surface to the user or
 * mask the original error, so this swallows everything. Call it via
 * `src/lib/errorLog.ts` rather than directly.
 */
export async function logAppError(entry: {
  source: 'client' | 'edge'
  userId?: string | null
  context?: Record<string, unknown>
  message: string
  stack?: string | null
}): Promise<void> {
  try {
    await supabase.from('app_errors').insert({
      source: entry.source,
      user_id: entry.userId ?? null,
      context: entry.context ?? {},
      message: entry.message.slice(0, 4000),
      stack: entry.stack ? entry.stack.slice(0, 8000) : null,
    })
  } catch {
    // Swallow: logging must never throw.
  }
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

/**
 * Mark a Discover suggestion as dismissed. Caches the book (so the recommendation row
 * can reference it) then records a `rejected` recommendation. Both the Discover slate
 * and the chat recommender read these back and never resurface a dismissed book.
 */
export async function rejectBook(userId: string, book: Book): Promise<void> {
  const { error: bookErr } = await supabase.from('books').upsert(book, { onConflict: 'id' })
  if (bookErr) throw bookErr

  const { error } = await supabase
    .from('recommendations')
    .insert({ user_id: userId, book_id: book.id, status: 'rejected' })
  if (error) throw error
}

export async function updateUserBookRating(userBookId: string, rating: number | null): Promise<void> {
  const { error } = await supabase
    .from('user_books')
    .update({ rating })
    .eq('id', userBookId)
  if (error) throw error
}

/**
 * Add many books to a user's shelf in one shot (bulk import). Skips books already on
 * the shelf and de-dupes within the batch, so re-pasting is safe. Returns the freshly
 * inserted `user_books` rows (joined like `getUserBooks`, so the shelf can show them
 * immediately) plus how many were skipped — for the "just added" review banner.
 * See docs/bulk-import.md.
 */
export async function bulkAddBooks(
  userId: string,
  books: Book[],
): Promise<{ added: UserBook[]; skipped: number }> {
  if (books.length === 0) return { added: [], skipped: 0 }

  const { data: existing, error: exErr } = await supabase
    .from('user_books')
    .select('book_id')
    .eq('user_id', userId)
    .in('book_id', books.map((b) => b.id))
  if (exErr) throw exErr
  const have = new Set((existing as { book_id: string }[] ?? []).map((r) => r.book_id))

  const seen = new Set<string>()
  const fresh = books.filter((b) => {
    if (have.has(b.id) || seen.has(b.id)) return false
    seen.add(b.id)
    return true
  })
  const skipped = books.length - fresh.length
  if (fresh.length === 0) return { added: [], skipped }

  const { error: bookErr } = await supabase.from('books').upsert(fresh, { onConflict: 'id' })
  if (bookErr) throw bookErr

  const { data: inserted, error: ubErr } = await supabase
    .from('user_books')
    .insert(fresh.map((b) => ({ user_id: userId, book_id: b.id, read_at: today() })))
    .select('*, book:books(*), profile:profiles(id, name)')
  if (ubErr) throw ubErr

  return { added: (inserted as UserBook[]) ?? [], skipped }
}

export async function deleteUserBook(userBookId: string): Promise<void> {
  const { error } = await supabase.from('user_books').delete().eq('id', userBookId)
  if (error) throw error
}

// ── Send to Kindle ──────────────────────────────────────────────────────────
// The app only writes intent here; a private local worker fulfils it. See
// docs/.. (kept out of this repo) and the project memory for the full design.

/** Every Kindle request for a user, keyed by book elsewhere. Owner-only via RLS. */
export async function getKindleRequests(userId: string): Promise<KindleRequest[]> {
  const { data, error } = await supabase
    .from('kindle_requests')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return (data as KindleRequest[]) ?? []
}

/**
 * Queue (or re-queue) a book for Kindle delivery. One row per (user, book): a retry
 * re-uses the row and resets it to `pending`, clearing any prior error/source/sent_at,
 * so the worker treats it as fresh. Returns the row so the caller can reflect status.
 */
export async function createKindleRequest(userId: string, bookId: string): Promise<KindleRequest> {
  const { data, error } = await supabase
    .from('kindle_requests')
    .upsert(
      {
        user_id: userId,
        book_id: bookId,
        status: 'pending',
        source: null,
        error: null,
        sent_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,book_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  if (!data) throw new Error('Could not queue this book for Kindle. Try again.')
  return data as KindleRequest
}

export async function getChatHistory(userId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) throw error
  return (data as ChatMessage[]) ?? []
}

export async function saveChatMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  slate: SlateBook[] | null = null,
): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .insert({ user_id: userId, role, content, slate })
  if (error) throw error
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
