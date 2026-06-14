import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const upsertBookAndUserBook = vi.fn()
vi.mock('../lib/db', () => ({
  upsertBookAndUserBook: (...args: unknown[]) => upsertBookAndUserBook(...args),
}))

const searchBooks = vi.fn()
vi.mock('../lib/openLibrary', () => ({
  searchBooks: (...args: unknown[]) => searchBooks(...args),
  toBook: (r: { key: string; title: string }) => ({
    id: r.key, title: r.title, author: null, cover_url: null,
    description: null, first_publish_year: null, subjects: null, isbn: null,
  }),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

import AddBookModal from './AddBookModal'

const result = { key: '/works/1', title: 'Dune', author_name: ['Frank Herbert'] }

beforeEach(() => {
  upsertBookAndUserBook.mockReset()
  searchBooks.mockReset()
})

describe('AddBookModal', () => {
  it('renders search results', async () => {
    searchBooks.mockResolvedValue([result])
    const user = userEvent.setup()
    render(<AddBookModal onClose={vi.fn()} onAdded={vi.fn()} />)

    await user.type(screen.getByPlaceholderText(/Title or author/), 'dune')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('Dune')).toBeInTheDocument()
  })

  it('adds a book and closes on success', async () => {
    searchBooks.mockResolvedValue([result])
    upsertBookAndUserBook.mockResolvedValue(undefined)
    const onAdded = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddBookModal onClose={onClose} onAdded={onAdded} />)

    await user.type(screen.getByPlaceholderText(/Title or author/), 'dune')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(await screen.findByRole('button', { name: /Dune/ }))

    expect(upsertBookAndUserBook).toHaveBeenCalled()
    expect(onAdded).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('surfaces an error and does not close when the write fails', async () => {
    searchBooks.mockResolvedValue([result])
    upsertBookAndUserBook.mockRejectedValue(new Error('permission denied for table books'))
    const onAdded = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddBookModal onClose={onClose} onAdded={onAdded} />)

    await user.type(screen.getByPlaceholderText(/Title or author/), 'dune')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(await screen.findByRole('button', { name: /Dune/ }))

    expect(await screen.findByText(/permission denied for table books/)).toBeInTheDocument()
    expect(onAdded).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
