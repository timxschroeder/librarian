import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enrichBook } from './googleBooks'
import type { Book } from '../types'

const baseBook: Book = {
  id: 'OL123W',
  title: 'The Remains of the Day',
  author: 'Kazuo Ishiguro',
  cover_url: null,
  description: null,
  first_publish_year: 1989,
  subjects: null,
  isbn: '9780679731726',
  average_rating: null,
  ratings_count: null,
}

function mockFetchSequence(responses: Array<{ ok: boolean; body: unknown }>) {
  const fetchMock = vi.fn()
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: r.ok,
      json: () => Promise.resolve(r.body),
      text: () => Promise.resolve(''),
    })
  }
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('enrichBook', () => {
  it('fills description + rating from Google Books', async () => {
    mockFetchSequence([
      { ok: true, body: { items: [{ volumeInfo: { description: 'A butler reflects.', averageRating: 4.2, ratingsCount: 1500 } }] } },
    ])
    const result = await enrichBook(baseBook)
    expect(result.description).toBe('A butler reflects.')
    expect(result.average_rating).toBe(4.2)
    expect(result.ratings_count).toBe(1500)
  })

  it('falls back to Open Library when Google Books has no description', async () => {
    mockFetchSequence([
      { ok: true, body: { items: [{ volumeInfo: { averageRating: 4.0 } }] } }, // GB: no description
      { ok: true, body: { description: 'From Open Library.' } }, // OL works fallback
    ])
    const result = await enrichBook(baseBook)
    expect(result.description).toBe('From Open Library.')
    expect(result.average_rating).toBe(4.0)
  })

  it('handles Open Library description object shape ({value})', async () => {
    mockFetchSequence([
      { ok: true, body: { items: [] } }, // GB: nothing
      { ok: true, body: { description: { value: 'Nested description.' } } },
    ])
    const result = await enrichBook(baseBook)
    expect(result.description).toBe('Nested description.')
  })

  it('never throws and leaves fields untouched when everything fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)
    const result = await enrichBook(baseBook)
    expect(result.description).toBeNull()
    expect(result.average_rating).toBeNull()
  })
})
