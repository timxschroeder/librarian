import type { Book, MatchedEntry, OpenLibrarySearchResult, ParsedEntry } from '../types'

const BASE = 'https://openlibrary.org'

/**
 * Below this parse-confidence a match is flagged for review rather than trusted.
 * One knob — tune against real pastes. See docs/bulk-import.md.
 */
export const MATCH_CONFIDENCE_THRESHOLD = 0.6

export function coverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
}

export async function searchBooks(query: string): Promise<OpenLibrarySearchResult[]> {
  if (!query.trim()) return []
  const url = `${BASE}/search.json?q=${encodeURIComponent(query)}&limit=10&fields=key,title,author_name,cover_i,first_publish_year,subject,isbn`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Search failed')
  const data = await res.json()
  return data.docs as OpenLibrarySearchResult[]
}

export async function searchBooksByAuthor(
  authorName: string,
  limit = 20,
): Promise<OpenLibrarySearchResult[]> {
  if (!authorName.trim()) return []
  const url = `${BASE}/search.json?author=${encodeURIComponent(authorName)}&limit=${limit}&fields=key,title,author_name,author_key,cover_i,first_publish_year,subject,isbn,language,edition_count`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Author search failed for "${authorName}"`)
  const data = await res.json()
  return (data.docs ?? []) as OpenLibrarySearchResult[]
}

/**
 * Resolve a work to its author Open Library identity keys (bare, e.g. "OL2976628A").
 * Searching by author NAME conflates different people who share a name; the work the
 * reader actually loved names its author unambiguously, so we filter Discover by this.
 */
export async function getWorkAuthorKeys(workId: string): Promise<string[]> {
  if (!workId.trim()) return []
  const res = await fetch(`${BASE}/works/${workId}.json`)
  if (!res.ok) throw new Error(`Work lookup failed for "${workId}"`)
  const data = await res.json()
  const authors = (data.authors ?? []) as { author?: { key?: string } }[]
  return authors
    .map((a) => a.author?.key?.replace('/authors/', ''))
    .filter((k): k is string => Boolean(k))
}

/**
 * Keep only works crediting one of the given author identity keys. An empty key set
 * means the loved work didn't resolve to an identity — fall back to keeping everything
 * rather than blanking the feed.
 */
export function byAuthorIdentity(
  results: OpenLibrarySearchResult[],
  authorKeys: Set<string>,
): OpenLibrarySearchResult[] {
  if (authorKeys.size === 0) return results
  return results.filter((r) => (r.author_key ?? []).some((k) => authorKeys.has(k)))
}

/**
 * MARC language codes we surface on Discover. This is a private two-reader app —
 * English and German — so foreign-language editions are noise, not discovery.
 */
const ALLOWED_LANGUAGES = new Set(['eng', 'ger'])

/**
 * Keep only works explicitly tagged with an English or German edition. Foreign
 * translations on Open Library (the Italian/Spanish/Turkish editions of a book)
 * routinely come back with NO language data, so an "allow when unknown" rule lets
 * exactly the noise we want to drop slip through. The canonical English/German
 * works we actually want are well-catalogued and carry the tag — so requiring it
 * costs us little and keeps the feed clean.
 */
export function inAllowedLanguage(result: OpenLibrarySearchResult): boolean {
  if (!result.language || result.language.length === 0) return false
  return result.language.some((code) => ALLOWED_LANGUAGES.has(code))
}

/** Collapse a title to its comparable core: lowercase, drop subtitle + punctuation. */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .split(/[:–—]| - /)[0] // drop subtitle after a colon or spaced dash
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Higher = the edition readers more likely mean: most-published, then has a cover. */
function editionScore(r: OpenLibrarySearchResult): number {
  return (r.edition_count ?? 0) * 10 + (r.cover_i ? 1 : 0)
}

/**
 * Open Library returns the same book as several "works" — reissues, regional
 * editions, translations, the odd study guide. Collapse results that share a
 * normalized title + author down to the single most-published one, preserving
 * the original ordering of the kept results.
 */
export function dedupeEditions(results: OpenLibrarySearchResult[]): OpenLibrarySearchResult[] {
  const keyFor = (r: OpenLibrarySearchResult) =>
    `${normalizeTitle(r.title)}::${(r.author_name?.[0] ?? '').toLowerCase()}`
  const best = new Map<string, OpenLibrarySearchResult>()
  for (const r of results) {
    const key = keyFor(r)
    const current = best.get(key)
    if (!current || editionScore(r) > editionScore(current)) best.set(key, r)
  }
  return results.filter((r) => best.get(keyFor(r)) === r)
}

/**
 * Resolve one parsed entry to a real book via Open Library, taking the top hit.
 * Flags the match (for review) when the parse was uncertain, the entry came from a
 * series expansion, or no book was found at all. Deliberately skips `enrichBook` —
 * bulk import trades the extra Google Books call for speed; covers from OL are enough.
 */
export async function matchEntry(entry: ParsedEntry): Promise<MatchedEntry> {
  const query = [entry.title, entry.author].filter(Boolean).join(' ').trim()
  const results = query ? await searchBooks(query) : []
  const top = results[0]
  if (!top) {
    return { book: null, flagged: true, sourceLine: entry.source_line }
  }
  const flagged = entry.series_expanded || entry.confidence < MATCH_CONFIDENCE_THRESHOLD
  return { book: toBook(top), flagged, sourceLine: entry.source_line }
}

export function toBook(result: OpenLibrarySearchResult): Book {
  const id = result.key.replace('/works/', '')
  return {
    id,
    title: result.title,
    author: result.author_name?.[0] ?? null,
    cover_url: result.cover_i ? coverUrl(result.cover_i, 'M') : null,
    description: null,
    first_publish_year: result.first_publish_year ?? null,
    subjects: result.subject?.slice(0, 10) ?? null,
    isbn: result.isbn?.[0] ?? null,
    average_rating: null,
    ratings_count: null,
  }
}
