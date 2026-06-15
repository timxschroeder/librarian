import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const parseReadingList = vi.fn()
vi.mock('../lib/librarian', () => ({
  parseReadingList: (...args: unknown[]) => parseReadingList(...args),
}))

const matchEntry = vi.fn()
vi.mock('../lib/openLibrary', () => ({
  matchEntry: (...args: unknown[]) => matchEntry(...args),
}))

const bulkAddBooks = vi.fn()
vi.mock('../lib/db', () => ({
  bulkAddBooks: (...args: unknown[]) => bulkAddBooks(...args),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

import BulkImportModal from './BulkImportModal'

const book = { id: 'isbn:1', title: 'Dune' }

beforeEach(() => {
  parseReadingList.mockReset()
  matchEntry.mockReset()
  bulkAddBooks.mockReset()
})

describe('BulkImportModal', () => {
  it('parses, matches, persists, and hands the batch up on success', async () => {
    parseReadingList.mockResolvedValue([
      { title: 'Dune', author: 'Frank Herbert', confidence: 0.9, source_line: 'Dune', series_expanded: false },
      { title: 'Maybe', author: '', confidence: 0.2, source_line: 'that thing', series_expanded: false },
    ])
    matchEntry
      .mockResolvedValueOnce({ book, flagged: false, sourceLine: 'Dune' })
      .mockResolvedValueOnce({ book: null, flagged: true, sourceLine: 'that thing' })
    bulkAddBooks.mockResolvedValue({ added: [{ id: 'ub1', book_id: 'isbn:1', book }], skipped: 0 })

    const onImported = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<BulkImportModal onClose={onClose} onImported={onImported} />)

    await user.type(screen.getByRole('textbox'), 'Dune\nthat thing')
    await user.click(screen.getByRole('button', { name: 'Match books' }))

    await vi.waitFor(() => expect(onImported).toHaveBeenCalled())
    expect(bulkAddBooks).toHaveBeenCalledWith('u1', [book]) // only the matched book is persisted
    expect(onImported).toHaveBeenCalledWith({
      added: [{ id: 'ub1', book_id: 'isbn:1', book }],
      skipped: 0,
      unmatched: ['that thing'],
      flaggedBookIds: [],
    })
    expect(onClose).toHaveBeenCalled()
  }, 10000)

  it('surfaces an error and stays open when nothing matches', async () => {
    parseReadingList.mockResolvedValue([
      { title: 'X', author: '', confidence: 0.1, source_line: 'x', series_expanded: false },
    ])
    matchEntry.mockResolvedValue({ book: null, flagged: true, sourceLine: 'x' })

    const onImported = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<BulkImportModal onClose={onClose} onImported={onImported} />)

    await user.type(screen.getByRole('textbox'), 'x')
    await user.click(screen.getByRole('button', { name: 'Match books' }))

    expect(await screen.findByText(/Couldn't match any/)).toBeInTheDocument()
    expect(bulkAddBooks).not.toHaveBeenCalled()
    expect(onImported).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
