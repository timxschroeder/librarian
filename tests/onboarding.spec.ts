import { test, expect } from '@playwright/test'
import { injectAuth } from './helpers/auth'

test.describe('Login page (unauthenticated)', () => {
  test('shows the magic link form', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Librarian' })).toBeVisible()
    // Email input identified by placeholder since the label is not `for`-linked
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  })
})

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page, { onboarded: false })
  })

  test('step 1 — genre grid renders all 19 genres', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('What do you love to read?')).toBeVisible()
    // 19 genre buttons; filter by their label text
    const labels = [
      'Literary Fiction', 'Love & Romance', 'Mystery & Thriller', 'Science Fiction',
      'Fantasy', 'Historical Fiction', 'Horror', 'Classics', 'Biography & Memoir',
      'History', 'Science & Nature', 'Philosophy', 'Essays', 'Poetry',
      'Self-Help', 'Humor', 'Business & Economics', 'Technology', 'Religion & Spirituality',
    ]
    for (const label of labels) {
      await expect(page.getByText(label)).toBeVisible()
    }
  })

  test('step 1 — Continue is disabled until a genre is selected', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('What do you love to read?')).toBeVisible()
    const continueBtn = page.getByRole('button', { name: 'Continue' })
    await expect(continueBtn).toBeDisabled()

    await page.getByText('Literary Fiction').click()
    await expect(continueBtn).toBeEnabled()
  })

  test('step 1 — selected genres show count feedback', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('What do you love to read?')).toBeVisible()
    await page.getByText('Literary Fiction').click()
    await page.getByText('Mystery & Thriller').click()
    await expect(page.getByText('2 genres selected')).toBeVisible()
  })

  test('step 2 — books and genre filter tabs appear', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('What do you love to read?')).toBeVisible()
    await page.getByText('Literary Fiction').click()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByText("Pick books you've loved")).toBeVisible()
    // "All" tab and the selected genre tab should appear (exact: book covers carry
    // their title as accessible name, so a loose "All" also matches "All the Light…")
    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Literary Fiction', exact: true })).toBeVisible()
  })

  test('step 2 — selecting a book updates the count', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('What do you love to read?')).toBeVisible()
    await page.getByText('Science Fiction').click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText("Pick books you've loved")).toBeVisible()

    // Tap the first book cover button (has "aspect-[2/3]" in its class)
    await page.locator('button[class*="aspect"]').first().click()
    await expect(page.getByText('1 book selected')).toBeVisible()
  })

  test('step 2 — Skip and Get started buttons appear', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('What do you love to read?')).toBeVisible()
    await page.getByText('Literary Fiction').click()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByText("Pick books you've loved")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible()
  })
})
