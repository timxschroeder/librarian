import type { Page } from '@playwright/test'
import type { Profile } from '../../src/types'

export const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'

// Supabase derives: sb-{hostname.split('.')[0]}-auth-token
// Test URL: https://test.supabase.co → key = sb-test-auth-token
const STORAGE_KEY = 'sb-test-auth-token'

function makeFakeJwt(userId: string): string {
  const b64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({
    sub: userId,
    role: 'authenticated',
    aud: 'authenticated',
    email: 'test@example.com',
    exp: Math.floor(Date.now() / 1000) + 86400 * 365,
    iat: Math.floor(Date.now() / 1000),
  })
  return `${header}.${payload}.testfakesig`
}

export interface InjectAuthOptions {
  onboarded?: boolean
  name?: string
  userBooks?: unknown[]
}

export async function injectAuth(page: Page, opts: InjectAuthOptions = {}) {
  const { onboarded = true, name = 'Test User', userBooks = [] } = opts
  const accessToken = makeFakeJwt(TEST_USER_ID)

  const profile: Profile = {
    id: TEST_USER_ID,
    name,
    email: 'test@example.com',
    taste_summary: null,
    genres: [],
    onboarded_at: onboarded ? '2024-01-01T00:00:00.000Z' : null,
    created_at: '2024-01-01T00:00:00.000Z',
  }

  const sessionObj = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 86400 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 86400 * 365,
    refresh_token: 'test-refresh',
    user: {
      id: TEST_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.com',
      email_confirmed_at: '2024-01-01T00:00:00.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' },
      user_metadata: {},
    },
  }

  // Use a script string so there are no TypeScript/serialization issues
  const initScript = `
    (function() {
      var key = ${JSON.stringify(STORAGE_KEY)};
      var session = ${JSON.stringify(sessionObj)};
      try { localStorage.setItem(key, JSON.stringify(session)); } catch(e) {}
    })();
  `
  await page.addInitScript(initScript)

  // Use URL function predicates — more reliable than glob patterns for Supabase URLs
  // Note: Playwright passes a URL object (not a string) to the predicate
  await page.route(url => url.href.includes('/rest/v1/profiles'), async route => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(profile) })
    } else {
      // PATCH / POST — acknowledge success
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(profile) })
    }
  })

  await page.route(url => url.href.includes('/rest/v1/user_books'), async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(userBooks) })
    } else {
      await route.fulfill({ contentType: 'application/json', body: '{}' })
    }
  })

  await page.route(url => url.href.includes('/rest/v1/books'), async route => {
    await route.fulfill({ contentType: 'application/json', body: '{}' })
  })

  await page.route(url => url.href.includes('/rest/v1/chat_messages'), async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: '[]' })
    } else {
      await route.fulfill({ contentType: 'application/json', body: '{}' })
    }
  })

  // Catch-all for Supabase auth endpoints so token refresh never fails
  await page.route(url => url.href.includes('/auth/v1/'), async route => {
    await route.fulfill({ contentType: 'application/json', body: '{}' })
  })
}
