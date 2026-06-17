import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// happy-dom v20 exposes localStorage on `window` but not as a bare global, so app
// code and tests that use `localStorage` directly (as in a real browser) hit
// `undefined`. Alias it once; fall back to an in-memory shim if even window lacks it.
if (typeof globalThis.localStorage === 'undefined') {
  const fromWindow = typeof window !== 'undefined' ? window.localStorage : undefined
  globalThis.localStorage =
    fromWindow ??
    (() => {
      const store = new Map<string, string>()
      return {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() {
          return store.size
        },
      } as Storage
    })()
}

// Unmount React trees between tests so the DOM doesn't leak across cases.
afterEach(() => cleanup())
