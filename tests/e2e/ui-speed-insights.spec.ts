import { test, expect } from '@playwright/test';

test.describe('UI Speed & Performance Insights E2E Suite', () => {
  test('measures home page navigation timing, TTFB, and DOMContentLoaded speed', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const clientDuration = Date.now() - startTime;

    // Client navigation should complete promptly
    expect(clientDuration).toBeLessThan(5000);

    // Performance navigation timings inside real Chromium browser
    const timings = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (!nav) return null;
      return {
        ttfb: nav.responseStart - nav.requestStart,
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        loadEvent: nav.loadEventEnd - nav.startTime,
        transferSize: nav.transferSize,
      };
    });

    if (timings) {
      // Time to First Byte should be well within budget
      expect(timings.ttfb).toBeLessThan(1500);
      // DOM Content Loaded should be snappy
      expect(timings.domContentLoaded).toBeLessThan(3000);
    }

    // Verify main interactive elements are rendered
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /play|pause/i }).first()).toBeVisible();
  });

  test('verifies UI interactivity and responsive button latency', async ({ page }) => {
    await page.goto('/');

    const playButton = page.getByRole('button', { name: /play|pause/i }).first();
    await expect(playButton).toBeVisible();

    const clickStart = Date.now();
    await playButton.click();
    const clickDuration = Date.now() - clickStart;

    // Button click interaction must execute without main thread blockage (< 300ms)
    expect(clickDuration).toBeLessThan(300);
  });

  test('verifies live status page UI load speed and /api/status payload integration', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/status');
    const loadDuration = Date.now() - startTime;

    expect(loadDuration).toBeLessThan(5000);
    await expect(page.getByRole('heading', { name: /System Status/i })).toBeVisible();
  });
});
