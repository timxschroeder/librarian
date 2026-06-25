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

  it('deepens the bar green as progress climbs', () => {
    const bar = () => screen.getByRole('progressbar').firstChild as HTMLElement

    const { rerender } = render(<GoalProgress count={4} goal={16} />) // 25% — sage
    expect(bar()).toHaveClass('bg-forest-400')

    rerender(<GoalProgress count={11} goal={16} />) // 69% — brand forest
    expect(bar()).toHaveClass('bg-forest-700')

    rerender(<GoalProgress count={16} goal={16} />) // reached — deep forest
    expect(bar()).toHaveClass('bg-forest-900')
  })
})
