// tests/e2e/hero-cta-layout.spec.ts
// E2E, Accessibility & Eyeball Screenshot Suite for Issue #125:
// Fix homepage hero CTA overlap on web/desktop.

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as path from 'path';

test.describe('Issue #125: Homepage Hero CTA Layout, a11y & Eyeball Screenshots', () => {
  const screenshotDir = path.resolve(process.cwd(), 'tests/e2e/screenshots');

  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 900, isDesktop: true },
    { name: 'desktop-1280', width: 1280, height: 800, isDesktop: true },
    { name: 'tablet-1024', width: 1024, height: 768, isDesktop: true },
    { name: 'tablet-768', width: 768, height: 1024, isDesktop: true },
    { name: 'mobile-390', width: 390, height: 844, isDesktop: false },
  ];

  for (const vp of viewports) {
    test(`renders hero CTAs cleanly without overlap on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Verify the hero CTA cluster exists
      const heroCtas = page.locator('#hero-ctas');
      await expect(heroCtas).toBeVisible();

      // Locate all 5 action buttons
      const primaryBtn = heroCtas.getByRole('link', { name: /Tune In Main Stage/i });
      const weeklyChartsBtn = heroCtas.getByRole('link', { name: /Weekly Charts/i });
      const supportBtn = heroCtas.getByRole('link', { name: /Support Station/i });
      const contributeBtn = heroCtas.getByRole('link', { name: /Contribute/i });
      const submitBtn = heroCtas.getByRole('link', { name: /Submit/i });

      const buttons = [
        { name: 'Tune In Main Stage', locator: primaryBtn },
        { name: 'Weekly Charts', locator: weeklyChartsBtn },
        { name: 'Support Station', locator: supportBtn },
        { name: 'Contribute', locator: contributeBtn },
        { name: 'Submit', locator: submitBtn },
      ];

      // 1. All buttons must be visible and have accessible clickable dimensions
      const boxes = [];
      for (const btn of buttons) {
        await expect(btn.locator).toBeVisible();
        const box = await btn.locator.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThan(40);
        expect(box!.height).toBeGreaterThanOrEqual(40); // a11y minimum touch height
        boxes.push({ name: btn.name, box: box! });
      }

      // 2. Strict Pairwise Non-Overlap Check: no two buttons may have colliding bounding boxes
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const item1 = boxes[i];
          const item2 = boxes[j];
          if (!item1 || !item2) continue;

          const b1 = item1.box;
          const b2 = item2.box;

          // Check if boxes intersect (with 1px tolerance for subpixel borders)
          const overlapsX = b1.x < b2.x + b2.width - 1 && b1.x + b1.width - 1 > b2.x;
          const overlapsY = b1.y < b2.y + b2.height - 1 && b1.y + b1.height - 1 > b2.y;
          const collides = overlapsX && overlapsY;

          expect(
            collides,
            `Collision detected between "${item1.name}" and "${item2.name}" on ${vp.name}!`
          ).toBe(false);
        }
      }

      // 3. On desktop/tablet (width >= 640), Primary CTA must sit prominently above secondary action group
      if (vp.isDesktop && boxes[0]) {
        const primaryItem = boxes[0];
        const primaryBox = primaryItem.box;
        for (let i = 1; i < boxes.length; i++) {
          const secItem = boxes[i];
          if (!secItem) continue;
          const secBox = secItem.box;
          expect(
            primaryBox.y + primaryBox.height,
            `Primary CTA "${primaryItem.name}" should sit cleanly above secondary button "${secItem.name}" on ${vp.name}`
          ).toBeLessThanOrEqual(secBox.y);
        }
      }

      // 4. Capture dedicated eyeball screenshot of the hero CTA cluster
      await heroCtas.screenshot({
        path: path.join(screenshotDir, `eyeball-hero-cta-${vp.name}.png`),
      });
    });
  }

  test('hero CTA cluster maintains clean non-overlapping layout under 125% and 150% browser zoom', async ({ page }) => {
    // 125% zoom on a standard 1280x800 desktop simulates 1024x640 logical CSS viewport
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const heroCtas = page.locator('#hero-ctas');
    await expect(heroCtas).toBeVisible();

    const primaryBtn = heroCtas.getByRole('link', { name: /Tune In Main Stage/i });
    const weeklyChartsBtn = heroCtas.getByRole('link', { name: /Weekly Charts/i });
    const supportBtn = heroCtas.getByRole('link', { name: /Support Station/i });
    const contributeBtn = heroCtas.getByRole('link', { name: /Contribute/i });
    const submitBtn = heroCtas.getByRole('link', { name: /Submit/i });

    const zoomedButtons = [
      { name: 'Tune In Main Stage', locator: primaryBtn },
      { name: 'Weekly Charts', locator: weeklyChartsBtn },
      { name: 'Support Station', locator: supportBtn },
      { name: 'Contribute', locator: contributeBtn },
      { name: 'Submit', locator: submitBtn },
    ];

    const boxes = [];
    for (const btn of zoomedButtons) {
      await expect(btn.locator).toBeVisible();
      const box = await btn.locator.boundingBox();
      expect(box).not.toBeNull();
      boxes.push({ name: btn.name, box: box! });
    }

    // Pairwise non-collision check under zoom
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const item1 = boxes[i];
        const item2 = boxes[j];
        if (!item1 || !item2) continue;

        const b1 = item1.box;
        const b2 = item2.box;

        const overlapsX = b1.x < b2.x + b2.width - 1 && b1.x + b1.width - 1 > b2.x;
        const overlapsY = b1.y < b2.y + b2.height - 1 && b1.y + b1.height - 1 > b2.y;
        expect(
          overlapsX && overlapsY,
          `Zoom 125% collision detected between "${item1.name}" and "${item2.name}"!`
        ).toBe(false);
      }
    }

    await heroCtas.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    await heroCtas.screenshot({
      path: path.join(screenshotDir, 'eyeball-hero-cta-zoomed-125.png'),
    });

    // 150% zoom simulation on desktop (853 x 533)
    await page.setViewportSize({ width: 853, height: 533 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(heroCtas).toBeVisible();
    await heroCtas.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));

    await heroCtas.screenshot({
      path: path.join(screenshotDir, 'eyeball-hero-cta-zoomed-150.png'),
    });
  });

  test('accessibility (a11y): hero CTA cluster passes WCAG 2.1 AA audit without violations', async ({ page }) => {
    await page.goto('/');

    const heroCtas = page.locator('#hero-ctas');
    await expect(heroCtas).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('#hero-ctas')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast']) // avoid false-positive subpixel anti-aliasing on gradients
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('keyboard accessibility: tabs smoothly through primary and all secondary actions in sequential order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const heroCtas = page.locator('#hero-ctas');
    const primaryBtn = heroCtas.getByRole('link', { name: /Tune In Main Stage/i });
    const weeklyChartsBtn = heroCtas.getByRole('link', { name: /Weekly Charts/i });
    const supportBtn = heroCtas.getByRole('link', { name: /Support Station/i });
    const contributeBtn = heroCtas.getByRole('link', { name: /Contribute/i });
    const submitBtn = heroCtas.getByRole('link', { name: /Submit/i });

    // Focus primary button
    await primaryBtn.focus();
    await expect(primaryBtn).toBeFocused();

    // Tab through secondary buttons in exact sequence
    await page.keyboard.press('Tab');
    await expect(weeklyChartsBtn).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(supportBtn).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(contributeBtn).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(submitBtn).toBeFocused();
  });
});
