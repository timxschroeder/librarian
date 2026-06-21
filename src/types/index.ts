/** A single bipolar taste axis: a position from -1..1 and the librarian's confidence 0..1. */
export interface TasteAxis {
  value: number
  confidence: number
}

/**
 * The legible layer of the taste model — a projection the librarian writes from the
 * shelf + chat. `source_of_reward` is a composition (the four shares sum to 1); the
 * other four are bipolar axes. `signature` encodes the shelf state it was computed
 * from (book count + ratings sum) so the client can tell when it's stale.
 */
export interface TasteAxes {
  source_of_reward: { language: number; story: number; character: number; ideas: number }
  weight: TasteAxis // -1 effortless .. +1 demanding
  propulsion: TasteAxis // -1 slow burn .. +1 page-turner
  darkness: TasteAxis // -1 warm .. +1 bleak
  tone: TasteAxis // -1 earnest .. +1 playful
  signature: string
  updated_at: string
}

export interface Profile {
  id: string
  name: string
  email: string
  taste_summary: string | null
  taste_axes: TasteAxes | null
  discover_slate: DiscoverSlate | null
  genres: string[]
  onboarded_at: string | null
  created_at: string
  reading_goal: number | null
  /** Where "Send to Kindle" deliveries go, e.g. tim_a1b2@kindle.com. Null until set. */
  kindle_email: string | null
}

/**
 * A single recommended book in the Discover slate, already resolved against Open
 * Library server-side (so the client just renders it). `id` is the OL work id, used
 * both as the cover/key and as the `books.id` when the user adds it to their shelf.
 */
export interface DiscoverBook {
  id: string
  title: string
  author: string | null
  cover_url: string | null
  first_publish_year: number | null
  /** One warm sentence tying the pick to the reader's taste (or to the seed book). */
  reasoning: string
}

/**
 * The cached Discover slate (migration 010). The librarian writes it from the shelf +
 * taste portrait; `signature` (bookCount:ratingsSum, same as TasteAxes) lets the client
 * detect a changed shelf and recompute. `seeds` are the "because you loved X" rows.
 */
export interface DiscoverSlate {
  signature: string
  updated_at: string
  best_picks: DiscoverBook[]
  stretch: DiscoverBook[]
  seeds: { seed_title: string; books: DiscoverBook[] }[]
}

/**
 * Lifecycle of a Send-to-Kindle request (see migration 008). `pending` = queued, the
 * worker hasn't started; `fetching` = actively downloading; `no_source` = no source
 * had the book. The UI shows a spinner only for `fetching` — `pending` can sit for
 * hours if the worker's machine is offline, so it gets a static "Queued" instead.
 */
export type KindleStatus = 'pending' | 'fetching' | 'sent' | 'failed' | 'no_source'

export interface KindleRequest {
  id: string
  user_id: string
  book_id: string
  status: KindleStatus
  source: string | null
  error: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
}

export interface Book {
  id: string
  title: string
  author: string | null
  cover_url: string | null
  description: string | null
  first_publish_year: number | null
  subjects: string[] | null
  isbn: string | null
  average_rating: number | null
  ratings_count: number | null
}

export interface UserBook {
  id: string
  user_id: string
  book_id: string
  rating: number | null
  notes: string | null
  read_at: string
  created_at: string
  book: Book
  profile: Pick<Profile, 'id' | 'name'>
}

export interface Recommendation {
  id: string
  user_id: string
  book_id: string
  reasoning: string
  prompt: string | null
  status: 'pending' | 'accepted' | 'rejected'
  feedback: string | null
  created_at: string
  book: Book
}

/**
 * One book on the librarian's "table" — the sticky recommendation slate. `pinned`
 * books survive a re-roll (the librarian keeps them and refreshes the rest around
 * them). `type` is optional flavour (comfort/stretch/sure_thing) shown as a label
 * when it fits; null when it doesn't.
 */
export interface SlateBook {
  title: string
  author: string
  type: 'comfort' | 'stretch' | 'sure_thing' | null
  reasoning: string
  pinned: boolean
}

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  /**
   * The recommendation slate this assistant turn put on the table, if any. Null for
   * user messages and pure-conversation assistant turns. Persisted so the cards
   * re-render on refresh; the most recent non-null slate is the live table.
   */
  slate: SlateBook[] | null
  created_at: string
}

export interface OpenLibrarySearchResult {
  key: string
  title: string
  author_name?: string[]
  /** Open Library author identity keys, e.g. ['OL2976628A']. Disambiguates homonyms. */
  author_key?: string[]
  cover_i?: number
  first_publish_year?: number
  subject?: string[]
  isbn?: string[]
  /** MARC language codes the work has editions in, e.g. ['eng', 'ger']. */
  language?: string[]
  /** Number of editions Open Library has — a rough popularity/canonical signal. */
  edition_count?: number
}

/**
 * A candidate book extracted from a pasted reading list by the librarian `parse` step.
 * `source_line` is the original fragment it came from (shown when a match looks wrong);
 * `series_expanded` marks books inferred from a series/author instruction rather than
 * named directly — always treated as low-confidence. See docs/bulk-import.md.
 */
export interface ParsedEntry {
  title: string
  author: string
  confidence: number
  source_line: string
  series_expanded: boolean
}

/** A parsed entry after resolution against Open Library. `book === null` means no match. */
export interface MatchedEntry {
  book: Book | null
  flagged: boolean
  sourceLine: string
}
