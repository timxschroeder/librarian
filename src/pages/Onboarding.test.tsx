import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const completeOnboarding = vi.fn()
vi.mock('../lib/db', () => ({
  completeOnboarding: (...args: unknown[]) => completeOnboarding(...args),
}))

const refreshProfile = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, refreshProfile }),
}))

import Onboarding from './Onboarding'

beforeEach(() => {
  completeOnboarding.mockReset()
  refreshProfile.mockReset()
})

// Step 1: pick a genre → Continue → reach "Get started" on step 2.
async function reachGetStarted(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Literary Fiction/ }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  return screen.getByRole('button', { name: /Get started/ })
}

describe('Onboarding', () => {
  it('gates "Continue" until at least one genre is selected', async () => {
    const user = userEvent.setup()
    render(<Onboarding />)

    const cont = screen.getByRole('button', { name: 'Continue' })
    expect(cont).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Literary Fiction/ }))
    expect(cont).toBeEnabled()
  })

  it('surfaces the error when the save fails (e.g. permission denied)', async () => {
    completeOnboarding.mockRejectedValue(new Error('permission denied for table books'))
    const user = userEvent.setup()
    render(<Onboarding />)

    const getStarted = await reachGetStarted(user)
    await user.click(getStarted)

    expect(await screen.findByText(/permission denied for table books/)).toBeInTheDocument()
    expect(refreshProfile).not.toHaveBeenCalled()
  })

  it('saves and refreshes the profile on success', async () => {
    completeOnboarding.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Onboarding />)

    await user.click(await reachGetStarted(user))

    expect(completeOnboarding).toHaveBeenCalledWith('u1', ['literary'], expect.any(Array))
    expect(refreshProfile).toHaveBeenCalled()
  })
})
