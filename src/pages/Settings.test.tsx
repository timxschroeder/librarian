import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const updateProfile = vi.fn()
vi.mock('../lib/db', () => ({
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}))

const refreshProfile = vi.fn()
const signOut = vi.fn()
let profile: { name: string; reading_goal: number | null }
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'tim@example.com' }, profile, signOut, refreshProfile }),
}))

import Settings from './Settings'

beforeEach(() => {
  updateProfile.mockReset().mockResolvedValue(undefined)
  refreshProfile.mockReset()
  signOut.mockReset()
  profile = { name: 'Tim', reading_goal: null }
})

describe('Settings — reading goal', () => {
  it('saves a whole-number goal and refreshes the profile', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    await user.type(screen.getByPlaceholderText('e.g. 24'), '24')
    await user.click(screen.getByRole('button', { name: 'Save reading goal' }))

    expect(updateProfile).toHaveBeenCalledWith('u1', { reading_goal: 24 })
    expect(await screen.findByText('✓')).toBeInTheDocument()
    expect(refreshProfile).toHaveBeenCalled()
  })

  it('rejects zero and negative goals without calling updateProfile', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    await user.type(screen.getByPlaceholderText('e.g. 24'), '0')
    await user.click(screen.getByRole('button', { name: 'Save reading goal' }))

    expect(await screen.findByText('Enter a whole number greater than 0.')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('clears the goal when the field is emptied', async () => {
    profile = { name: 'Tim', reading_goal: 24 }
    const user = userEvent.setup()
    render(<Settings />)

    const input = screen.getByPlaceholderText('e.g. 24')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save reading goal' }))

    expect(updateProfile).toHaveBeenCalledWith('u1', { reading_goal: null })
  })

  it('surfaces an error and does not crash when the save fails', async () => {
    updateProfile.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()
    render(<Settings />)

    await user.type(screen.getByPlaceholderText('e.g. 24'), '12')
    await user.click(screen.getByRole('button', { name: 'Save reading goal' }))

    expect(await screen.findByText('denied')).toBeInTheDocument()
  })
})
