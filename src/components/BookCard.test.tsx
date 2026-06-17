import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('BookCard', () => {
  it('calls onRemove with the userBook id when the remove control is clicked', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<BookCard userBook={userBook} onRemove={onRemove} />)

    await user.click(screen.getByRole('button', { name: 'Remove The Overstory' }))
    expect(onRemove).toHaveBeenCalledWith('ub1')
  })

  it('keeps the remove control hidden until hover by default', () => {
    render(<BookCard userBook={userBook} onRemove={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Remove The Overstory' })).toHaveClass('opacity-0')
  })

  it('keeps the remove control always visible when removeAlwaysVisible is set', () => {
    render(<BookCard userBook={userBook} onRemove={vi.fn()} removeAlwaysVisible />)
    expect(screen.getByRole('button', { name: 'Remove The Overstory' })).toHaveClass('opacity-100')
  })

  it('renders no remove control when onRemove is not provided', () => {
    render(<BookCard userBook={userBook} />)
    expect(screen.queryByRole('button', { name: 'Remove The Overstory' })).not.toBeInTheDocument()
  })
})

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
