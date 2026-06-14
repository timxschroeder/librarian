import { describe, it, expect, vi, beforeEach } from 'vitest'

// db.ts imports `supabase` from './supabase'; route that to a per-test mock client.
const hoisted = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('./supabase', () => ({
  get supabase() {
    return hoisted.client
  },
}))

import { createSupabaseMock } from '../test/supabaseMock'
import {
  getProfile,
  updateProfile,
  getUserBooks,
  upsertBookAndUserBook,
  completeOnboarding,
  getChatHistory,
  saveChatMessage,
  type OnboardingBook,
} from './db'
import type { Book } from '../types'

function setClient(opts: Parameters<typeof createSupabaseMock>[0]) {
  hoisted.client = createSupabaseMock(opts)
}

const book: Book = {
  id: 'isbn:1', title: 'T', author: 'A', cover_url: null,
  description: null, first_publish_year: null, subjects: null, isbn: '1',
  average_rating: null, ratings_count: null,
}

beforeEach(() => {
  hoisted.client = null
})

describe('getProfile', () => {
  it('returns the profile row on success', async () => {
    setClient({ tables: { profiles: { data: { id: 'u1', name: 'Tim' } } } })
    expect(await getProfile('u1')).toMatchObject({ id: 'u1', name: 'Tim' })
  })

  it('returns null when no row exists', async () => {
    setClient({ tables: { profiles: { data: null } } })
    expect(await getProfile('u1')).toBeNull()
  })

  it('throws when Supabase returns an error', async () => {
    setClient({ tables: { profiles: { error: { message: 'boom' } } } })
    await expect(getProfile('u1')).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('updateProfile', () => {
  it('resolves when a row is updated', async () => {
    setClient({ tables: { profiles: { data: [{ id: 'u1' }] } } })
    await expect(updateProfile('u1', { name: 'X' })).resolves.toBeUndefined()
  })

  it('throws on a Supabase error (no silent failure)', async () => {
    setClient({ tables: { profiles: { error: { message: 'denied' } } } })
    await expect(updateProfile('u1', { name: 'X' })).rejects.toMatchObject({ message: 'denied' })
  })

  it('throws when no row matched the id', async () => {
    setClient({ tables: { profiles: { data: [] } } })
    await expect(updateProfile('u1', { name: 'X' })).rejects.toThrow(/Profile not found/)
  })
})

describe('getUserBooks', () => {
  it('returns [] when there are no rows', async () => {
    setClient({ tables: { user_books: { data: null } } })
    expect(await getUserBooks('u1')).toEqual([])
  })

  it('throws on a Supabase error', async () => {
    setClient({ tables: { user_books: { error: { message: 'rls' } } } })
    await expect(getUserBooks('u1')).rejects.toMatchObject({ message: 'rls' })
  })
})

describe('upsertBookAndUserBook', () => {
  it('resolves when both upserts succeed', async () => {
    setClient({ default: { error: null } })
    await expect(upsertBookAndUserBook('u1', book, 4)).resolves.toBeUndefined()
  })

  it('throws when the books upsert fails', async () => {
    setClient({ tables: { books: { error: { message: 'permission denied for table books' } } } })
    await expect(upsertBookAndUserBook('u1', book, 4)).rejects.toMatchObject({
      message: 'permission denied for table books',
    })
  })

  it('throws when the user_books upsert fails', async () => {
    setClient({ tables: { user_books: { error: { message: 'ub fail' } } } })
    await expect(upsertBookAndUserBook('u1', book, 4)).rejects.toMatchObject({ message: 'ub fail' })
  })
})

describe('getChatHistory', () => {
  it('returns the messages on success', async () => {
    setClient({ tables: { chat_messages: { data: [{ id: 'm1', role: 'user', content: 'hi' }] } } })
    expect(await getChatHistory('u1')).toEqual([{ id: 'm1', role: 'user', content: 'hi' }])
  })

  it('returns [] when there are no rows', async () => {
    setClient({ tables: { chat_messages: { data: null } } })
    expect(await getChatHistory('u1')).toEqual([])
  })

  it('throws on a Supabase error', async () => {
    setClient({ tables: { chat_messages: { error: { message: 'rls' } } } })
    await expect(getChatHistory('u1')).rejects.toMatchObject({ message: 'rls' })
  })
})

describe('saveChatMessage', () => {
  it('resolves when the insert succeeds', async () => {
    setClient({ tables: { chat_messages: { error: null } } })
    await expect(saveChatMessage('u1', 'user', 'hi')).resolves.toBeUndefined()
  })

  it('throws on a Supabase error (no silent failure)', async () => {
    setClient({ tables: { chat_messages: { error: { message: 'denied' } } } })
    await expect(saveChatMessage('u1', 'assistant', 'yo')).rejects.toMatchObject({ message: 'denied' })
  })
})

describe('completeOnboarding', () => {
  const books: OnboardingBook[] = [{ book, rating: 5 }]

  it('updates the profile when no books are selected', async () => {
    setClient({ tables: { profiles: { data: [{ id: 'u1' }] } } })
    await expect(completeOnboarding('u1', ['literary'], [])).resolves.toBeUndefined()
  })

  it('throws when the books upsert is denied (the production bug)', async () => {
    setClient({ tables: { books: { error: { message: 'permission denied for table books' } } } })
    await expect(completeOnboarding('u1', ['literary'], books)).rejects.toMatchObject({
      message: 'permission denied for table books',
    })
  })

  it('completes when every write succeeds', async () => {
    setClient({
      tables: {
        books: { error: null },
        user_books: { error: null },
        profiles: { data: [{ id: 'u1' }] },
      },
    })
    await expect(completeOnboarding('u1', ['literary'], books)).resolves.toBeUndefined()
  })
})
