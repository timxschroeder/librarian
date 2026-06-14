import type { Book, OpenLibrarySearchResult } from '../types'

const BASE = 'https://openlibrary.org'

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
  }
}
