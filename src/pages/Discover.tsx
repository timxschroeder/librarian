import { useState, useEffect, useCallback } from 'react'
import { getUserBooks, upsertBookAndUserBook } from '../lib/db'
import { searchBooksByAuthor, toBook } from '../lib/openLibrary'
import { useAuth } from '../contexts/AuthContext'
import type { Book, OpenLibrarySearchResult } from '../types'

interface AuthorGroup {
  author: string
  books: OpenLibrarySearchResult[]
}

const SPINE_COLORS = ['bg-forest-700', 'bg-burgundy-700', 'bg-forest-900']

function spineColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) & 0x7fffffff
  }
  return SPINE_COLORS[hash % SPINE_COLORS.length]
}

export default function Discover() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<AuthorGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Track which OL work keys are already on the user's shelf
  const [shelfIds, setShelfIds] = useState<Set<string>>(new Set())
  // Track which cards were just added (to show confirmation)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const userBooks = await getUserBooks(user.id)

      // Build a set of book IDs already on the shelf for filtering
      const onShelf = new Set(userBooks.map((ub) => ub.book_id))
      setShelfIds(onShelf)

      // Also index by title+author for fuzzy de-dup (OL IDs can differ)
      const onShelfTitles = new Set(
        userBooks.map((ub) => `${ub.book.title.toLowerCase()}::${(ub.book.author ?? '').toLowerCase()}`),
      )

      // Loved authors: rated >= 4, deduplicated, author must be non-null
      const lovedAuthors = Array.from(
        new Set(
          userBooks
            .filter((ub) => ub.rating != null && ub.rating >= 4 && ub.book.author)
            .map((ub) => ub.book.author as string),
        ),
      )

      if (lovedAuthors.length === 0) {
        setGroups([])
        setLoading(false)
        return
      }

      // Fetch OL results per author in parallel (cap to 5 loved authors to keep it fast)
      const topAuthors = lovedAuthors.slice(0, 5)
      const results = await Promise.all(
        topAuthors.map((author) => searchBooksByAuthor(author, 20).catch(() => [] as OpenLibrarySearchResult[])),
      )

      const newGroups: AuthorGroup[] = []
      for (let i = 0; i < topAuthors.length; i++) {
        const author = topAuthors[i]
        const filtered = results[i].filter((r) => {
          const workId = r.key.replace('/works/', '')
          if (onShelf.has(workId)) return false
          const key = `${r.title.toLowerCase()}::${(r.author_name?.[0] ?? '').toLowerCase()}`
          if (onShelfTitles.has(key)) return false
          return true
        })
        // Show up to 6 suggestions per author
        if (filtered.length > 0) {
          newGroups.push({ author, books: filtered.slice(0, 6) })
        }
      }

      setGroups(newGroups)
    } catch (err) {
      console.error('Discover load failed', err)
      setError('Could not load suggestions. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  async function addBook(result: OpenLibrarySearchResult) {
    if (!user || adding) return
    const key = result.key
    setAdding(key)
    try {
      const book: Book = toBook(result)
      // Add with no rating — user can rate later
      await upsertBookAndUserBook(user.id, book, 0)
      setAdded((prev) => new Set(prev).add(key))
      setShelfIds((prev) => new Set(prev).add(book.id))
    } catch (err) {
      console.error('Failed to add book', err)
    } finally {
      setAdding(null)
    }
  }

  // ── Empty states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4">
        <h1 className="font-display text-3xl text-ink mb-1">Discover</h1>
        <p className="text-muted text-sm mb-8">Books by authors you love</p>
        <div className="space-y-10">
          {[1, 2].map((g) => (
            <div key={g}>
              <div className="h-5 w-40 bg-parchment rounded animate-pulse mb-4" />
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] bg-parchment rounded-md animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-5xl mb-4">⚠️</p>
        <p className="font-display text-xl text-ink mb-2">Something went wrong</p>
        <p className="text-muted text-sm mb-6">{error}</p>
        <button
          onClick={load}
          className="bg-forest-700 text-white px-5 py-2.5 rounded-full text-sm font-body font-medium hover:bg-forest-900 transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-forest-700/10 flex items-center justify-center mb-5">
          <svg viewBox="0 0 24 24" fill="none" stroke="#2C5F2E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
        </div>
        <h1 className="font-display text-3xl text-ink mb-2">Discover</h1>
        <p className="text-muted text-sm leading-relaxed max-w-xs">
          Rate books 4 stars or higher on your shelf and we'll suggest more from those authors.
        </p>
      </div>
    )
  }

  // ── Main content ──────────────────────────────────────────────────────────

  return (
    <div className="px-5 md:px-8 pt-8 md:pt-10 pb-8">
      <h1 className="font-display text-3xl text-ink mb-1">Discover</h1>
      <p className="text-muted text-sm mb-8">Books by authors you love</p>

      <div className="space-y-10">
        {groups.map(({ author, books }) => (
          <section key={author}>
            <h2 className="font-display text-lg text-ink mb-4 border-b border-border pb-2">{author}</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {books.map((r) => {
                const workId = r.key.replace('/works/', '')
                const isAdded = added.has(r.key) || shelfIds.has(workId)
                const isAdding = adding === r.key
                return (
                  <div key={r.key} className="flex flex-col gap-2 group">
                    {/* Cover */}
                    <div className="relative w-full aspect-[2/3] rounded-md overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
                      {r.cover_i ? (
                        <img
                          src={`https://covers.openlibrary.org/b/id/${r.cover_i}-M.jpg`}
                          alt={r.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className={`w-full h-full ${spineColor(r.title)} flex items-end p-2`}>
                          <span className="text-white text-xs font-display leading-tight line-clamp-4">
                            {r.title}
                          </span>
                        </div>
                      )}

                      {/* Add overlay button */}
                      {!isAdded && (
                        <button
                          onClick={() => addBook(r)}
                          disabled={isAdding}
                          aria-label={`Add ${r.title} to shelf`}
                          className="absolute inset-0 bg-ink/0 group-hover:bg-ink/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                        >
                          <span className="bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                            {isAdding ? (
                              <span className="w-4 h-4 border-2 border-forest-700 border-t-transparent rounded-full animate-spin block" />
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="#2C5F2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                <path d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                            )}
                          </span>
                        </button>
                      )}

                      {/* Added badge */}
                      {isAdded && (
                        <div className="absolute inset-0 bg-ink/40 flex items-center justify-center">
                          <span className="bg-forest-700 text-white text-xs font-body font-medium px-2 py-1 rounded-full">
                            On shelf
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div>
                      <p className="text-ink text-xs font-body font-medium leading-tight line-clamp-2">{r.title}</p>
                      {r.first_publish_year && (
                        <p className="text-muted text-xs mt-0.5">{r.first_publish_year}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
