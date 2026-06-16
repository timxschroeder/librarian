import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GoalProgress from './GoalProgress'

describe('GoalProgress', () => {
  it('shows the count, goal, and rounded percentage', () => {
    render(<GoalProgress count={6} goal={24} />)
    expect(screen.getByText('6 of 24 books read this year')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '6')
  })

  it('caps the bar at 100% and announces the goal once reached', () => {
    render(<GoalProgress count={30} goal={24} />)
    expect(screen.getByText('Goal reached — 30 of 24 books read 🎉')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
