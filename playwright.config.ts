import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for PromptFM.
 * See https://playwright.dev/docs/test-configuration
 */
const PORT = process.env.PORT || 3000;
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? 'npm run start' : `npx next dev -p ${PORT}`,
        url: baseURL,
        timeout: 120 * 1000,
        reuseExistingServer: !process.env.CI,
      },
});

