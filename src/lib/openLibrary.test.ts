import { describe, it, expect, vi, beforeEach } from 'vitest'
import { coverUrl, toBook, searchBooks, matchEntry, inAllowedLanguage, dedupeEditions, getWorkAuthorKeys, byAuthorIdentity } from './openLibrary'
import type { OpenLibrarySearchResult, ParsedEntry } from '../types'

describe('coverUrl', () => {
  it('builds M-size cover URL', () => {
    expect(coverUrl(12345)).toBe('https://covers.openlibrary.org/b/id/12345-M.jpg')
  })

  it('respects explicit size', () => {
    expect(coverUrl(99, 'L')).toBe('https://covers.openlibrary.org/b/id/99-L.jpg')
  })
})

describe('toBook', () => {
  const base: OpenLibrarySearchResult = {
    key: '/works/OL12345W',
    title: 'The Great Gatsby',
    author_name: ['F. Scott Fitzgerald'],
    cover_i: 8739161,
    first_publish_year: 1925,
    subject: ['Classic literature', 'American fiction'],
    isbn: ['9780743273565'],
  }

  it('strips /works/ prefix to form id', () => {
    expect(toBook(base).id).toBe('OL12345W')
  })

  it('picks the first author', () => {
    expect(toBook(base).author).toBe('F. Scott Fitzgerald')
  })

  it('returns null author when missing', () => {
    expect(toBook({ ...base, author_name: undefined }).author).toBeNull()
  })

  it('builds cover URL from cover_i', () => {
    expect(toBook(base).cover_url).toBe('https://covers.openlibrary.org/b/id/8739161-M.jpg')
  })

  it('returns null cover_url when no cover_i', () => {
    expect(toBook({ ...base, cover_i: undefined }).cover_url).toBeNull()
  })

  it('picks the first isbn', () => {
    expect(toBook(base).isbn).toBe('9780743273565')
  })

  it('truncates subjects to 10', () => {
    const subjects = Array.from({ length: 15 }, (_, i) => `Subject ${i}`)
    expect(toBook({ ...base, subject: subjects }).subjects).toHaveLength(10)
  })

  it('returns null subjects when missing', () => {
    expect(toBook({ ...base, subject: undefined }).subjects).toBeNull()
  })
})

describe('searchBooks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns empty array for blank query without fetching', async () => {
    const result = await searchBooks('   ')
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches from Open Library and returns docs', async () => {
    const mockDocs = [{ key: '/works/OL1W', title: 'Test Book' }]
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ docs: mockDocs }),
    } as Response)

    const result = await searchBooks('fitzgerald')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('openlibrary.org'),
    )
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('fitzgerald'),
    )
    expect(result).toEqual(mockDocs)
  })

  it('URL-encodes the query', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ docs: [] }),
    } as Response)

    await searchBooks('the great gatsby')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('the%20great%20gatsby'),
    )
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)
    await expect(searchBooks('gatsby')).rejects.toThrow('Search failed')
  })
})

describe('inAllowedLanguage', () => {
  const r = (language?: string[]): OpenLibrarySearchResult => ({
    key: '/works/OL1W', title: 'X', language,
  })

  it('keeps English and German works', () => {
    expect(inAllowedLanguage(r(['eng']))).toBe(true)
    expect(inAllowedLanguage(r(['ger']))).toBe(true)
    expect(inAllowedLanguage(r(['fre', 'eng']))).toBe(true)
  })

  it('drops works available only in other languages', () => {
    expect(inAllowedLanguage(r(['fre']))).toBe(false)
    expect(inAllowedLanguage(r(['spa', 'ita']))).toBe(false)
  })

  it('drops works with no language data — that is how foreign translations leak in', () => {
    // Open Library returns the Italian/Spanish editions of a book with language: null.
    expect(inAllowedLanguage(r(undefined))).toBe(false)
    expect(inAllowedLanguage(r([]))).toBe(false)
  })
})

describe('dedupeEditions', () => {
  const make = (
    key: string,
    title: string,
    opts: Partial<OpenLibrarySearchResult> = {},
  ): OpenLibrarySearchResult => ({
    key, title, author_name: ['Clayton Christensen'], ...opts,
  })

  it('collapses subtitle/punctuation variants of the same book', () => {
    const out = dedupeEditions([
      make('/works/A', 'How Will You Measure Your Life?', { edition_count: 30 }),
      make('/works/B', 'How Will You Measure Your Life'),
      make('/works/C', 'How Will You Measure Your Life: ...', { edition_count: 5 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].key).toBe('/works/A') // highest edition_count wins
  })

  it('keeps distinct books by the same author', () => {
    const out = dedupeEditions([
      make('/works/A', 'The Innovators Dilemma'),
      make('/works/B', 'How Will You Measure Your Life'),
    ])
    expect(out).toHaveLength(2)
  })

  it('preserves the original order of the kept results', () => {
    const out = dedupeEditions([
      make('/works/A', 'Book One'),
      make('/works/B', 'Book Two'),
      make('/works/C', 'Book One', { edition_count: 99 }),
    ])
    expect(out.map((r) => r.title)).toEqual(['Book Two', 'Book One'])
    expect(out.find((r) => r.title === 'Book One')?.key).toBe('/works/C')
  })

  it('breaks ties toward the edition that has a cover', () => {
    const out = dedupeEditions([
      make('/works/A', 'Same Title'),
      make('/works/B', 'Same Title', { cover_i: 123 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].key).toBe('/works/B')
  })
})

describe('getWorkAuthorKeys', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns bare author keys from a work record', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        authors: [
          { author: { key: '/authors/OL2976628A' } },
          { author: { key: '/authors/OL7231336A' } },
        ],
      }),
    } as Response)
    expect(await getWorkAuthorKeys('OL17078706W')).toEqual(['OL2976628A', 'OL7231336A'])
  })

  it('returns empty for a blank work id without fetching', async () => {
    expect(await getWorkAuthorKeys('  ')).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('tolerates a work record with no authors', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    expect(await getWorkAuthorKeys('OL1W')).toEqual([])
  })

  it('throws on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)
    await expect(getWorkAuthorKeys('OL1W')).rejects.toThrow('Work lookup failed')
  })
})

describe('byAuthorIdentity', () => {
  const make = (key: string, author_key?: string[]): OpenLibrarySearchResult => ({
    key, title: 'X', author_key,
  })

  it('keeps only works crediting an allowed author key', () => {
    const out = byAuthorIdentity(
      [
        make('/works/A', ['OL2976628A', 'OL7231336A']), // the real Thiel
        make('/works/B', ['OL999A']), // a different Peter Thiel
        make('/works/C', undefined), // no author key
      ],
      new Set(['OL2976628A']),
    )
    expect(out.map((r) => r.key)).toEqual(['/works/A'])
  })

  it('keeps everything when identity is unknown (empty key set)', () => {
    const results = [make('/works/A', ['OL999A']), make('/works/B', undefined)]
    expect(byAuthorIdentity(results, new Set())).toEqual(results)
  })
})

describe('matchEntry', () => {
  const entry: ParsedEntry = {
    title: 'Dune', author: 'Frank Herbert', confidence: 0.9,
    source_line: 'Dune', series_expanded: false,
  }

  function mockDocs(docs: unknown[]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ docs }),
    } as Response))
  }

  it('returns the top hit unflagged for a confident entry', async () => {
    mockDocs([{ key: '/works/OL1W', title: 'Dune', author_name: ['Frank Herbert'] }])
    const m = await matchEntry(entry)
    expect(m.book?.title).toBe('Dune')
    expect(m.flagged).toBe(false)
  })

  it('flags a low-confidence match but still keeps the book', async () => {
    mockDocs([{ key: '/works/OL1W', title: 'Maybe Dune' }])
    const m = await matchEntry({ ...entry, confidence: 0.3 })
    expect(m.book).not.toBeNull()
    expect(m.flagged).toBe(true)
  })

  it('flags a series-expanded entry even at high confidence', async () => {
    mockDocs([{ key: '/works/OL1W', title: 'A Closed and Common Orbit' }])
    const m = await matchEntry({ ...entry, series_expanded: true })
    expect(m.flagged).toBe(true)
  })

  it('returns a null book and flags when nothing matches', async () => {
    mockDocs([])
    const m = await matchEntry(entry)
    expect(m.book).toBeNull()
    expect(m.flagged).toBe(true)
    expect(m.sourceLine).toBe('Dune')
  })
})
