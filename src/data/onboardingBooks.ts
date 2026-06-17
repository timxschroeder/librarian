export const GENRES = [
  { key: 'literary',   label: 'Literary Fiction',    emoji: '📖' },
  { key: 'romance',    label: 'Love & Romance',      emoji: '💕' },
  { key: 'mystery',    label: 'Mystery & Thriller',  emoji: '🔍' },
  { key: 'scifi',      label: 'Science Fiction',     emoji: '🚀' },
  { key: 'fantasy',    label: 'Fantasy',             emoji: '🐉' },
  { key: 'historical', label: 'Historical Fiction',  emoji: '🏰' },
  { key: 'horror',     label: 'Horror',              emoji: '👻' },
  { key: 'classics',   label: 'Classics',            emoji: '🏛️' },
  { key: 'biography',  label: 'Biography & Memoir',  emoji: '👤' },
  { key: 'history',    label: 'History',             emoji: '⏳' },
  { key: 'science',    label: 'Science & Nature',    emoji: '🌿' },
  { key: 'philosophy', label: 'Philosophy',          emoji: '💭' },
  { key: 'essays',     label: 'Essays',              emoji: '✍️' },
  { key: 'poetry',     label: 'Poetry',              emoji: '🪶' },
  { key: 'selfhelp',   label: 'Self-Help',           emoji: '💚' },
  { key: 'humor',      label: 'Humor',               emoji: '😄' },
  { key: 'business',   label: 'Business & Economics', emoji: '💼' },
  { key: 'tech',       label: 'Technology',          emoji: '💻' },
  { key: 'religion',   label: 'Religion & Spirituality', emoji: '🕊️' },
]

export interface CuratedBook {
  id: string        // Open Library work key, e.g. "OL21177W"
  title: string
  author: string
  coverId: number   // Open Library cover id -> covers.openlibrary.org/b/id/{coverId}
  genres: string[]
}

export { CURATED_BOOKS } from './curatedBooks.generated'
