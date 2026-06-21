import { describe, it, expect, vi, beforeEach } from 'vitest'

// librarian.ts imports `supabase` from './supabase'; route invoke() to a mock.
const invoke = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}))

import { initializeTastePortrait, converse, recomputeTasteProfile } from './librarian'

beforeEach(() => {
  invoke.mockReset()
})

describe('initializeTastePortrait', () => {
  it('returns the taste summary on success', async () => {
    invoke.mockResolvedValue({ data: { taste_summary: 'You love voice.' }, error: null })
    expect(await initializeTastePortrait([{ title: 'T', author: 'A' }])).toBe('You love voice.')
    expect(invoke).toHaveBeenCalledWith('librarian', {
      body: { mode: 'initialize', books: [{ title: 'T', author: 'A' }] },
    })
  })

  it('throws on an Edge Function error', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(initializeTastePortrait([])).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('converse', () => {
  it('returns the reply + slate and forwards the current table', async () => {
    const table = [{ title: 'Piranesi', author: 'Susanna Clarke', type: null, reasoning: 'dreamlike', pinned: true }]
    const data = {
      message: 'Keeping Piranesi pinned.',
      recommendations: [
        { title: 'Piranesi', author: 'Susanna Clarke', type: null, reasoning: 'dreamlike', pinned: true },
        { title: 'The Starless Sea', author: 'Erin Morgenstern', type: 'stretch', reasoning: 'same key', pinned: false },
      ],
    }
    invoke.mockResolvedValue({ data, error: null })
    const res = await converse('more like the first one', [{ role: 'user', content: 'hi' }], table)
    expect(res.message).toBe('Keeping Piranesi pinned.')
    expect(res.recommendations).toHaveLength(2)
    expect(res.recommendations[0].pinned).toBe(true)
    expect(invoke).toHaveBeenCalledWith('librarian', {
      body: { mode: 'converse', message: 'more like the first one', history: [{ role: 'user', content: 'hi' }], table },
    })
  })

  it('returns an empty slate on a pure-conversation turn', async () => {
    invoke.mockResolvedValue({ data: { message: 'What did the ending leave you with?', recommendations: [] }, error: null })
    const res = await converse('I just finished Piranesi', [], [])
    expect(res.recommendations).toHaveLength(0)
    expect(res.message).toContain('?')
  })

  it('throws on error', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'fail' } })
    await expect(converse('x', [], [])).rejects.toMatchObject({ message: 'fail' })
  })
})

describe('recomputeTasteProfile', () => {
  it('returns the taste axes and invokes the profile mode', async () => {
    const axes = {
      source_of_reward: { language: 0.4, story: 0.1, character: 0.2, ideas: 0.3 },
      weight: { value: 0.5, confidence: 0.8 },
      propulsion: { value: -0.3, confidence: 0.6 },
      darkness: { value: 0.2, confidence: 0.7 },
      tone: { value: 0, confidence: 0 },
      signature: '3:13',
      updated_at: '2026-06-15T00:00:00.000Z',
    }
    invoke.mockResolvedValue({ data: { taste_axes: axes }, error: null })
    expect(await recomputeTasteProfile()).toEqual(axes)
    expect(invoke).toHaveBeenCalledWith('librarian', { body: { mode: 'profile' } })
  })

  it('throws on an Edge Function error', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(recomputeTasteProfile()).rejects.toMatchObject({ message: 'boom' })
  })
})
