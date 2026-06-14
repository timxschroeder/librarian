import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { GENRES, CURATED_BOOKS, type CuratedBook } from '../data/onboardingBooks'

const SPINE_COLORS = ['bg-forest-700', 'bg-burgundy-700', 'bg-amber-800', 'bg-teal-800', 'bg-slate-700', 'bg-purple-900']

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
      src={`https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`}
      alt={book.title}
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set())
  const [selectedBooks, setSelectedBooks] = useState<Map<string, number>>(new Map())
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filteredGenres = useMemo(
    () => GENRES.filter(g => selectedGenres.has(g.key)),
    [selectedGenres]
  )

  const visibleBooks = useMemo(() => {
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

  function toggleGenre(key: string) {
    setSelectedGenres(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleBook(id: string) {
    setSelectedBooks(prev => {
      const next = new Map(prev)
      next.has(id) ? next.delete(id) : next.set(id, 0)
      return next
    })
  }

  function setRating(id: string, n: number) {
    setSelectedBooks(prev => {
      const next = new Map(prev)
      next.set(id, next.get(id) === n ? 0 : n)
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
    try {
      const today = new Date().toISOString().split('T')[0]
      const bookIds = [...selectedBooks.keys()]

      if (bookIds.length > 0) {
        const booksToInsert = bookIds.map(id => {
          const b = CURATED_BOOKS.find(x => x.id === id)!
          return {
            id: b.id,
            title: b.title,
            author: b.author,
            cover_url: `https://covers.openlibrary.org/b/isbn/${b.isbn}-M.jpg`,
            isbn: b.isbn,
            description: null as string | null,
            first_publish_year: null as number | null,
            subjects: null as string[] | null,
          }
        })
        await supabase.from('books').upsert(booksToInsert, { onConflict: 'id' })

        const userBooksToInsert = bookIds.map(id => ({
          user_id: user.id,
          book_id: id,
          rating: selectedBooks.get(id) || null,
          read_at: today,
        }))
        await supabase.from('user_books').upsert(userBooksToInsert, { onConflict: 'user_id,book_id' })
      }

      await supabase
        .from('profiles')
        .update({ genres: [...selectedGenres], onboarded_at: new Date().toISOString() })
        .eq('id', user.id)

      await refreshProfile()
    } catch (err) {
      console.error('Onboarding save failed', err)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-2 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="#2C5F2E" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
            <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <span className="font-display text-lg text-ink">Librarian</span>
        </div>
        <div className="flex gap-1.5 items-center">
          {[1, 2, 3].map(n => (
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
              <h1 className="font-display text-3xl text-ink mb-2">What do you love to read?</h1>
              <p className="text-muted text-sm">Pick your genres — these shape your recommendations</p>
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
              <h1 className="font-display text-3xl text-ink mb-2">Which of these have you read?</h1>
              <p className="text-muted text-sm">Tap to add — rate as you go</p>
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

            {/* Book grid — smaller cards */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mb-6">
              {visibleBooks.map(b => {
                const sel = selectedBooks.has(b.id)
                const rating = selectedBooks.get(b.id) ?? 0
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
                    {sel && (
                      <div className="flex gap-px px-0.5 mt-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            onClick={() => setRating(b.id, n)}
                            className={`text-[11px] leading-none transition-colors ${n <= rating ? 'text-amber-500' : 'text-border hover:text-amber-300'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className={`text-sm ${selectedBooks.size > 0 ? 'text-forest-700 font-medium' : 'text-muted'}`}>
                {selectedBooks.size > 0
                  ? `${selectedBooks.size} book${selectedBooks.size > 1 ? 's' : ''} added`
                  : "Tap books you've read"}
              </span>
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(3)} className="text-sm text-muted hover:text-ink transition-colors">
                  Skip
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 rounded-full bg-forest-700 text-white text-sm font-body font-semibold hover:bg-forest-900 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Complete ── */}
        {step === 3 && (
          <div className="flex flex-col items-center text-center pt-14">
            <div className="w-16 h-16 rounded-full bg-forest-700/10 flex items-center justify-center mb-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="#2C5F2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                <path d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="font-display text-3xl text-ink mb-2">Your shelf is ready</h1>
            <p className="text-muted text-sm mb-7">
              {selectedBooks.size > 0
                ? `${selectedBooks.size} book${selectedBooks.size > 1 ? 's' : ''} added · ${selectedGenres.size} genre${selectedGenres.size > 1 ? 's' : ''} selected`
                : `${selectedGenres.size} genre${selectedGenres.size > 1 ? 's' : ''} selected`}
            </p>

            <div className="flex flex-wrap gap-2 justify-center mb-10">
              {[...selectedGenres].map(key => {
                const g = GENRES.find(x => x.key === key)!
                return (
                  <span key={key} className="flex items-center gap-1.5 px-3 py-1 bg-forest-700/10 text-forest-700 text-xs font-body rounded-full border border-forest-700/20">
                    <span>{g.emoji}</span> {g.label}
                  </span>
                )
              })}
            </div>

            <button
              onClick={complete}
              disabled={saving}
              className="w-full max-w-xs py-3.5 rounded-full bg-forest-700 text-white text-sm font-body font-semibold hover:bg-forest-900 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : 'Go to my shelf'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
