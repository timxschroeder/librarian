import type { Book } from '../types'

const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1/volumes'
const OL_BASE = 'https://openlibrary.org'

interface GoogleBooksVolumeInfo {
  description?: string
  averageRating?: number
  ratingsCount?: number
}

interface GoogleBooksVolume {
  volumeInfo?: GoogleBooksVolumeInfo
}

interface GoogleBooksResponse {
  items?: GoogleBooksVolume[]
}

/** Fetch description and rating from Google Books. Returns null on any failure. */
async function fetchGoogleBooks(
  isbn: string | null,
  title: string,
  author: string | null,
): Promise<{ description: string | null; average_rating: number | null; ratings_count: number | null } | null> {
  try {
    const q = isbn
      ? `isbn:${encodeURIComponent(isbn)}`
      : `intitle:${encodeURIComponent(title)}${author ? `+inauthor:${encodeURIComponent(author)}` : ''}`
    const res = await fetch(`${GOOGLE_BOOKS_BASE}?q=${q}&maxResults=1`)
    if (!res.ok) return null
    const data: GoogleBooksResponse = await res.json()
    const info = data.items?.[0]?.volumeInfo
    if (!info) return null
    return {
      description: info.description ?? null,
      average_rating: info.averageRating ?? null,
      ratings_count: info.ratingsCount ?? null,
    }
  } catch {
    return null
  }
}

/** Fetch description from Open Library works endpoint. Returns null on any failure. */
async function fetchOLDescription(olWorkId: string): Promise<string | null> {
  try {
    // olWorkId is the bare id like "OL45883W" (without the /works/ prefix)
    const res = await fetch(`${OL_BASE}/works/${olWorkId}.json`)
    if (!res.ok) return null
    const data: { description?: string | { value: string } } = await res.json()
    if (!data.description) return null
    if (typeof data.description === 'string') return data.description
    return data.description.value ?? null
  } catch {
    return null
  }
}

/**
 * Best-effort enrichment: fills in `description`, `average_rating`, and
 * `ratings_count` on the book. Never throws — a network failure leaves the
 * original fields untouched so the caller can still persist the book.
 *
 * Strategy:
 *   1. Google Books (primary) — description + rating
 *   2. Open Library works endpoint (fallback) — description only, if Google
 *      Books returned none
 */
export async function enrichBook(book: Book): Promise<Book> {
  const gb = await fetchGoogleBooks(book.isbn, book.title, book.author)

  let description = gb?.description ?? null
  const average_rating = gb?.average_rating ?? null
  const ratings_count = gb?.ratings_count ?? null

  // Fall back to OL works endpoint for description if Google Books had none
  if (!description) {
    description = await fetchOLDescription(book.id)
  }

  return {
    ...book,
    description: description ?? book.description,
    average_rating: average_rating ?? book.average_rating,
    ratings_count: ratings_count ?? book.ratings_count,
  }
}
