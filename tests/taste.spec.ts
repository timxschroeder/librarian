import { test, expect } from '@playwright/test'
import { injectAuth, TEST_USER_ID } from './helpers/auth'
import type { TasteAxes } from '../src/types'

const AXES: TasteAxes = {
  source_of_reward: { language: 0.35, story: 0.1, character: 0.25, ideas: 0.3 },
  weight: { value: 0.5, confidence: 0.8 },
  propulsion: { value: -0.4, confidence: 0.6 },
  darkness: { value: 0.3, confidence: 0.7 },
  tone: { value: 0, confidence: 0 }, // a gap
  signature: '1:4', // matches the single rated book below → no recompute
  updated_at: '2026-06-15T00:00:00.000Z',
}

const RATED_BOOK = {
  id: `${TEST_USER_ID}-isbn:9780743273565`,
  user_id: TEST_USER_ID,
  book_id: 'isbn:9780743273565',
  rating: 4,
  notes: null,
  read_at: '2024-01-01',
  created_at: '2024-01-01T00:00:00.000Z',
  book: { id: 'isbn:9780743273565', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', cover_url: null, description: null, first_publish_year: 1925, subjects: null, isbn: '9780743273565' },
  profile: { id: TEST_USER_ID, name: 'Test User' },
}

test.describe('Taste tab', () => {
  test('renders the cached taste profile', async ({ page }) => {
    await injectAuth(page, {
      onboarded: true,
      userBooks: [RATED_BOOK],
      tasteSummary: 'You read for language and ideas.',
      tasteAxes: AXES,
    })
    await page.goto('/')
    await page.getByRole('link', { name: 'Taste' }).click()

    await expect(page.getByRole('heading', { name: 'Your taste' })).toBeVisible()
    // portrait header
    await expect(page.getByText('You read for language and ideas.')).toBeVisible()
    // composition percentage
    await expect(page.getByText('35%')).toBeVisible()
    // bipolar axis labels
    await expect(page.getByText('demanding')).toBeVisible()
    await expect(page.getByText('page-turner')).toBeVisible()
    // tone is a gap → unknown marker
    await expect(page.getByLabel(/not enough signal yet/i)).toBeVisible()
  })

  test('empty shelf shows the "reading you in" state', async ({ page }) => {
    await injectAuth(page, { onboarded: true, userBooks: [] })
    await page.goto('/')
    await page.getByRole('link', { name: 'Taste' }).click()

    await expect(page.getByText(/still reading you in/i)).toBeVisible()
  })
})
