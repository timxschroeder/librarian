import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { TasteAxes } from '../types'

const getUserBooks = vi.fn()
vi.mock('../lib/db', () => ({
  getUserBooks: (...args: unknown[]) => getUserBooks(...args),
}))

const recomputeTaste = vi.fn()
vi.mock('../lib/librarian', () => ({
  recomputeTaste: (...args: unknown[]) => recomputeTaste(...args),
}))

const refreshProfile = vi.fn()
let profile: { taste_summary: string | null; taste_axes: TasteAxes | null }
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profile, refreshProfile }),
}))

import Taste from './Taste'

const AXES: TasteAxes = {
  source_of_reward: { language: 0.35, story: 0.1, character: 0.25, ideas: 0.3 },
  weight: { value: 0.5, confidence: 0.8 },
  propulsion: { value: -0.4, confidence: 0.6 },
  darkness: { value: 0.3, confidence: 0.7 },
  tone: { value: 0, confidence: 0 }, // a gap
  signature: '2:9:0',
  updated_at: '2026-06-15T00:00:00.000Z',
}

const TWO_BOOKS = [{ rating: 5 }, { rating: 4 }]

beforeEach(() => {
  getUserBooks.mockReset()
  recomputeTaste.mockReset()
  refreshProfile.mockReset()
  // Default: server returns the same cached profile (no real change).
  recomputeTaste.mockResolvedValue({ taste_summary: 'You read for language and ideas.', taste_axes: AXES })
  profile = { taste_summary: 'You read for language and ideas.', taste_axes: AXES }
})

describe('Taste', () => {
  it('shows the "reading you in" empty state and does not recompute when the shelf is empty', async () => {
    profile = { taste_summary: null, taste_axes: null }
    getUserBooks.mockResolvedValue([])

    render(<Taste />)

    expect(await screen.findByText(/still reading you in/i)).toBeInTheDocument()
    expect(recomputeTaste).not.toHaveBeenCalled()
  })

  it('shows the cached profile instantly, then asks the server to recompute', async () => {
    getUserBooks.mockResolvedValue(TWO_BOOKS)

    render(<Taste />)

    // Cached portrait + axes are visible right away.
    expect(await screen.findByText('You read for language and ideas.')).toBeInTheDocument()
    expect(await screen.findByText(/Drawn from 2 books/)).toBeInTheDocument()
    expect(screen.getByText('35%')).toBeInTheDocument()
    expect(screen.getByText('demanding')).toBeInTheDocument()

    // The server is the staleness authority — we always trigger it (it no-ops cheaply).
    await waitFor(() => expect(recomputeTaste).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled())
  })

  it('replaces the cached axes with the freshly computed ones', async () => {
    getUserBooks.mockResolvedValue([{ rating: 5 }, { rating: 4 }, { rating: 5 }])
    const fresh: TasteAxes = { ...AXES, signature: '3:14:0', tone: { value: 0.6, confidence: 0.7 } }
    recomputeTaste.mockResolvedValue({ taste_summary: 'Sharper read of you.', taste_axes: fresh })

    render(<Taste />)

    // tone starts as a gap ("?"), then fills in once the recompute lands.
    await waitFor(() => expect(recomputeTaste).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByLabelText(/not enough signal yet/i)).not.toBeInTheDocument())
  })
})
