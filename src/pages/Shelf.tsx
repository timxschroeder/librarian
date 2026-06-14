import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import BookCard from '../components/BookCard'
import AddBookModal from '../components/AddBookModal'
import type { UserBook } from '../types'

export default function Shelf() {
  const { user, profile } = useAuth()
  const [userBooks, setUserBooks] = useState<UserBook[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const fetchBooks = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_books')
      .select('*, book:books(*), profile:profiles(id, name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setUserBooks((data as UserBook[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  return (
    <div className="px-5 pt-8 pb-4">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-ink leading-tight">My Shelf</h1>
          {profile && (
            <p className="text-muted text-sm mt-0.5">{profile.name}</p>
          )}
        </div>
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

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-parchment rounded-md animate-pulse" />
          ))}
        </div>
      ) : userBooks.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">📚</p>
          <p className="font-display text-xl text-ink mb-2">Your shelf is empty</p>
          <p className="text-muted text-sm mb-6">Start adding books you've read.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-forest-700 text-white px-5 py-2.5 rounded-full text-sm font-body font-medium hover:bg-forest-900 transition-colors"
          >
            Add your first book
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted mb-4">{userBooks.length} {userBooks.length === 1 ? 'book' : 'books'} read</p>
          <div className="grid grid-cols-3 gap-4">
            {userBooks.map((ub) => (
              <BookCard key={ub.id} userBook={ub} />
            ))}
          </div>
        </>
      )}

      {showAdd && (
        <AddBookModal onClose={() => setShowAdd(false)} onAdded={fetchBooks} />
      )}
    </div>
  )
}
