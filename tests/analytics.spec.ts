import { test, expect, type Page } from '@playwright/test'
import { injectAuth } from './helpers/auth'

// Walks a fictional user through onboarding and asserts that the behavioural events
// (migration 012 / src/lib/events.ts) actually reach the app_events table. The event
// writes are fire-and-forget POSTs to /rest/v1/app_events; we intercept them here and
// inspect the row payloads, proving the analytics contract end-to-end. This is the
// scenario that was previously unanswerable — "did the user toggle a Fiction genre?".

interface CapturedEvent {
  user_id: string | null
  name: string
  props: Record<string, unknown>
}

/** Intercept app_events inserts into an array, ack each so the fire-and-forget resolves. */
async function captureEvents(page: Page): Promise<CapturedEvent[]> {
  const events: CapturedEvent[] = []
  await page.route(
    (url) => url.href.includes('/rest/v1/app_events'),
    async (route) => {
      const raw = route.request().postDataJSON()
      const rows = Array.isArray(raw) ? raw : [raw]
      for (const r of rows) if (r) events.push(r as CapturedEvent)
      await route.fulfill({ contentType: 'application/json', body: '{}' })
    },
  )
  return events
}

const names = (events: CapturedEvent[]) => events.map((e) => e.name)

test.describe('Analytics — onboarding funnel events', () => {
  test('logs started → genre toggles → completed as a fictional user walks through', async ({ page }) => {
    await injectAuth(page, { onboarded: false, name: 'Mattis' })
    const events = await captureEvents(page)

    // completeOnboarding does `update(profiles).select('id')`, which expects an array of
    // rows; injectAuth's generic profiles route returns a single object (fine for the
    // GET via maybeSingle, wrong for the PATCH). Override just the PATCH here so the
    // completion actually resolves; let the GET fall through to the helper.
    await page.route(
      (url) => url.href.includes('/rest/v1/profiles'),
      async (route) => {
        if (route.request().method() === 'GET') return route.fallback()
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'ok' }]) })
      },
    )

    await page.goto('/')
    await expect(page.getByText('What do you love to read?')).toBeVisible()

    // Landing on onboarding fires `onboarding_started`.
    await expect.poll(() => names(events)).toContain('onboarding_started')

    // Selecting a genre fires a toggle event with the genre key and the new state.
    await page.getByText('Literary Fiction').click()
    await expect
      .poll(() => events.filter((e) => e.name === 'onboarding_genre_toggled'))
      .toContainEqual(expect.objectContaining({ props: { key: 'literary', selected: true } }))

    // Deselecting fires a toggle with selected:false — so an "I didn't pick that" report
    // is fully reconstructable from the log.
    await page.getByText('Literary Fiction').click()
    await expect
      .poll(() => events.filter((e) => e.name === 'onboarding_genre_toggled'))
      .toContainEqual(expect.objectContaining({ props: { key: 'literary', selected: false } }))

    // Re-select and complete onboarding (no books — the "Skip" path).
    await page.getByText('Science Fiction').click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText("Pick books you've loved")).toBeVisible()
    await page.getByRole('button', { name: 'Get started' }).click()

    // Completion fires `onboarding_completed` carrying the final genre selection.
    await expect.poll(() => names(events)).toContain('onboarding_completed')
    const completed = events.find((e) => e.name === 'onboarding_completed')!
    expect(completed.props.genres).toEqual(['scifi'])
    expect(completed.props.book_count).toBe(0)

    // The events are attributed to the signed-in user, not anonymous.
    expect(events.every((e) => e.user_id !== undefined)).toBe(true)
  })
})
