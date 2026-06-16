import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BookCard from './BookCard'
import type { UserBook } from '../types'

const userBook: UserBook = {
  id: 'ub1',
  user_id: 'u1',
  book_id: 'isbn:1',
  rating: null,
  notes: null,
  read_at: '2026-01-01',
  created_at: '2026-01-01',
  book: {
    id: 'isbn:1', title: 'Dune', author: 'Frank Herbert', cover_url: null,
    description: null, first_publish_year: null, subjects: null, isbn: '1',
    average_rating: null, ratings_count: null,
  },
  profile: { id: 'u1', name: 'Tim' },
}

describe('BookCard', () => {
  it('calls onRemove with the userBook id when the remove control is clicked', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<BookCard userBook={userBook} onRemove={onRemove} />)

    await user.click(screen.getByRole('button', { name: 'Remove Dune' }))
    expect(onRemove).toHaveBeenCalledWith('ub1')
  })

  it('keeps the remove control hidden until hover by default', () => {
    render(<BookCard userBook={userBook} onRemove={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Remove Dune' })).toHaveClass('opacity-0')
  })

  it('keeps the remove control always visible when removeAlwaysVisible is set', () => {
    render(<BookCard userBook={userBook} onRemove={vi.fn()} removeAlwaysVisible />)
    expect(screen.getByRole('button', { name: 'Remove Dune' })).toHaveClass('opacity-100')
  })

  it('renders no remove control when onRemove is not provided', () => {
    render(<BookCard userBook={userBook} />)
    expect(screen.queryByRole('button', { name: 'Remove Dune' })).not.toBeInTheDocument()
  })
})
