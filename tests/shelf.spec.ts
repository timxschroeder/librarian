import { test, expect } from '@playwright/test'
import { injectAuth, TEST_USER_ID } from './helpers/auth'

test.describe('Shelf (authenticated + onboarded)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page, { onboarded: true })
  })

  test('renders the shelf heading after login', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'My Shelf' })).toBeVisible()
  })

  test('empty state prompts to add first book', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Your shelf is empty')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add your first book' })).toBeVisible()
  })

  test('sidebar navigation is visible on desktop', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'My Shelf' })).toBeVisible()
    // Desktop sidebar links (NavLink renders as <a>)
    await expect(page.getByRole('link', { name: 'Shelf' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Discover' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Chat' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
  })

  test('Discover shows the author-suggestions empty state', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'My Shelf' })).toBeVisible()
    await page.getByRole('link', { name: 'Discover' }).click()
    await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible()
    await expect(page.getByText(/four stars or higher/i)).toBeVisible()
  })

  test('Chat page renders the conversation with a welcome message', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'My Shelf' })).toBeVisible()
    await page.getByRole('link', { name: 'Chat' }).click()
    await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible()
    await expect(page.getByText(/I'm your personal librarian/i)).toBeVisible()
  })
})

test.describe('Shelf with books', () => {
  test('renders book title when user_books exist', async ({ page }) => {
    const mockBook = {
      id: `${TEST_USER_ID}-isbn:9780743273565`,
      user_id: TEST_USER_ID,
      book_id: 'isbn:9780743273565',
      rating: 4,
      notes: null,
      read_at: '2024-01-01',
      created_at: '2024-01-01T00:00:00.000Z',
      book: {
        id: 'isbn:9780743273565',
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        cover_url: null,
        description: null,
        first_publish_year: 1925,
        subjects: null,
        isbn: '9780743273565',
      },
      profile: { id: TEST_USER_ID, name: 'Test User' },
    }
    await injectAuth(page, { onboarded: true, userBooks: [mockBook] })
    await page.goto('/')
    await expect(page.getByRole('paragraph').filter({ hasText: 'The Great Gatsby' })).toBeVisible()
  })
})
