import { vi } from 'vitest'

/** Shape every Supabase table call resolves to. */
export type QueryResult = { data?: unknown; error?: unknown }

// The real Supabase query builder is a thenable: each filter/modifier returns the
// builder, and awaiting it resolves to `{ data, error }`. This mock mirrors that —
// every chained method returns the same object, which resolves to the configured
// result for the table it was opened with.
function builder(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'in', 'match', 'order', 'limit', 'single', 'maybeSingle',
  ]
  for (const m of methods) chain[m] = vi.fn(() => chain)
  // Make the chain awaitable.
  chain.then = (onFulfilled: (r: QueryResult) => unknown) =>
    Promise.resolve({ data: null, error: null, ...result }).then(onFulfilled)
  return chain
}

/**
 * Build a fake supabase client for `vi.mock('../lib/supabase')`.
 * Provide a per-table result map; tables not listed resolve to `{data:null,error:null}`.
 *
 *   const supabase = createSupabaseMock({ tables: { books: { error: { message: 'denied' } } } })
 */
export function createSupabaseMock(
  opts: { tables?: Record<string, QueryResult>; default?: QueryResult } = {}
) {
  const from = vi.fn((table: string) =>
    builder(opts.tables?.[table] ?? opts.default ?? { data: null, error: null })
  )
  return {
    from,
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  }
}
