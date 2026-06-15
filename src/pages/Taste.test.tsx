import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { TasteAxes } from '../types'

const getUserBooks = vi.fn()
vi.mock('../lib/db', () => ({
  getUserBooks: (...args: unknown[]) => getUserBooks(...args),
}))

const recomputeTasteProfile = vi.fn()
vi.mock('../lib/librarian', () => ({
  recomputeTasteProfile: (...args: unknown[]) => recomputeTasteProfile(...args),
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
  signature: '2:9',
  updated_at: '2026-06-15T00:00:00.000Z',
}

const TWO_BOOKS = [{ rating: 5 }, { rating: 4 }] // signature "2:9"

beforeEach(() => {
  getUserBooks.mockReset()
  recomputeTasteProfile.mockReset()
  refreshProfile.mockReset()
  profile = { taste_summary: 'You read for language and ideas.', taste_axes: AXES }
})

describe('Taste', () => {
  it('shows the "reading you in" empty state when the shelf is empty', async () => {
    profile = { taste_summary: null, taste_axes: null }
    getUserBooks.mockResolvedValue([])

    render(<Taste />)

    expect(await screen.findByText(/still reading you in/i)).toBeInTheDocument()
    expect(recomputeTasteProfile).not.toHaveBeenCalled()
  })

  it('renders the cached profile without recomputing when the shelf is unchanged', async () => {
    getUserBooks.mockResolvedValue(TWO_BOOKS)

    render(<Taste />)

    expect(await screen.findByText('You read for language and ideas.')).toBeInTheDocument()
    // wait for the shelf load to settle (proves sync ran and chose not to recompute)
    expect(await screen.findByText(/Drawn from 2 books/)).toBeInTheDocument()
    // composition percentages
    expect(screen.getByText('35%')).toBeInTheDocument()
    // bipolar axis labels
    expect(screen.getByText('demanding')).toBeInTheDocument()
    expect(screen.getByText('page-turner')).toBeInTheDocument()
    // tone is a gap → rendered as a "?" marker
    expect(screen.getByLabelText(/not enough signal yet/i)).toBeInTheDocument()
    expect(recomputeTasteProfile).not.toHaveBeenCalled()
  })

  it('recomputes when the shelf signature no longer matches the cached axes', async () => {
    // Shelf now has 3 books → signature "3:14", but cached axes are "2:9".
    getUserBooks.mockResolvedValue([{ rating: 5 }, { rating: 4 }, { rating: 5 }])
    const fresh: TasteAxes = { ...AXES, signature: '3:14', tone: { value: 0.6, confidence: 0.7 } }
    recomputeTasteProfile.mockResolvedValue(fresh)

    render(<Taste />)

    await waitFor(() => expect(recomputeTasteProfile).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled())
  })
})
