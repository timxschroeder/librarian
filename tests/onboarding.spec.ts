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

  test('step 1 — genre grid renders all 12 genres', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('What do you love to read?')).toBeVisible()
    // 12 genre buttons; filter by their label text
    const labels = [
      'Literary Fiction', 'Mystery & Thriller', 'Sci-Fi & Fantasy', 'Historical Fiction',
      'Biography & Memoir', 'Science & Nature', 'Essays', 'Poetry',
      'Self-Help', 'History', 'Philosophy', 'Humor',
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

    await expect(page.getByText('Which of these have you read?')).toBeVisible()
    // "All" tab and the selected genre tab should appear
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Literary Fiction' })).toBeVisible()
  })

  test('step 2 — selecting a book reveals star rating', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('What do you love to read?')).toBeVisible()
    await page.getByText('Sci-Fi & Fantasy').click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Which of these have you read?')).toBeVisible()

    // Tap the first book cover button (has "aspect-[2/3]" in its class)
    await page.locator('button[class*="aspect"]').first().click()
    // Star buttons should now appear
    await expect(page.locator('button').filter({ hasText: '★' }).first()).toBeVisible()
  })

  test('step 3 — completion screen shows selected genres', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('What do you love to read?')).toBeVisible()
    await page.getByText('Literary Fiction').click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Skip' }).click()

    await expect(page.getByText('Your shelf is ready')).toBeVisible()
    await expect(page.getByText('Literary Fiction')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Go to my shelf' })).toBeVisible()
  })
})
