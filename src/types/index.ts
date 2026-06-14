export interface Profile {
  id: string
  name: string
  email: string
  taste_summary: string | null
  created_at: string
}

export interface Book {
  id: string
  title: string
  author: string | null
  cover_url: string | null
  description: string | null
  first_publish_year: number | null
  subjects: string[] | null
  isbn: string | null
}

export interface UserBook {
  id: string
  user_id: string
  book_id: string
  rating: number | null
  notes: string | null
  read_at: string
  created_at: string
  book: Book
  profile: Pick<Profile, 'id' | 'name'>
}

export interface Recommendation {
  id: string
  user_id: string
  book_id: string
  reasoning: string
  prompt: string | null
  status: 'pending' | 'accepted' | 'rejected'
  feedback: string | null
  created_at: string
  book: Book
}

export interface OpenLibrarySearchResult {
  key: string
  title: string
  author_name?: string[]
  cover_i?: number
  first_publish_year?: number
  subject?: string[]
  isbn?: string[]
}
