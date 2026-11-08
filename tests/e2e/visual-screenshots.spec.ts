import { test } from '@playwright/test';
import * as path from 'path';

test.describe('Visual Inspection & Screenshot Capture (Issue #85)', () => {
  const screenshotDir = path.resolve(process.cwd(), 'tests/e2e/screenshots');

  test('captures desktop home page and main stage components', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for the key sections to render
    const channelsSection = page.locator('#channels');
    await channelsSection.waitFor({ state: 'visible', timeout: 10000 });

    // 1. Desktop Hero and Live Listener Badge
    await page.screenshot({
      path: path.join(screenshotDir, 'desktop-home-viewport.png'),
    });

    // 2. Full Page
    await page.screenshot({
      path: path.join(screenshotDir, 'desktop-home-fullpage.png'),
      fullPage: true,
    });

    // 3. Channels Section showcase card
    await channelsSection.scrollIntoViewIfNeeded();
    await channelsSection.screenshot({
      path: path.join(screenshotDir, 'desktop-channels-section.png'),
    });

    // 4. Sticky Bottom Player
    const player = page.getByRole('region', { name: /Live radio player/i });
    if (await player.isVisible()) {
      await player.screenshot({
        path: path.join(screenshotDir, 'desktop-bottom-player.png'),
      });
    }
  });

  test('captures mobile home page, single stage showcase, and sticky player', async ({ page }) => {
    // iPhone 13/14 (390 x 844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const channelsSection = page.locator('#channels');
    await channelsSection.waitFor({ state: 'visible', timeout: 10000 });

    // 1. Mobile Hero Viewport
    await page.screenshot({
      path: path.join(screenshotDir, 'mobile-home-viewport.png'),
    });

    // 2. Channels Section on Mobile
    await channelsSection.scrollIntoViewIfNeeded();
    await channelsSection.screenshot({
      path: path.join(screenshotDir, 'mobile-channels-section.png'),
    });

    // 3. Mobile Bottom Player
    const player = page.getByRole('region', { name: /Live radio player/i });
    if (await player.isVisible()) {
      await player.screenshot({
        path: path.join(screenshotDir, 'mobile-bottom-player.png'),
      });
    }

    // 4. Mobile Full Page
    await page.screenshot({
      path: path.join(screenshotDir, 'mobile-home-fullpage.png'),
      fullPage: true,
    });
  });

  test('captures /channels dedicated page on desktop and mobile', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/channels', { waitUntil: 'domcontentloaded' });
    await page.locator('#channels').waitFor({ state: 'visible', timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, 'desktop-channels-page.png'),
      fullPage: true,
    });

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/channels', { waitUntil: 'domcontentloaded' });
    await page.locator('#channels').waitFor({ state: 'visible', timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, 'mobile-channels-page.png'),
      fullPage: true,
    });
  });
});
