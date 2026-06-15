import { describe, it, expect, vi, beforeEach } from 'vitest'

// librarian.ts imports `supabase` from './supabase'; route invoke() to a mock.
const invoke = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}))

import { initializeTastePortrait, chat, recommend, recomputeTasteProfile } from './librarian'

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

describe('chat', () => {
  it('returns the reply + taste update', async () => {
    invoke.mockResolvedValue({ data: { message: 'Hi!', taste_summary_update: null }, error: null })
    const res = await chat('hello', [])
    expect(res.message).toBe('Hi!')
    expect(invoke).toHaveBeenCalledWith('librarian', {
      body: { mode: 'chat', message: 'hello', history: [] },
    })
  })

  it('throws on error', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'fail' } })
    await expect(chat('x', [])).rejects.toMatchObject({ message: 'fail' })
  })
})

describe('recommend', () => {
  it('returns the slate', async () => {
    const slate = {
      intro: 'Here you go',
      recommendations: [{ title: 'B', author: 'C', type: 'comfort', reasoning: 'because' }],
    }
    invoke.mockResolvedValue({ data: slate, error: null })
    const res = await recommend('something light', [])
    expect(res.recommendations).toHaveLength(1)
    expect(res.recommendations[0].type).toBe('comfort')
    expect(invoke).toHaveBeenCalledWith('librarian', {
      body: { mode: 'recommend', message: 'something light', history: [] },
    })
  })

  it('throws on error', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'nope' } })
    await expect(recommend('x', [])).rejects.toMatchObject({ message: 'nope' })
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
