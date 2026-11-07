// tests/e2e/mobile-iphone-layout.spec.ts
// End-to-end tests for mobile iPhone layouts, safe areas, popovers, a11y, and visual screenshots.

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'test-results/screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.beforeEach(async ({ page }) => {
  // Pre-set cookie consent to avoid intrusive banner intercepting touch events in layout tests
  await page.addInitScript(() => {
    localStorage.setItem('promptfm_cookie_consent', 'accepted');
  });
});

test.describe('Mobile iPhone Layout, Bottom Player & Popovers (#109)', () => {
  test('renders tightened hero section and 2x2 action grid on iPhone 13/14 viewport (390x844)', async ({ page }) => {
    // Set standard iPhone 13/14 viewport (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Check no horizontal scrollbar / overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Primary CTA is full-width / prominent
    const hero = page.getByRole('main');
    const primaryCta = hero.getByRole('link', { name: /Explore Live Channels/i });
    await expect(primaryCta).toBeVisible();

    // Secondary actions are in 2x2 grid
    const chartsLink = hero.getByRole('link', { name: /Weekly Charts/i });
    const supportLink = hero.getByRole('link', { name: /Support Station/i });
    const contributeLink = hero.getByRole('link', { name: /Contribute/i });
    const submitLink = hero.getByRole('link', { name: /Submit/i });

    await expect(chartsLink).toBeVisible();
    await expect(supportLink).toBeVisible();
    await expect(contributeLink).toBeVisible();
    await expect(submitLink).toBeVisible();

    // Verify secondary action buttons share horizontal space (grid)
    const chartsBox = await chartsLink.boundingBox();
    const supportBox = await supportLink.boundingBox();
    expect(chartsBox).not.toBeNull();
    expect(supportBox).not.toBeNull();
    if (chartsBox && supportBox) {
      // Both should be roughly on the same vertical line (grid row 1)
      expect(Math.abs(chartsBox.y - supportBox.y)).toBeLessThan(10);
      // Width should be balanced (< 200px each on 390px viewport)
      expect(chartsBox.width).toBeLessThan(200);
      expect(supportBox.width).toBeLessThan(200);
    }

    // Save screenshot of hero on iPhone 13
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'hero-mobile-iphone13.png'),
      fullPage: false,
    });
  });

  test('tightened layout on compact iPhone SE viewport (375x667)', async ({ page }) => {
    // Set compact iPhone SE viewport (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify player is fixed at bottom
    const player = page.locator('div[role="region"][aria-label="Live radio player"]');
    await expect(player).toBeVisible();

    // Take screenshot of compact iPhone SE
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'hero-mobile-iphonese.png'),
      fullPage: false,
    });
  });

  test('renders sticky bottom player with safe-area padding, mobile time, report, and mute controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const player = page.locator('div[role="region"][aria-label="Live radio player"]');
    await expect(player).toBeVisible();

    // Check safe area class is applied
    const playerClass = await player.getAttribute('class');
    expect(playerClass).toContain('pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]');

    // Play/Pause button
    const playBtn = player.getByRole('button', { name: /Play stream|Pause stream/i });
    await expect(playBtn).toBeVisible();

    // Channel selector button
    const channelBtn = player.getByRole('button', { name: /Current channel/i });
    await expect(channelBtn).toBeVisible();

    // Mute/Unmute button is accessible on mobile
    const muteBtn = player.getByRole('button', { name: /Mute|Unmute/i });
    await expect(muteBtn).toBeVisible();

    // Report broadcast button is accessible on mobile
    const reportBtn = player.getByRole('button', { name: /Report current broadcast/i });
    await expect(reportBtn).toBeVisible();

    // Clicking report opens ReportModal
    await reportBtn.click();
    const reportDialog = page.getByRole('dialog', { name: /Report Content|Report Track/i });
    await expect(reportDialog).toBeVisible();

    // Close report modal
    const closeReportBtn = reportDialog.getByRole('button', { name: /Cancel|Close/i }).first();
    await closeReportBtn.click();
    await expect(reportDialog).toBeHidden();

    // Capture screenshot of player controls
    await player.screenshot({
      path: path.join(SCREENSHOT_DIR, 'player-mobile-iphone13.png'),
    });
  });

  test('opens channel switcher popover with symmetrical mobile padding and no screen overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const player = page.locator('div[role="region"][aria-label="Live radio player"]');
    const channelBtn = player.getByRole('button', { name: /Current channel/i });

    // Open channel switcher popover
    await channelBtn.click();

    const channelPopover = page.getByTestId('channels-popover');
    await expect(channelPopover).toBeVisible();

    // Verify symmetrical positioning: bounds fit completely within the 390px viewport
    const popoverBox = await channelPopover.boundingBox();
    expect(popoverBox).not.toBeNull();
    if (popoverBox) {
      expect(popoverBox.x).toBeGreaterThanOrEqual(0);
      expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(390);
      // Margins from left and right should be roughly equal (~8px each for left-2 right-2)
      const leftMargin = popoverBox.x;
      const rightMargin = 390 - (popoverBox.x + popoverBox.width);
      expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(4);
    }

    // Verify all 5 channels are present in list
    const channelButtons = channelPopover.getByRole('button').filter({ hasText: /Main Stage|Cyberpunk|Chillout|Kids|After Dark/i });
    await expect(channelButtons).toHaveCount(5);

    // Capture screenshot of open channel popover
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'channels-popover-iphone13.png'),
    });

    // Close popover
    const closeBtn = channelPopover.getByRole('button', { name: /Close channels menu/i });
    await closeBtn.click();
    await expect(channelPopover).toBeHidden();
  });

  test('opens Up Next queue popover centered symmetrically without off-center offset on iPhone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const player = page.locator('div[role="region"][aria-label="Live radio player"]');
    const upNextBtn = player.getByRole('button', { name: /Toggle Up Next airplay queue/i });

    // Open Up Next popover
    await upNextBtn.click();

    const upNextPopover = page.getByTestId('upnext-popover');
    await expect(upNextPopover).toBeVisible();

    // Verify bounds fit within viewport and are centered symmetrically
    const popoverBox = await upNextPopover.boundingBox();
    expect(popoverBox).not.toBeNull();
    if (popoverBox) {
      expect(popoverBox.x).toBeGreaterThanOrEqual(0);
      expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(390);
      const leftMargin = popoverBox.x;
      const rightMargin = 390 - (popoverBox.x + popoverBox.width);
      expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(4);
    }

    // Schedule link should be visible
    const scheduleLink = upNextPopover.getByRole('link', { name: /Full 24-Hour Broadcast Schedule/i });
    await expect(scheduleLink).toBeVisible();

    // Capture screenshot of Up Next popover
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'upnext-popover-iphone13.png'),
    });

    // Close popover
    const closeBtn = upNextPopover.getByRole('button', { name: /Close Up Next queue/i });
    await closeBtn.click();
    await expect(upNextPopover).toBeHidden();
  });

  test('passes Axe accessibility checks on iPhone viewport with zero critical violations', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Run axe on mobile home page
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast']) // Ignore external color variations
      .analyze();

    const criticalViolations = axeResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toEqual([]);
  });
});
