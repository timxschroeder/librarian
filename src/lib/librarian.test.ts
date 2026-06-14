import { describe, it, expect, vi, beforeEach } from 'vitest'

// librarian.ts imports `supabase` from './supabase'; route invoke() to a mock.
const invoke = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}))

import { initializeTastePortrait, chat, recommend } from './librarian'

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
