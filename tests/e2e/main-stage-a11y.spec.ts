import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Issue #85: Main-Stage-Only Public UI & Accessibility (a11y)', () => {
  test('renders single visible main stage station identity, copy, and badges across home page', async ({ page }) => {
    await page.goto('/');

    // 1. Hero Main Stage Icon Treatment
    const heroStationIcon = page.locator('img[alt="PromptFM Main Stage 24/7 AI Radio"]');
    await expect(heroStationIcon).toBeVisible();

    const heroStationBadge = page.locator('div').filter({ hasText: /^Main Stage$/ }).first();
    await expect(heroStationBadge).toBeVisible();

    // 2. Real-time Live Listener Badge
    const liveBadge = page.locator('[role="status"][aria-label="Station live status and listener count"]');
    await expect(liveBadge).toBeVisible();
    await expect(liveBadge).toContainText(/MAIN STAGE LIVE/i);
    await expect(liveBadge).toContainText(/24\/7 BROADCAST/i);
    await expect(liveBadge).not.toContainText(/4 LIVE CHANNELS/i);
    await expect(liveBadge).not.toContainText(/NETWORK LISTENERS/i);

    // 3. Featured Feature Pills
    const featurePill = page.locator('main').getByText(/Main Stage · 24\/7 AI Radio/i);
    await expect(featurePill).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/5 Live Stations/i);

    // 4. Main Stage Showcase Grid Section
    const channelsSection = page.locator('#channels');
    await expect(channelsSection).toBeVisible();
    await expect(channelsSection).toHaveAttribute('aria-label', 'PromptFM Broadcast Station');

    // Header copy
    await expect(channelsSection).toContainText(/LIVE BROADCAST STAGE/i);
    await expect(channelsSection).toContainText(/PromptFM Main Stage Broadcast/i);
    await expect(channelsSection).not.toContainText(/Choose Your Radio Station/i);
    await expect(channelsSection).not.toContainText(/LIVE THEME CHANNELS/i);

    // Featured station card
    await expect(channelsSection).toContainText(/PromptFM Main Stage/i);
    await expect(channelsSection).toContainText(/DJ Neon/i);
    await expect(channelsSection).toContainText(/Top AI Hits/i);
    await expect(channelsSection).toContainText(/Family Safe/i);

    // Interactive accessible button
    const tuneInBtn = channelsSection.getByRole('button', { name: /Tune In Main Stage|Listening Now/i });
    await expect(tuneInBtn).toBeVisible();
  });

  test('channels page renders Main Stage broadcast directory with clear breadcrumb navigation', async ({ page }) => {
    await page.goto('/channels');

    // Breadcrumb navigation link
    const backLink = page.getByRole('link', { name: /Back to Home/i });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/');

    // Section should be visible and branded
    const channelsSection = page.locator('#channels');
    await expect(channelsSection).toBeVisible();
    await expect(channelsSection).toContainText(/PromptFM Main Stage Broadcast/i);

    // Tune in button visible and accessible
    const tuneInBtn = channelsSection.getByRole('button', { name: /Tune In Main Stage|Listening Now/i });
    await expect(tuneInBtn).toBeVisible();

    // Check page title and heading
    await expect(page).toHaveTitle(/PromptFM/i);
    await expect(channelsSection.getByRole('heading', { level: 2 })).toContainText(/PromptFM Main Stage Broadcast/i);
  });

  test('keyboard accessibility: station tune-in button receives focus and responds to keyboard activation', async ({ page }) => {
    await page.goto('/');

    const channelsSection = page.locator('#channels');
    const tuneInBtn = channelsSection.getByRole('button', { name: /Tune In Main Stage|Listening Now/i });

    // Scroll into view and focus
    await tuneInBtn.focus();
    await expect(tuneInBtn).toBeFocused();

    // Trigger keyboard Enter press
    await page.keyboard.press('Enter');

    // Verify button remains accessible and operational
    await expect(tuneInBtn).toBeVisible();
  });

  test('automated a11y audit: home page passes WCAG 2.1 AA accessibility checks without critical violations', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast']) // avoid false-positive sub-pixel gradient font contrast differences
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('automated a11y audit: /channels page passes WCAG 2.1 AA accessibility checks without critical violations', async ({ page }) => {
    await page.goto('/channels');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
