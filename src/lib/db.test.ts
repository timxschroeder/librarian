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
  rejectBook,
  bulkAddBooks,
  deleteUserBook,
  completeOnboarding,
  getChatHistory,
  saveChatMessage,
  getKindleRequests,
  createKindleRequest,
  logAppError,
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

describe('rejectBook', () => {
  it('resolves when the book caches and the rejection records', async () => {
    setClient({ default: { error: null } })
    await expect(rejectBook('u1', book)).resolves.toBeUndefined()
  })

  it('throws when the books upsert fails', async () => {
    setClient({ tables: { books: { error: { message: 'book cache fail' } } } })
    await expect(rejectBook('u1', book)).rejects.toMatchObject({ message: 'book cache fail' })
  })

  it('throws when the recommendation insert fails', async () => {
    setClient({ tables: { recommendations: { error: { message: 'reject fail' } } } })
    await expect(rejectBook('u1', book)).rejects.toMatchObject({ message: 'reject fail' })
  })
})

describe('bulkAddBooks', () => {
  const b2: Book = { ...book, id: 'isbn:2', title: 'T2' }

  it('returns nothing and makes no calls for an empty list', async () => {
    setClient({ default: { error: { message: 'should not be called' } } })
    await expect(bulkAddBooks('u1', [])).resolves.toEqual({ added: [], skipped: 0 })
  })

  it('inserts new books and returns the added rows', async () => {
    setClient({
      tables: {
        // 1st user_books call = existing lookup (none); 2nd = the insert+select
        user_books: [{ data: [] }, { data: [{ id: 'ub1', book_id: 'isbn:1' }] }],
        books: { error: null },
      },
    })
    const res = await bulkAddBooks('u1', [book])
    expect(res.skipped).toBe(0)
    expect(res.added).toEqual([{ id: 'ub1', book_id: 'isbn:1' }])
  })

  it('skips books already on the shelf and reports the count', async () => {
    setClient({ tables: { user_books: { data: [{ book_id: 'isbn:1' }] } } })
    const res = await bulkAddBooks('u1', [book])
    expect(res).toEqual({ added: [], skipped: 1 })
  })

  it('de-dupes repeats within the same batch', async () => {
    setClient({
      tables: {
        user_books: [{ data: [] }, { data: [{ id: 'ub1', book_id: 'isbn:1' }] }],
        books: { error: null },
      },
    })
    const res = await bulkAddBooks('u1', [book, book, b2])
    // 3 in, but `book` is duplicated → 1 skipped
    expect(res.skipped).toBe(1)
  })

  it('throws when the books upsert is denied (grant/RLS bug)', async () => {
    setClient({
      tables: {
        user_books: { data: [] },
        books: { error: { message: 'permission denied for table books' } },
      },
    })
    await expect(bulkAddBooks('u1', [book])).rejects.toMatchObject({
      message: 'permission denied for table books',
    })
  })
})

describe('deleteUserBook', () => {
  it('resolves when the delete succeeds', async () => {
    setClient({ tables: { user_books: { error: null } } })
    await expect(deleteUserBook('ub1')).resolves.toBeUndefined()
  })

  it('throws on a Supabase error', async () => {
    setClient({ tables: { user_books: { error: { message: 'denied' } } } })
    await expect(deleteUserBook('ub1')).rejects.toMatchObject({ message: 'denied' })
  })
})

describe('getKindleRequests', () => {
  it('returns the rows on success', async () => {
    setClient({ tables: { kindle_requests: { data: [{ id: 'k1', book_id: 'b1', status: 'pending' }] } } })
    expect(await getKindleRequests('u1')).toEqual([{ id: 'k1', book_id: 'b1', status: 'pending' }])
  })

  it('returns [] when there are no rows', async () => {
    setClient({ tables: { kindle_requests: { data: null } } })
    expect(await getKindleRequests('u1')).toEqual([])
  })

  it('throws on a Supabase error', async () => {
    setClient({ tables: { kindle_requests: { error: { message: 'rls' } } } })
    await expect(getKindleRequests('u1')).rejects.toMatchObject({ message: 'rls' })
  })
})

describe('createKindleRequest', () => {
  it('returns the upserted row on success', async () => {
    setClient({ tables: { kindle_requests: { data: { id: 'k1', book_id: 'b1', status: 'pending' } } } })
    expect(await createKindleRequest('u1', 'b1')).toMatchObject({ id: 'k1', status: 'pending' })
  })

  it('throws when the upsert is denied (grant/RLS bug)', async () => {
    setClient({ tables: { kindle_requests: { error: { message: 'permission denied for table kindle_requests' } } } })
    await expect(createKindleRequest('u1', 'b1')).rejects.toMatchObject({
      message: 'permission denied for table kindle_requests',
    })
  })

  it('throws when no row comes back', async () => {
    setClient({ tables: { kindle_requests: { data: null } } })
    await expect(createKindleRequest('u1', 'b1')).rejects.toThrow(/Could not queue/)
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

  it('resolves when persisting a recommendation slate', async () => {
    setClient({ tables: { chat_messages: { error: null } } })
    const slate = [{ title: 'Piranesi', author: 'Susanna Clarke', type: null, reasoning: 'dreamlike', pinned: true }]
    await expect(saveChatMessage('u1', 'assistant', 'here you go', slate)).resolves.toBeUndefined()
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

describe('logAppError', () => {
  it('writes to app_errors on success', async () => {
    setClient({ tables: { app_errors: { data: null, error: null } } })
    await logAppError({ source: 'edge', userId: 'u1', context: { mode: 'recompute' }, message: 'boom' })
    const client = hoisted.client as ReturnType<typeof createSupabaseMock>
    expect(client.from).toHaveBeenCalledWith('app_errors')
  })

  it('never throws when the insert fails (best-effort — logging must not mask the real error)', async () => {
    setClient({ tables: { app_errors: { error: { message: 'denied' } } } })
    await expect(logAppError({ source: 'client', message: 'x' })).resolves.toBeUndefined()
  })
})
