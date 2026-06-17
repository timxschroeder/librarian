import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalCelebration from './GoalCelebration'

describe('GoalCelebration', () => {
  it('announces the goal and calls onDismiss when dismissed', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<GoalCelebration goal={24} onDismiss={onDismiss} />)

    expect(screen.getByRole('dialog', { name: 'Reading goal reached' })).toBeInTheDocument()
    expect(screen.getByText(/You've read 24 books/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Yay!' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('uses singular phrasing for a goal of one book', () => {
    render(<GoalCelebration goal={1} onDismiss={vi.fn()} />)
    expect(screen.getByText(/You've read 1 book —/)).toBeInTheDocument()
  })
})
