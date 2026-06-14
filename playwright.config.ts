import { defineConfig, devices } from '@playwright/test'

// Tests run on a separate port so they never reuse the live dev server,
// which has the real Supabase URL (and therefore a different localStorage key).
const TEST_PORT = 5174

const devCmd =
  process.platform === 'darwin'
    ? `PATH=/opt/homebrew/bin:$PATH npm run dev -- --port ${TEST_PORT}`
    : `npm run dev -- --port ${TEST_PORT}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${TEST_PORT}/librarian/`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: devCmd,
    url: `http://localhost:${TEST_PORT}/librarian/`,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
