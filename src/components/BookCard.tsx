import type { UserBook } from '../types'

interface Props {
  userBook: UserBook
  compact?: boolean
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

export default function BookCard({ userBook }: Props) {
  const { book, rating } = userBook

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
      </div>
      <div>
        <p className="text-ink text-xs font-body font-medium leading-tight line-clamp-2">{book.title}</p>
        {book.author && (
          <p className="text-muted text-xs mt-0.5 line-clamp-1">{book.author}</p>
        )}
        {rating != null && (
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={`text-xs ${n <= rating ? 'text-amber-500' : 'text-border'}`}>★</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
