import { useState, useEffect, useCallback } from 'react'
import { getUserBooks, updateUserBookRating, deleteUserBook, getKindleRequests, createKindleRequest } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import BookCard from '../components/BookCard'
import AddBookModal from '../components/AddBookModal'
import BulkImportModal, { type ImportResult } from '../components/BulkImportModal'
import Bertha from '../components/Bertha'
import GoalProgress from '../components/GoalProgress'
import GoalCelebration from '../components/GoalCelebration'
import type { KindleStatus, UserBook } from '../types'

function goalCelebratedKey(userId: string): string {
  return `librarian:goal-celebrated:${userId}`
}

export default function Shelf() {
  const { user, profile } = useAuth()
  const [userBooks, setUserBooks] = useState<UserBook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  // The transient "just added" review batch — ephemeral client state, not persisted.
  const [batch, setBatch] = useState<ImportResult | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  // Send-to-Kindle status per book_id, mirrored from kindle_requests.
  const [requests, setRequests] = useState<Map<string, KindleStatus>>(new Map())
  const [kindleNotice, setKindleNotice] = useState<string | null>(null)

  const fetchBooks = useCallback(async () => {
    if (!user) return
    setError(null)
    try {
      setUserBooks(await getUserBooks(user.id))
    } catch (err) {
      console.error('Failed to load shelf', err)
      setError('Could not load your shelf. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [user])

  const fetchRequests = useCallback(async () => {
    if (!user) return
    try {
      const rows = await getKindleRequests(user.id)
      setRequests(new Map(rows.map((r) => [r.book_id, r.status])))
    } catch (err) {
      // Non-fatal: the shelf still works, the Kindle badges just won't show.
      console.error('Failed to load Kindle requests', err)
    }
  }, [user])

  useEffect(() => {
    fetchBooks()
    fetchRequests()
  }, [fetchBooks, fetchRequests])

  // A queued/sending request advances on the worker's schedule, not ours, so refetch
  // when the tab regains focus and poll gently while anything is still in flight.
  useEffect(() => {
    const active = [...requests.values()].some((s) => s === 'pending' || s === 'fetching')
    const onFocus = () => fetchRequests()
    window.addEventListener('focus', onFocus)
    const id = active ? window.setInterval(fetchRequests, 15000) : undefined
    return () => {
      window.removeEventListener('focus', onFocus)
      if (id) window.clearInterval(id)
    }
  }, [requests, fetchRequests])

  async function handleSendToKindle(bookId: string) {
    if (!user) return
    if (!profile?.kindle_email) {
      setKindleNotice('Add your Kindle email in Settings before sending books.')
      return
    }
    setKindleNotice(null)
    const prev = requests
    setRequests((m) => new Map(m).set(bookId, 'pending'))
    try {
      await createKindleRequest(user.id, bookId)
    } catch (err) {
      console.error('Failed to queue Kindle delivery', err)
      setRequests(prev)
      setKindleNotice((err as { message?: string })?.message ?? 'Could not send to Kindle. Try again.')
    }
  }

  // Celebrate once per goal value reached, not on every shelf visit — remembered
  // per-user in localStorage so re-reaching the same goal after a page reload
  // doesn't replay the animation.
  useEffect(() => {
    if (!user || !profile?.reading_goal) return
    const goal = profile.reading_goal
    if (userBooks.length < goal) return
    if (localStorage.getItem(goalCelebratedKey(user.id)) === String(goal)) return
    setShowCelebration(true)
  }, [user, profile?.reading_goal, userBooks.length])

  function dismissCelebration() {
    if (user && profile?.reading_goal) {
      localStorage.setItem(goalCelebratedKey(user.id), String(profile.reading_goal))
    }
    setShowCelebration(false)
  }

  async function handleRate(userBookId: string, rating: number | null) {
    setUserBooks((prev) =>
      prev.map((ub) => (ub.id === userBookId ? { ...ub, rating } : ub)),
    )
    try {
      await updateUserBookRating(userBookId, rating)
    } catch (err) {
      console.error('Failed to update rating', err)
      fetchBooks()
    }
  }

  async function handleRemove(userBookId: string) {
    const prev = userBooks
    setUserBooks((p) => p.filter((ub) => ub.id !== userBookId))
    try {
      await deleteUserBook(userBookId)
    } catch (err) {
      console.error('Failed to remove book', err)
      setUserBooks(prev)
    }
  }

  function handleImported(result: ImportResult) {
    setBatch(result)
    fetchBooks()
  }

  const batchUbIds = new Set(batch?.added.map((a) => a.id))
  const flaggedBookIds = new Set(batch?.flaggedBookIds)
  const flaggedCount = batch
    ? batch.added.filter((a) => flaggedBookIds.has(a.book_id)).length
    : 0

  return (
    <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-ink leading-tight">My Shelf</h1>
          {profile && (
            <p className="text-muted text-sm mt-0.5">{profile.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 border border-forest-700 text-forest-700 px-4 py-2 rounded-full text-sm font-body font-medium hover:bg-forest-700/5 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M9 17V5h11M4 9h11v12H4z" />
            </svg>
            Import a list
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-forest-700 text-white px-4 py-2 rounded-full text-sm font-body font-medium hover:bg-forest-900 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-parchment rounded-md animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <div className="flex justify-center mb-3">
            <Bertha expression="oops" size={84} />
          </div>
          <p className="font-display text-xl text-ink mb-2">Something went wrong</p>
          <p className="text-muted text-sm mb-6">{error}</p>
          <button
            onClick={fetchBooks}
            className="bg-forest-700 text-white px-5 py-2.5 rounded-full text-sm font-body font-medium hover:bg-forest-900 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : userBooks.length === 0 ? (
        <div className="text-center py-20">
          <div className="flex justify-center mb-3">
            <Bertha expression="happy" size={96} />
          </div>
          <p className="font-display text-xl text-ink mb-2">Your shelf is empty</p>
          <p className="text-muted text-sm mb-6">Add a book you loved and I'll start to know your taste.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-forest-700 text-white px-5 py-2.5 rounded-full text-sm font-body font-medium hover:bg-forest-900 transition-colors"
          >
            Add your first book
          </button>
        </div>
      ) : (
        <>
          {profile?.reading_goal ? (
            <GoalProgress count={userBooks.length} goal={profile.reading_goal} />
          ) : null}
          {kindleNotice && (
            <div className="mb-4 rounded-xl border border-amber-800/30 bg-amber-100/50 px-4 py-3 flex items-start gap-3 text-sm">
              <span className="flex-1 text-amber-900">{kindleNotice}</span>
              <button
                onClick={() => setKindleNotice(null)}
                className="text-amber-800 font-medium hover:opacity-70 transition-opacity flex-shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
          {batch ? (
            <div className="mb-5 rounded-xl border border-forest-700/20 bg-forest-700/5 p-4 flex items-start gap-3">
              <Bertha expression="delighted" size={36} className="flex-shrink-0 -mt-1" />
              <div className="flex-1 text-sm">
                <p className="text-ink">
                  <span className="font-medium">
                    Added {batch.added.length} {batch.added.length === 1 ? 'book' : 'books'} to your shelf.
                  </span>
                  {batch.skipped > 0 && ` ${batch.skipped} already there, skipped.`}
                </p>
                {(flaggedCount > 0 || batch.unmatched.length > 0) && (
                  <p className="text-muted mt-1">
                    {flaggedCount > 0 &&
                      `${flaggedCount} ${flaggedCount === 1 ? 'was a' : 'were'} best ${flaggedCount === 1 ? 'guess' : 'guesses'} — flagged below; tap ✕ to remove. `}
                    {batch.unmatched.length > 0 && `Couldn't find: ${batch.unmatched.join(', ')}.`}
                  </p>
                )}
              </div>
              <button
                onClick={() => setBatch(null)}
                className="text-forest-700 text-sm font-medium hover:text-forest-900 transition-colors flex-shrink-0"
              >
                Done
              </button>
            </div>
          ) : (
            !profile?.reading_goal && (
              <p className="text-xs text-muted mb-4">{userBooks.length} {userBooks.length === 1 ? 'book' : 'books'} read</p>
            )
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {userBooks.map((ub) => {
              const inBatch = batch != null && batchUbIds.has(ub.id)
              return (
                <BookCard
                  key={ub.id}
                  userBook={ub}
                  onRate={handleRate}
                  flagged={inBatch && flaggedBookIds.has(ub.book_id)}
                  onRemove={handleRemove}
                  removeAlwaysVisible={inBatch}
                  onSendToKindle={handleSendToKindle}
                  kindleStatus={requests.get(ub.book_id) ?? null}
                />
              )
            })}
          </div>
        </>
      )}

      {showAdd && (
        <AddBookModal onClose={() => setShowAdd(false)} onAdded={fetchBooks} />
      )}
      {showImport && (
        <BulkImportModal onClose={() => setShowImport(false)} onImported={handleImported} />
      )}
      {showCelebration && profile?.reading_goal && (
        <GoalCelebration goal={profile.reading_goal} onDismiss={dismissCelebration} />
      )}
    </div>
  )
}
