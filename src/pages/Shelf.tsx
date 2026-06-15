import { useState, useEffect, useCallback } from 'react'
import { getUserBooks, updateUserBookRating, deleteUserBook } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import BookCard from '../components/BookCard'
import AddBookModal from '../components/AddBookModal'
import BulkImportModal, { type ImportResult } from '../components/BulkImportModal'
import Bertha from '../components/Bertha'
import type { UserBook } from '../types'

export default function Shelf() {
  const { user, profile } = useAuth()
  const [userBooks, setUserBooks] = useState<UserBook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  // The transient "just added" review batch — ephemeral client state, not persisted.
  const [batch, setBatch] = useState<ImportResult | null>(null)

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

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

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
            <p className="text-xs text-muted mb-4">{userBooks.length} {userBooks.length === 1 ? 'book' : 'books'} read</p>
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
                  onRemove={inBatch ? handleRemove : undefined}
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
    </div>
  )
}
