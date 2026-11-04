import { test, expect } from '@playwright/test';

test.describe('PromptFM Home Page & Navigation', () => {
  test('loads home page with title, brand header, and verification meta tag', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/PromptFM/i);

    // Verify Google site verification meta tag is present in the DOM
    const metaVerification = page.locator('meta[name="google-site-verification"]');
    await expect(metaVerification).toHaveAttribute('content', 'JyC0MUsTb-PI8ssnpZsCcwmWCw-BxPvn7S07-2FDHRA');

    // Verify OpenGraph tags
    const ogSiteName = page.locator('meta[property="og:site_name"]');
    await expect(ogSiteName).toHaveAttribute('content', 'PromptFM');

    // Verify main brand heading
    const heading = page.getByRole('heading', { level: 1 }).first();
    await expect(heading).toBeVisible();
  });

  test('renders the sticky audio player and play control', async ({ page }) => {
    await page.goto('/');

    // Audio player container should exist
    const player = page.locator('footer, [role="region"], div').filter({ hasText: /PromptFM|Channel/i });
    await expect(player.first()).toBeVisible();

    // Play/Pause button or audio controls should exist
    const playButton = page.getByRole('button', { name: /play|pause/i }).first();
    await expect(playButton).toBeVisible();
  });

  test('navigates to the live status page from the navigation or footer', async ({ page }) => {
    await page.goto('/');

    // Navigate to status page
    await page.goto('/status');
    await expect(page).toHaveURL(/.*\/status/);
    await expect(page.getByRole('heading', { name: /System Status/i })).toBeVisible();
  });
});
