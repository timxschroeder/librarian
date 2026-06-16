import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserBook, Profile } from '../types'

const getUserBooks = vi.fn()
const updateUserBookRating = vi.fn()
const deleteUserBook = vi.fn()
vi.mock('../lib/db', () => ({
  getUserBooks: (...args: unknown[]) => getUserBooks(...args),
  updateUserBookRating: (...args: unknown[]) => updateUserBookRating(...args),
  deleteUserBook: (...args: unknown[]) => deleteUserBook(...args),
}))

// Shelf renders BulkImportModal, which pulls in lib/librarian → lib/supabase
// (real client construction needs env vars not present under Vitest).
vi.mock('../lib/librarian', () => ({
  parseReadingList: vi.fn(),
}))

// A stable reference — the real AuthContext only changes `user` identity on
// actual auth events, not on every render. A fresh object per call here would
// retrigger `fetchBooks`'s effect (keyed on `user`) on every state update.
const mockUser = { id: 'u1' }
let profile: Partial<Profile> | null
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, profile }),
}))

import Shelf from './Shelf'

function makeBook(id: string): UserBook {
  return {
    id, user_id: 'u1', book_id: `isbn:${id}`, rating: null, notes: null,
    read_at: '2026-01-01', created_at: '2026-01-01',
    book: {
      id: `isbn:${id}`, title: `Book ${id}`, author: null, cover_url: null,
      description: null, first_publish_year: null, subjects: null, isbn: id,
      average_rating: null, ratings_count: null,
    },
    profile: { id: 'u1', name: 'Tim' },
  }
}

beforeEach(() => {
  getUserBooks.mockReset()
  updateUserBookRating.mockReset()
  deleteUserBook.mockReset().mockResolvedValue(undefined)
  profile = { name: 'Tim', reading_goal: null }
  localStorage.clear()
})

describe('Shelf — remove control', () => {
  it('removes a book on the regular shelf (not just during batch review)', async () => {
    getUserBooks.mockResolvedValue([makeBook('1')])
    const user = userEvent.setup()
    render(<Shelf />)

    const removeBtn = await screen.findByRole('button', { name: 'Remove Book 1' })
    await user.click(removeBtn)

    expect(deleteUserBook).toHaveBeenCalledWith('1')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Book 1' })).not.toBeInTheDocument())
  })
})

describe('Shelf — reading goal', () => {
  it('shows no progress bar when no goal is set', async () => {
    getUserBooks.mockResolvedValue([makeBook('1')])
    render(<Shelf />)

    await screen.findByRole('button', { name: 'Remove Book 1' })
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText('1 book read')).toBeInTheDocument()
  })

  it('shows a progress bar toward the goal', async () => {
    profile = { name: 'Tim', reading_goal: 4 }
    getUserBooks.mockResolvedValue([makeBook('1'), makeBook('2')])
    render(<Shelf />)

    expect(await screen.findByText('2 of 4 books read this year')).toBeInTheDocument()
  })

  it('celebrates once the goal is reached and remembers it across remounts', async () => {
    profile = { name: 'Tim', reading_goal: 1 }
    getUserBooks.mockResolvedValue([makeBook('1')])
    const user = userEvent.setup()
    const { unmount } = render(<Shelf />)

    expect(await screen.findByRole('dialog', { name: 'Reading goal reached' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yay!' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()

    render(<Shelf />)
    await screen.findByText('Goal reached — 1 of 1 books read 🎉')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
