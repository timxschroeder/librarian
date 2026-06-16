import { useState } from 'react'
import type { KindleStatus, UserBook } from '../types'

interface Props {
  userBook: UserBook
  onRate?: (userBookId: string, rating: number | null) => void
  /** Mark a freshly-imported best-guess match for review (amber flag). */
  flagged?: boolean
  /** When set, show a quick remove control — used during "just added" import review. */
  onRemove?: (userBookId: string) => void
  /** Current Send-to-Kindle status for this book, if a request exists. */
  kindleStatus?: KindleStatus | null
  /** When set, show the Send-to-Kindle action on the cover; called with the book id. */
  onSendToKindle?: (bookId: string) => void
}

const SPINE_COLORS = [
  'bg-forest-700',
  'bg-burgundy-700',
  'bg-amber-800',
  'bg-teal-800',
  'bg-slate-700',
  'bg-purple-900',
]

function spineColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) & 0x7fffffff
  }
  return SPINE_COLORS[hash % SPINE_COLORS.length]
}

export default function BookCard({ userBook, onRate, flagged, onRemove, kindleStatus, onSendToKindle }: Props) {
  const { book, rating } = userBook
  const [hovered, setHovered] = useState<number | null>(null)

  function handleStarClick(n: number) {
    if (!onRate) return
    // clicking the current rating clears it
    onRate(userBook.id, n === rating ? null : n)
  }

  const displayRating = hovered ?? rating

  return (
    <div className="flex flex-col gap-2 group">
      <div className="relative w-full aspect-[2/3] rounded-md overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={`w-full h-full ${spineColor(book.title)} flex items-end p-2`}>
            <span className="text-white text-xs font-display leading-tight line-clamp-4">
              {book.title}
            </span>
          </div>
        )}
        {flagged && (
          <span
            className="absolute top-1 left-1 flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 shadow-sm"
            title="Best guess — check this one is right"
            aria-label="Best guess — check this match"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </span>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(userBook.id)}
            aria-label={`Remove ${book.title}`}
            className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-white/90 text-burgundy-700 shadow-sm hover:bg-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {onSendToKindle && (
          <div className="absolute inset-x-0 bottom-0">
            {kindleStatus == null ? (
              <button
                type="button"
                onClick={() => onSendToKindle(book.id)}
                aria-label={`Send ${book.title} to Kindle`}
                className="w-full bg-ink/60 text-white text-[11px] font-body font-medium py-1.5 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <line x1="10" y1="18.5" x2="14" y2="18.5" />
                </svg>
                Add to Kindle
              </button>
            ) : kindleStatus === 'pending' ? (
              <div className="w-full bg-ink/65 text-white/90 text-[11px] font-body py-1.5 flex items-center justify-center gap-1.5" title="Queued — waiting for the delivery worker">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                Queued
              </div>
            ) : kindleStatus === 'fetching' ? (
              <div className="w-full bg-ink/65 text-white text-[11px] font-body py-1.5 flex items-center justify-center gap-1.5" title="Sending to your Kindle">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                Sending…
              </div>
            ) : kindleStatus === 'sent' ? (
              <div className="w-full bg-forest-700/90 text-white text-[11px] font-body font-medium py-1.5 flex items-center justify-center gap-1.5" title="Delivered to your Kindle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                On your Kindle
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onSendToKindle(book.id)}
                aria-label={`Retry sending ${book.title} to Kindle`}
                title="Couldn't find this book — tap to try again"
                className="w-full bg-amber-800/90 text-white text-[11px] font-body font-medium py-1.5 flex items-center justify-center gap-1.5 hover:bg-amber-800 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M10.3 3.86 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Couldn't find it · Retry
              </button>
            )}
          </div>
        )}
      </div>
      <div>
        <p className="text-ink text-xs font-body font-medium leading-tight line-clamp-2">{book.title}</p>
        {book.author && (
          <p className="text-muted text-xs mt-0.5 line-clamp-1">{book.author}</p>
        )}
        {onRate ? (
          <div className="flex gap-0.5 mt-1" onMouseLeave={() => setHovered(null)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Rate ${n} star${n !== 1 ? 's' : ''}`}
                onClick={() => handleStarClick(n)}
                onMouseEnter={() => setHovered(n)}
                className={`text-xs leading-none transition-colors ${
                  displayRating != null && n <= displayRating ? 'text-amber-500' : 'text-border'
                } hover:text-amber-400 cursor-pointer`}
              >
                ★
              </button>
            ))}
          </div>
        ) : (
          rating != null && (
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`text-xs ${n <= rating ? 'text-amber-500' : 'text-border'}`}>★</span>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
