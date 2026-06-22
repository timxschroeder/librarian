import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { getUserBooks, upsertBookAndUserBook, rejectBook } from '../lib/db'
import { computeDiscover } from '../lib/librarian'
import { shelfSignature } from '../lib/shelf'
import {
  searchBooksByAuthor,
  toBook,
  inAllowedLanguage,
  dedupeEditions,
  getWorkAuthorKeys,
  byAuthorIdentity,
} from '../lib/openLibrary'
import { useAuth } from '../contexts/AuthContext'
import Bertha from '../components/Bertha'
import type { Book, DiscoverBook, DiscoverSlate } from '../types'

const SPINE_COLORS = ['bg-forest-700', 'bg-burgundy-700', 'bg-forest-900']

function spineColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) & 0x7fffffff
  }
  return SPINE_COLORS[hash % SPINE_COLORS.length]
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// The slate only stores what a cover needs; fill the rest of the Book shape (null)
// when the user adds or dismisses a pick.
function toBookRecord(b: DiscoverBook): Book {
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    cover_url: b.cover_url,
    description: null,
    first_publish_year: b.first_publish_year,
    subjects: null,
    isbn: null,
    average_rating: null,
    ratings_count: null,
  }
}

export default function Discover() {
  const { user, profile, refreshProfile, scheduleTasteRefresh } = useAuth()
  const [slate, setSlate] = useState<DiscoverSlate | null>(null)
  // "More from authors you love" — mined client-side from Open Library, not the LLM.
  const [authorRow, setAuthorRow] = useState<DiscoverBook[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [shelfEmpty, setShelfEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The LLM slate couldn't be (re)computed. Soft failure: we still show the
  // client-side author row, so the page never goes blank because of it.
  const [computeFailed, setComputeFailed] = useState(false)
  const [shelfIds, setShelfIds] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [acting, setActing] = useState<string | null>(null)
  const ranRef = useRef(false)

  // Mine each loved author's other works from Open Library (the original Discover
  // behaviour), flattened into one row. Best-effort: failures just yield no row.
  const loadAuthorRow = useCallback(
    async (userBooks: Awaited<ReturnType<typeof getUserBooks>>, onShelf: Set<string>) => {
      const onShelfTitles = new Set(
        userBooks.map((ub) => `${ub.book.title.toLowerCase()}::${(ub.book.author ?? '').toLowerCase()}`),
      )
      const lovedBookByAuthor = new Map<string, string>()
      for (const ub of userBooks) {
        if (ub.rating != null && ub.rating >= 4 && ub.book.author && !lovedBookByAuthor.has(ub.book.author)) {
          lovedBookByAuthor.set(ub.book.author, ub.book.id)
        }
      }
      const topAuthors = Array.from(lovedBookByAuthor.keys()).slice(0, 3)
      if (topAuthors.length === 0) return

      const [results, identities] = await Promise.all([
        Promise.all(topAuthors.map((a) => searchBooksByAuthor(a, 20).catch(() => []))),
        Promise.all(topAuthors.map((a) => getWorkAuthorKeys(lovedBookByAuthor.get(a) ?? '').catch(() => []))),
      ])

      const row: DiscoverBook[] = []
      const seen = new Set<string>()
      for (let i = 0; i < topAuthors.length; i++) {
        const sameAuthor = byAuthorIdentity(results[i], new Set(identities[i]))
        const candidates = dedupeEditions(sameAuthor.filter(inAllowedLanguage))
        let taken = 0
        for (const r of candidates) {
          const workId = r.key.replace('/works/', '')
          const titleKey = `${r.title.toLowerCase()}::${(r.author_name?.[0] ?? '').toLowerCase()}`
          if (onShelf.has(workId) || onShelfTitles.has(titleKey) || seen.has(workId)) continue
          seen.add(workId)
          const b = toBook(r)
          row.push({
            id: b.id,
            title: b.title,
            author: b.author,
            cover_url: b.cover_url,
            first_publish_year: b.first_publish_year,
            reasoning: '',
          })
          if (++taken >= 3) break
        }
      }
      setAuthorRow(row)
    },
    [],
  )

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    setComputeFailed(false)
    try {
      const userBooks = await getUserBooks(user.id)
      const onShelf = new Set(userBooks.map((ub) => ub.book_id))
      setShelfIds(onShelf)

      // Nothing on the shelf yet — nothing to recommend from. Show the empty state
      // without burning a compute (or an edge-function round trip).
      if (userBooks.length === 0) {
        setShelfEmpty(true)
        setLoading(false)
        return
      }
      setShelfEmpty(false)

      const sig = shelfSignature(userBooks)
      const cached = profile?.discover_slate ?? null
      if (cached) setSlate(cached)

      // The author row is mined client-side from Open Library — it doesn't depend on
      // the LLM compute, so load it in parallel and clear the skeleton as soon as it
      // (or a cached slate) gives us something to render. This is what keeps Discover
      // from going blank when the slate compute is slow or fails.
      const authorDone = loadAuthorRow(userBooks, onShelf)
        .catch((e) => console.error('Discover author row failed', e))
        .finally(() => setLoading(false))

      // Cached slate is current — nothing to recompute.
      if (cached && cached.signature === sig) {
        setLoading(false)
        return
      }

      // Recompute the slate. Keep any cached slate + the author row on screen while
      // it runs; if it fails, fall back to the author row rather than blanking.
      if (cached) setRefreshing(true)
      try {
        const fresh = await computeDiscover()
        setSlate(fresh)
        await refreshProfile()
      } catch (e) {
        console.error('Discover compute failed', e)
        setComputeFailed(true)
        await authorDone
      } finally {
        setRefreshing(false)
        setLoading(false)
      }
    } catch (err) {
      console.error('Discover load failed', err)
      setError('Could not load suggestions. Please try again.')
      setLoading(false)
    }
  }, [user, profile, refreshProfile, loadAuthorRow])

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    load()
  }, [load])

  async function addBook(b: DiscoverBook) {
    if (!user || acting) return
    setActing(b.id)
    try {
      await upsertBookAndUserBook(user.id, toBookRecord(b), 0)
      scheduleTasteRefresh()
      setAdded((prev) => new Set(prev).add(b.id))
      setShelfIds((prev) => new Set(prev).add(b.id))
    } catch (err) {
      console.error('Failed to add book', err)
    } finally {
      setActing(null)
    }
  }

  async function dismissBook(b: DiscoverBook) {
    if (!user || acting) return
    setActing(b.id)
    try {
      await rejectBook(user.id, toBookRecord(b))
      setDismissed((prev) => new Set(prev).add(b.id))
    } catch (err) {
      console.error('Failed to dismiss book', err)
    } finally {
      setActing(null)
    }
  }

  // Row order matches the product spec: best picks → stretch → authors → seeds.
  const rows: { key: string; heading: ReactNode; books: DiscoverBook[]; caption: 'reason' | 'author' }[] = []
  if (slate) {
    rows.push({ key: 'best', heading: 'My best picks', books: slate.best_picks, caption: 'reason' })
    rows.push({ key: 'stretch', heading: 'Something to try', books: slate.stretch, caption: 'reason' })
  }
  rows.push({ key: 'authors', heading: 'More from authors you love', books: authorRow, caption: 'author' })
  if (slate) {
    for (const seed of slate.seeds) {
      rows.push({
        key: `seed:${seed.seed_title}`,
        heading: (
          <>
            Because you loved <span className="text-burgundy-700">{seed.seed_title}</span>
          </>
        ),
        books: seed.books,
        caption: 'reason',
      })
    }
  }
  const visibleRows = rows.filter((r) => r.books.some((b) => !dismissed.has(b.id)))

  const retry = () => {
    ranRef.current = false
    setLoading(true)
    load()
  }

  // ── States, in priority order ─────────────────────────────────────────────
  // Render rows whenever we have any (even mid-refresh, even if the slate compute
  // failed and only the author row survived). Only fall back to skeleton/empty/error
  // when there's genuinely nothing to show — so the page never blanks on a hiccup.

  // Genuinely empty shelf — nothing to recommend from yet.
  if (shelfEmpty) {
    return (
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Bertha expression="reading" size={96} className="mb-4" />
        <h1 className="font-display text-3xl text-ink mb-2">Discover</h1>
        <p className="text-muted text-sm leading-relaxed max-w-xs">
          Rate a few books on your shelf and I'll lay out picks tuned to your taste — your best bets, a few
          stretches, and books like the ones you've loved.
        </p>
      </div>
    )
  }

  // Still working and nothing to show yet.
  if (visibleRows.length === 0 && (loading || refreshing)) {
    return (
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4">
        <h1 className="font-display text-3xl text-ink mb-1">Discover</h1>
        <p className="text-muted text-sm mb-8">Picks from your taste</p>
        <div className="space-y-10">
          {[1, 2].map((g) => (
            <div key={g}>
              <div className="h-5 w-40 bg-parchment rounded animate-pulse mb-4" />
              <div className="flex gap-3 overflow-hidden">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-none w-28 sm:w-32 aspect-[2/3] bg-parchment rounded-md animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Settled with nothing to show — a real failure (data load or compute with no
  // author row to fall back on). Offer a retry rather than a misleading "rate more".
  if (visibleRows.length === 0) {
    return (
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Bertha expression="oops" size={84} className="mb-3" />
        <p className="font-display text-xl text-ink mb-2">Couldn't load your picks</p>
        <p className="text-muted text-sm mb-6">{error ?? 'Something got in the way. Give it another try.'}</p>
        <button
          onClick={retry}
          className="bg-forest-700 text-white px-5 py-2.5 rounded-full text-sm font-body font-medium hover:bg-forest-900 transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  // ── Main content ────────────────────────────────────────────────────────

  return (
    <div className="px-5 md:px-8 pt-8 md:pt-10 pb-8">
      <div className="flex items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink mb-1">Discover</h1>
          <p className="text-muted text-sm">Picks from your taste — refreshed as your shelf grows</p>
        </div>
        {refreshing ? (
          <span className="mt-1.5 inline-flex items-center gap-1.5 bg-parchment text-muted text-xs px-3 py-1.5 rounded-full whitespace-nowrap">
            <span className="w-3 h-3 border-2 border-muted border-t-transparent rounded-full animate-spin" />
            Finding fresh picks…
          </span>
        ) : computeFailed ? (
          <button
            onClick={retry}
            className="mt-1.5 inline-flex items-center gap-1.5 bg-parchment text-muted text-xs px-3 py-1.5 rounded-full whitespace-nowrap hover:text-ink transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" />
            </svg>
            Couldn't refresh picks — retry
          </button>
        ) : (
          slate && (
            <span className="mt-1.5 inline-flex items-center gap-1.5 bg-parchment text-muted text-xs px-3 py-1.5 rounded-full whitespace-nowrap">
              Updated {timeAgo(slate.updated_at)}
            </span>
          )
        )}
      </div>

      <div className="space-y-9">
        {visibleRows.map((row) => {
          const books = row.books.filter((b) => !dismissed.has(b.id))
          if (books.length === 0) return null
          return (
            <section key={row.key}>
              <h2 className="font-display text-lg text-ink mb-4 border-b border-border pb-2">{row.heading}</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 md:-mx-8 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {books.map((b) => {
                  const isAdded = added.has(b.id) || shelfIds.has(b.id)
                  const isActing = acting === b.id
                  return (
                    <div key={b.id} className="flex-none w-28 sm:w-32 flex flex-col gap-2 group">
                      <div className="relative w-full aspect-[2/3] rounded-md overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
                        {b.cover_url ? (
                          <img src={b.cover_url} alt={b.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className={`w-full h-full ${spineColor(b.title)} flex items-end p-2`}>
                            <span className="text-white text-xs font-display leading-tight line-clamp-4">{b.title}</span>
                          </div>
                        )}

                        {!isAdded && (
                          <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/30 transition-colors flex items-center justify-center gap-2.5 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={() => addBook(b)}
                              disabled={isActing}
                              aria-label={`Add ${b.title} to shelf`}
                              className="bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg"
                            >
                              {isActing ? (
                                <span className="w-4 h-4 border-2 border-forest-700 border-t-transparent rounded-full animate-spin block" />
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="#2C5F2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                  <path d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => dismissBook(b)}
                              disabled={isActing}
                              aria-label={`Dismiss ${b.title}`}
                              className="bg-white/90 rounded-full w-8 h-8 flex items-center justify-center shadow-lg"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="#7A7068" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                <path d="M6 6l12 12M18 6L6 18" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {isAdded && (
                          <div className="absolute inset-0 bg-ink/40 flex items-center justify-center">
                            <span className="bg-forest-700 text-white text-xs font-body font-medium px-2 py-1 rounded-full">On shelf</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-ink text-xs font-body font-medium leading-tight line-clamp-2">{b.title}</p>
                        <p className="text-muted text-xs mt-0.5 line-clamp-2">
                          {row.caption === 'author' ? b.author : b.reasoning}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
