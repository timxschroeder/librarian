import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BookCard from './BookCard'
import type { UserBook } from '../types'

const userBook: UserBook = {
  id: 'ub1',
  user_id: 'u1',
  book_id: 'b1',
  rating: null,
  notes: null,
  read_at: '2026-01-01',
  created_at: '2026-01-01',
  book: {
    id: 'b1',
    title: 'The Overstory',
    author: 'Richard Powers',
    cover_url: null,
    description: null,
    first_publish_year: null,
    subjects: null,
    isbn: null,
    average_rating: null,
    ratings_count: null,
  },
  profile: { id: 'u1', name: 'Tim' },
}

describe('BookCard — Send to Kindle', () => {
  it('shows no Kindle action when onSendToKindle is absent', () => {
    render(<BookCard userBook={userBook} />)
    expect(screen.queryByLabelText(/to Kindle/i)).toBeNull()
  })

  it('fires onSendToKindle with the book id when idle and clicked', () => {
    const onSend = vi.fn()
    render(<BookCard userBook={userBook} onSendToKindle={onSend} kindleStatus={null} />)
    fireEvent.click(screen.getByLabelText('Send The Overstory to Kindle'))
    expect(onSend).toHaveBeenCalledWith('b1')
  })

  it('shows a static "Queued" (no retry/click) while pending', () => {
    const onSend = vi.fn()
    render(<BookCard userBook={userBook} onSendToKindle={onSend} kindleStatus="pending" />)
    expect(screen.getByText('Queued')).toBeTruthy()
    expect(screen.queryByLabelText(/Send .* to Kindle/)).toBeNull()
  })

  it('shows "On your Kindle" when sent', () => {
    render(<BookCard userBook={userBook} onSendToKindle={vi.fn()} kindleStatus="sent" />)
    expect(screen.getByText('On your Kindle')).toBeTruthy()
  })

  it('offers a retry that re-fires onSendToKindle when failed', () => {
    const onSend = vi.fn()
    render(<BookCard userBook={userBook} onSendToKindle={onSend} kindleStatus="failed" />)
    fireEvent.click(screen.getByLabelText('Retry sending The Overstory to Kindle'))
    expect(onSend).toHaveBeenCalledWith('b1')
  })

  it('treats no_source like failed (retryable)', () => {
    const onSend = vi.fn()
    render(<BookCard userBook={userBook} onSendToKindle={onSend} kindleStatus="no_source" />)
    fireEvent.click(screen.getByLabelText('Retry sending The Overstory to Kindle'))
    expect(onSend).toHaveBeenCalledWith('b1')
  })
})
