import { useState, useCallback } from 'react'
import { upsertBookAndUserBook } from '../lib/db'
import { searchBooks, toBook } from '../lib/openLibrary'
import { enrichBook } from '../lib/googleBooks'
import { useAuth } from '../contexts/AuthContext'
import type { OpenLibrarySearchResult } from '../types'

interface Props {
  onClose: () => void
  onAdded: () => void
}

export default function AddBookModal({ onClose, onAdded }: Props) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OpenLibrarySearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    try {
      const r = await searchBooks(query)
      setResults(r)
      if (r.length === 0) setError('No results. Try a different title or author.')
    } catch {
      setError('Search failed. Check your connection.')
    } finally {
      setSearching(false)
    }
  }, [query])

  async function addBook(result: OpenLibrarySearchResult) {
    if (!user) return
    setAdding(result.key)
    setError(null)
    try {
      const enriched = await enrichBook(toBook(result))
      await upsertBookAndUserBook(user.id, enriched, rating)
      onAdded()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Failed to add book. Try again.'
      setError(msg)
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <h2 className="font-display text-xl text-ink">Add a book</h2>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors p-1 -mr-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Title or author..."
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm font-body text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-forest-700"
              autoFocus
            />
            <button
              onClick={search}
              disabled={searching || !query.trim()}
              className="bg-forest-700 text-white px-4 py-2 rounded-lg text-sm font-body font-medium disabled:opacity-40 hover:bg-forest-900 transition-colors flex items-center justify-center min-w-[72px]"
            >
              {searching
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Search'}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-muted">Rating</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n === rating ? 0 : n)}
                  className={`text-lg leading-none transition-colors ${n <= rating ? 'text-amber-500' : 'text-border hover:text-amber-300'}`}
                >
                  ★
                </button>
              ))}
            </div>
            {rating > 0 && (
              <span className="text-xs text-muted">{rating}/5</span>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {searching && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-forest-700 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!searching && error && (
            <p className="text-muted text-sm text-center py-6">{error}</p>
          )}
          {!searching && !error && results.length === 0 && (
            <p className="text-muted text-sm text-center py-8">Search for a book above</p>
          )}
          {!searching && results.map((r) => (
            <button
              key={r.key}
              onClick={() => addBook(r)}
              disabled={adding === r.key}
              className="w-full flex items-center gap-3 p-4 border-b border-border/50 hover:bg-cream text-left transition-colors disabled:opacity-50"
            >
              {r.cover_i ? (
                <img
                  src={`https://covers.openlibrary.org/b/id/${r.cover_i}-S.jpg`}
                  alt={r.title}
                  className="w-10 h-14 object-cover rounded flex-shrink-0 shadow-sm"
                />
              ) : (
                <div className="w-10 h-14 bg-parchment rounded flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-body font-medium text-ink line-clamp-2">{r.title}</p>
                {r.author_name?.[0] && (
                  <p className="text-xs text-muted mt-0.5">{r.author_name[0]}</p>
                )}
                {r.first_publish_year && (
                  <p className="text-xs text-muted">{r.first_publish_year}</p>
                )}
              </div>
              {adding === r.key ? (
                <span className="text-xs text-forest-700 flex-shrink-0">Adding...</span>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-border flex-shrink-0">
                  <path d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
