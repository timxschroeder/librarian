import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Bertha from './Bertha'

describe('Bertha', () => {
  it('renders an svg sized from the width prop', () => {
    const { container } = render(<Bertha size={60} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('width')).toBe('60')
    // height keeps the 120×132 aspect ratio
    expect(svg?.getAttribute('height')).toBe('66')
  })

  it('is decorative (aria-hidden, no title) by default', () => {
    const { container } = render(<Bertha />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('title')).toBeNull()
  })

  it('exposes an accessible label when given a title', () => {
    const { container, getByTitle } = render(<Bertha title="Bertha is thinking" expression="thinking" />)
    expect(getByTitle('Bertha is thinking')).toBeTruthy()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBeNull()
  })

  it('renders distinct markup per expression', () => {
    const happy = render(<Bertha expression="happy" />).container.innerHTML
    const reading = render(<Bertha expression="reading" />).container.innerHTML
    const oops = render(<Bertha expression="oops" />).container.innerHTML
    // The reading pose adds a book (burgundy spine); happy does not.
    expect(reading).toContain('#6B1E1E')
    expect(happy).not.toContain('#6B1E1E')
    expect(happy).not.toBe(reading)
    expect(happy).not.toBe(oops)
  })
})
