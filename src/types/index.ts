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
  genres: string[]
  onboarded_at: string | null
  created_at: string
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

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface OpenLibrarySearchResult {
  key: string
  title: string
  author_name?: string[]
  cover_i?: number
  first_publish_year?: number
  subject?: string[]
  isbn?: string[]
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
