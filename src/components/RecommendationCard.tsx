import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Recommendation } from '../types'

interface Props {
  rec: Recommendation
  onUpdate: () => void
}

export default function RecommendationCard({ rec, onUpdate }: Props) {
  const [acting, setActing] = useState(false)

  async function respond(status: 'accepted' | 'rejected') {
    setActing(true)
    if (status === 'accepted') {
      await supabase.from('books').upsert(rec.book, { onConflict: 'id' })
      await supabase.from('user_books').upsert(
        {
          user_id: rec.user_id,
          book_id: rec.book_id,
          read_at: new Date().toISOString().split('T')[0],
        },
        { onConflict: 'user_id,book_id' }
      )
    }
    await supabase
      .from('recommendations')
      .update({ status })
      .eq('id', rec.id)
    onUpdate()
    setActing(false)
  }

  const { book } = rec

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
      <div className="flex gap-4 p-5">
        <div className="flex-shrink-0">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="w-[72px] h-[100px] object-cover rounded-lg shadow-sm"
            />
          ) : (
            <div className="w-[72px] h-[100px] bg-parchment rounded-lg" />
          )}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <h3 className="font-display text-lg text-ink leading-tight">{book.title}</h3>
          {book.author && (
            <p className="text-muted text-sm mt-1">{book.author}</p>
          )}
          {book.first_publish_year && (
            <p className="text-muted text-xs mt-0.5">{book.first_publish_year}</p>
          )}
        </div>
      </div>

      {rec.reasoning && (
        <div className="px-5 pb-4">
          <p className="text-sm text-muted leading-relaxed border-l-2 border-parchment pl-3 italic">
            {rec.reasoning}
          </p>
        </div>
      )}

      <div className="flex border-t border-border">
        <button
          onClick={() => respond('rejected')}
          disabled={acting}
          className="flex-1 py-3.5 text-sm font-body font-medium text-muted hover:text-burgundy-700 hover:bg-burgundy-100/40 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
          Not for me
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={() => respond('accepted')}
          disabled={acting}
          className="flex-1 py-3.5 text-sm font-body font-medium text-forest-700 hover:bg-forest-50 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Add to shelf
        </button>
      </div>
    </div>
  )
}
