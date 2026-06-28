import { useState, useMemo, useEffect } from 'react'
import { completeOnboarding, type OnboardingBook } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import { GENRES, CURATED_BOOKS, type CuratedBook } from '../data/onboardingBooks'
import { coverUrl } from '../lib/openLibrary'
import { logEvent } from '../lib/events'
import Bertha from '../components/Bertha'

// Books shown before the first "Show more" tap, and revealed per tap after.
// Pools are 32/genre, so two even pages of 16.
const PAGE_SIZE = 16

const SPINE_COLORS = ['bg-forest-700', 'bg-burgundy-700', 'bg-forest-900']

function spineColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) & 0x7fffffff
  return SPINE_COLORS[hash % SPINE_COLORS.length]
}

function BookCover({ book }: { book: CuratedBook }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className={`w-full h-full ${spineColor(book.title)} flex items-end p-1.5`}>
        <span className="text-white text-[8px] font-display leading-tight line-clamp-4">{book.title}</span>
      </div>
    )
  }
  return (
    <img
      src={coverUrl(book.coverId, 'M')}
      alt={book.title}
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}

export default function Onboarding() {
  const { user, refreshProfile, scheduleTasteRefresh } = useAuth()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set())
  const [selectedBooks, setSelectedBooks] = useState<Map<string, number>>(new Map())
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Fire `onboarding_started` once on mount. Abandonment is intentionally NOT a separate
  // event: React effect cleanup doesn't run on tab-close/navigation (the common way to
  // bail, and exactly the case we care about), and sendBeacon can't carry Supabase's
  // auth headers. Instead, abandonment is derived in queries as started-without-
  // completed — see scripts/analytics.sh funnel and migration 012.
  useEffect(() => {
    logEvent('onboarding_started')
  }, [])

  const filteredGenres = useMemo(
    () => GENRES.filter(g => selectedGenres.has(g.key)),
    [selectedGenres]
  )

  // Every book in scope for the current filter, most-read first (data is pre-sorted).
  const matchingBooks = useMemo(() => {
    const seen = new Set<string>()
    const out: CuratedBook[] = []
    for (const b of CURATED_BOOKS) {
      if (seen.has(b.id)) continue
      const inScope = b.genres.some(g => selectedGenres.has(g))
      const matchFilter = activeFilter ? b.genres.includes(activeFilter) : inScope
      if (matchFilter) { seen.add(b.id); out.push(b) }
    }
    return out
  }, [selectedGenres, activeFilter])

  // Reset paging whenever the filter changes so each tab starts from the top.
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [activeFilter])

  const visibleBooks = matchingBooks.slice(0, visibleCount)
  const remaining = matchingBooks.length - visibleBooks.length

  function toggleGenre(key: string) {
    // Record every genre tap so a "X got selected without me choosing it" report is
    // answerable from the log: who tapped what, when, and to which state. Logged here
    // (not inside the updater) so StrictMode's double-invoke can't duplicate the event.
    const selected = !selectedGenres.has(key)
    logEvent('onboarding_genre_toggled', { key, selected })
    setSelectedGenres(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleBook(id: string) {
    setSelectedBooks(prev => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, 0)
      return next
    })
  }

  function goToBooks() {
    setActiveFilter(null)
    setStep(2)
  }

  async function complete() {
    if (!user) return
    setSaving(true)
    setSaveError(null)
    try {
      const books: OnboardingBook[] = [...selectedBooks.keys()].map(id => {
        const b = CURATED_BOOKS.find(x => x.id === id)!
        return {
          book: {
            id: b.id,
            title: b.title,
            author: b.author,
            cover_url: coverUrl(b.coverId, 'M'),
            isbn: null,
            description: null,
            first_publish_year: null,
            subjects: null,
            average_rating: null,
            ratings_count: null,
          },
          rating: 5,
        }
      })

      await completeOnboarding(user.id, [...selectedGenres], books)
      // Record the final selection — the close of the onboarding funnel.
      logEvent('onboarding_completed', {
        genres: [...selectedGenres],
        book_count: books.length,
      })
      // Seed the taste profile (portrait + axes) from the books just added.
      scheduleTasteRefresh()
      await refreshProfile()
    } catch (err) {
      console.error('Onboarding save failed', err)
      const msg = (err as { message?: string })?.message ?? 'Save failed — please try again.'
      setSaveError(msg)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-2 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <Bertha expression="happy" size={26} className="flex-shrink-0" />
          <span className="font-display text-lg text-ink">Librarian</span>
        </div>
        <div className="flex gap-1.5 items-center">
          {[1, 2].map(n => (
            <div
              key={n}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                n === step ? 'w-6 bg-forest-700' : n < step ? 'w-3 bg-forest-700/40' : 'w-3 bg-border'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="px-5 pb-10 max-w-2xl mx-auto">

        {/* ── Step 1: Genres ── */}
        {step === 1 && (
          <div className="pt-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <Bertha expression="happy" size={76} />
              </div>
              <h1 className="font-display text-3xl text-ink mb-2">What do you love to read?</h1>
              <p className="text-muted text-sm">Pick your genres — I'll use them to shape what I suggest</p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
              {GENRES.map(g => (
                <button
                  key={g.key}
                  onClick={() => toggleGenre(g.key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border font-body transition-all ${
                    selectedGenres.has(g.key)
                      ? 'border-forest-700 bg-forest-700/10 text-forest-700 font-medium'
                      : 'border-border bg-white text-muted hover:border-forest-700/40 hover:text-ink'
                  }`}
                >
                  <span className="text-2xl leading-none">{g.emoji}</span>
                  <span className="text-xs text-center leading-tight">{g.label}</span>
                </button>
              ))}
            </div>

            <p className={`text-xs text-center mb-5 ${selectedGenres.size > 0 ? 'text-forest-700' : 'text-muted'}`}>
              {selectedGenres.size > 0
                ? `${selectedGenres.size} genre${selectedGenres.size > 1 ? 's' : ''} selected`
                : 'Select at least one to continue'}
            </p>

            <button
              onClick={goToBooks}
              disabled={selectedGenres.size === 0}
              className="w-full py-3.5 rounded-full bg-forest-700 text-white text-sm font-body font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-forest-900 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Step 2: Books ── */}
        {step === 2 && (
          <div className="pt-6">
            <div className="text-center mb-6">
              <h1 className="font-display text-3xl text-ink mb-2">Pick books you've loved</h1>
              <p className="text-muted text-sm">
                {selectedBooks.size > 0
                  ? `${selectedBooks.size} book${selectedBooks.size !== 1 ? 's' : ''} selected`
                  : 'Tap a cover to add it'}
              </p>
            </div>

            {/* Genre filter tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-5 [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => setActiveFilter(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-body border transition-all ${
                  activeFilter === null
                    ? 'bg-forest-700 text-white border-forest-700'
                    : 'bg-white text-muted border-border hover:border-forest-700/40'
                }`}
              >
                All
              </button>
              {filteredGenres.map(g => (
                <button
                  key={g.key}
                  onClick={() => setActiveFilter(g.key)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-body border transition-all ${
                    activeFilter === g.key
                      ? 'bg-forest-700 text-white border-forest-700'
                      : 'bg-white text-muted border-border hover:border-forest-700/40'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Book grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mb-6">
              {visibleBooks.map(b => {
                const sel = selectedBooks.has(b.id)
                return (
                  <div key={b.id} className="flex flex-col gap-1">
                    <button
                      onClick={() => toggleBook(b.id)}
                      className={`relative w-full aspect-[2/3] rounded-md overflow-hidden transition-all ${
                        sel
                          ? 'ring-2 ring-forest-700 ring-offset-1 ring-offset-cream'
                          : 'hover:opacity-90 active:scale-95'
                      }`}
                    >
                      <BookCover book={b} />
                      {sel && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-forest-700 rounded-full flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                            <path d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                      )}
                    </button>
                    <p className="text-[10px] font-body font-medium text-ink leading-tight line-clamp-2 px-0.5">{b.title}</p>
                    <p className="text-[9px] text-muted leading-none px-0.5">{b.author}</p>
                  </div>
                )
              })}
            </div>

            {remaining > 0 && (
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="w-full mb-6 py-2.5 rounded-full bg-parchment border border-border text-forest-700 text-xs font-body font-medium hover:border-forest-700/40 transition-colors"
              >
                Show {Math.min(PAGE_SIZE, remaining)} more
                <span className="text-muted font-normal"> · {visibleBooks.length} of {matchingBooks.length}</span>
              </button>
            )}

            <div className="flex items-center justify-between">
              <button onClick={complete} className="text-sm text-muted hover:text-ink transition-colors" disabled={saving}>
                Skip
              </button>
              <button
                onClick={complete}
                disabled={saving}
                className="px-6 py-2.5 rounded-full bg-forest-700 text-white text-sm font-body font-semibold hover:bg-forest-900 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </>
                ) : 'Get started'}
              </button>
            </div>
            {saveError && (
              <p className="mt-3 text-sm text-red-600 text-center">{saveError}</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
