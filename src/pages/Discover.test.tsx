import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DiscoverSlate } from '../types'

const getUserBooks = vi.fn()
const upsertBookAndUserBook = vi.fn()
const rejectBook = vi.fn()
vi.mock('../lib/db', () => ({
  getUserBooks: (...a: unknown[]) => getUserBooks(...a),
  upsertBookAndUserBook: (...a: unknown[]) => upsertBookAndUserBook(...a),
  rejectBook: (...a: unknown[]) => rejectBook(...a),
}))

const computeDiscover = vi.fn()
vi.mock('../lib/librarian', () => ({
  computeDiscover: (...a: unknown[]) => computeDiscover(...a),
}))

// Keep the client-side "More from authors you love" row empty — not under test here.
vi.mock('../lib/openLibrary', () => ({
  searchBooksByAuthor: vi.fn(() => Promise.resolve([])),
  getWorkAuthorKeys: vi.fn(() => Promise.resolve([])),
  byAuthorIdentity: () => [],
  dedupeEditions: () => [],
  inAllowedLanguage: () => false,
  toBook: (r: unknown) => r,
}))

vi.mock('../components/Bertha', () => ({ default: () => null }))

let profile: { discover_slate: DiscoverSlate | null } | null
const refreshProfile = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profile, refreshProfile }),
}))

import Discover from './Discover'

function dbook(id: string, title: string, reasoning = `why ${title}`) {
  // A non-null cover means the title renders once (in the meta), not also in the
  // no-cover fallback spine — keeps getByText unambiguous.
  return { id, title, author: `Author ${title}`, cover_url: `https://covers/${id}.jpg`, first_publish_year: 2000, reasoning }
}

// Two books rating 5 + 4 → shelfSignature "2:9".
const shelf = [
  { book_id: 'b1', rating: 5, book: { id: 'b1', title: 'Piranesi', author: 'Susanna Clarke' } },
  { book_id: 'b2', rating: 4, book: { id: 'b2', title: 'The Overstory', author: 'Richard Powers' } },
]

const slate: DiscoverSlate = {
  signature: '2:9',
  updated_at: new Date().toISOString(),
  best_picks: [dbook('p1', 'Stoner'), dbook('p2', 'Gilead')],
  stretch: [dbook('s1', 'Pale Fire')],
  seeds: [{ seed_title: 'Piranesi', books: [dbook('x1', 'Annihilation')] }],
}

beforeEach(() => {
  getUserBooks.mockReset().mockResolvedValue(shelf)
  upsertBookAndUserBook.mockReset().mockResolvedValue(undefined)
  rejectBook.mockReset().mockResolvedValue(undefined)
  computeDiscover.mockReset()
  refreshProfile.mockReset()
  profile = { discover_slate: slate }
})

describe('Discover', () => {
  it('renders the cached slate rows without recomputing when the shelf is unchanged', async () => {
    render(<Discover />)

    expect(await screen.findByText('My best picks')).toBeInTheDocument()
    expect(screen.getByText('Something to try')).toBeInTheDocument()
    expect(screen.getByText('Stoner')).toBeInTheDocument()
    expect(screen.getByText('Annihilation')).toBeInTheDocument()
    // Seed row heading carries the seed title.
    expect(screen.getByText('Piranesi')).toBeInTheDocument()

    await waitFor(() => expect(computeDiscover).not.toHaveBeenCalled())
  })

  it('recomputes when the cached slate is stale', async () => {
    profile = { discover_slate: { ...slate, signature: '0:0' } }
    computeDiscover.mockResolvedValue(slate)
    render(<Discover />)

    await waitFor(() => expect(computeDiscover).toHaveBeenCalled())
    expect(await screen.findByText('Stoner')).toBeInTheDocument()
  })

  it('computes from scratch when there is no cached slate', async () => {
    profile = { discover_slate: null }
    computeDiscover.mockResolvedValue(slate)
    render(<Discover />)

    await waitFor(() => expect(computeDiscover).toHaveBeenCalled())
    expect(await screen.findByText('My best picks')).toBeInTheDocument()
  })

  it('shows the empty state only when the shelf is truly empty', async () => {
    getUserBooks.mockResolvedValue([])
    profile = { discover_slate: null }
    render(<Discover />)

    expect(await screen.findByText(/Rate a few books on your shelf/)).toBeInTheDocument()
    await waitFor(() => expect(computeDiscover).not.toHaveBeenCalled())
  })

  it('compute failure with books shows a retry, not the empty state', async () => {
    profile = { discover_slate: null }
    computeDiscover.mockRejectedValue(new Error('boom'))
    render(<Discover />)

    expect(await screen.findByText(/Couldn't load your picks/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    // Must NOT misleadingly tell a reader with a full shelf to rate more books.
    expect(screen.queryByText(/Rate a few books on your shelf/)).not.toBeInTheDocument()
  })

  it('dismisses a pick: calls rejectBook and removes the card', async () => {
    const user = userEvent.setup()
    render(<Discover />)

    const card = (await screen.findByText('Gilead')).closest('div.group') as HTMLElement
    await user.click(within(card).getByRole('button', { name: /Dismiss Gilead/ }))

    await waitFor(() => expect(rejectBook).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 'p2' })))
    await waitFor(() => expect(screen.queryByText('Gilead')).not.toBeInTheDocument())
  })

  it('adds a pick: calls upsertBookAndUserBook and shows the on-shelf badge', async () => {
    const user = userEvent.setup()
    render(<Discover />)

    const card = (await screen.findByText('Stoner')).closest('div.group') as HTMLElement
    await user.click(within(card).getByRole('button', { name: /Add Stoner to shelf/ }))

    await waitFor(() => expect(upsertBookAndUserBook).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 'p1' }), 0))
    expect(within(card).getByText('On shelf')).toBeInTheDocument()
  })
})
