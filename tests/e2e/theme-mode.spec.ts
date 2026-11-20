import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), 'tests/e2e/screenshots');

test.describe('Issues #234-#241 Light, Dark, System Theme and WCAG Accessibility', () => {
  test('supports three-way theme toggle (system -> light -> dark -> system), persists preference, and meets WCAG AA in both modes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for hydration to initialize theme attributes
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');

    // Initial state: default system preference (renders dark in headless default environment)
    const toggle = page.locator('nav').getByRole('button', { name: /switch to/i }).first();
    await expect(toggle).toBeVisible();

    // 1. Cycle to Light Mode
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    // Allow smooth theme transition to complete before running accessibility contrast checks
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(screenshotDir, 'theme-240-light.png'),
      fullPage: false,
    });

    // Verify persistence across reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.waitForTimeout(300);

    // ── Axe Scan in Light Mode on Affected Home Page Zones ───────────────────
    // Tests: Section containers (#234), Hero Support Station (#236), Channels Grid (#237), Audio Player (#238)
    const lightHomeAxe = await new AxeBuilder({ page })
      .include('nav')
      .include('[data-testid="hero-secondary-cta-group"]')
      .include('#channels')
      .include('#funding')
      .include('#contribute')
      .include('[aria-label="Live radio player"]')
      .analyze();

    const lightHomeViolations = lightHomeAxe.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(lightHomeViolations).toEqual([]);

    // ── Issue #235: Navbar Dropdown Hover in Light Mode ─────────────────────
    const communityDropdown = page.locator('nav button:has-text("Community")');
    if (await communityDropdown.isVisible()) {
      await communityDropdown.click();
      const studioLink = page.getByRole('link', { name: /station studio/i });
      if (await studioLink.isVisible()) {
        await studioLink.hover();
        const lightNavAxe = await new AxeBuilder({ page })
          .include('nav')
          .analyze();
        const lightNavViolations = lightNavAxe.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical'
        );
        expect(lightNavViolations).toEqual([]);
      }
    }

    // ── Issue #238: Up Next Queue Popover in Light Mode ─────────────────────
    const upNextBtn = page.getByRole('button', { name: /up next/i }).first();
    if (await upNextBtn.isVisible()) {
      await upNextBtn.click();
      const popover = page.locator('[data-testid="upnext-popover"]');
      if (await popover.isVisible()) {
        const upNextAxe = await new AxeBuilder({ page })
          .include('[data-testid="upnext-popover"]')
          .analyze();
        const upNextViolations = upNextAxe.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical'
        );
        expect(upNextViolations).toEqual([]);
      }
    }

    // ── 2. Cycle to Dark Mode ───────────────────────────────────────────────
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(screenshotDir, 'theme-240-dark.png'),
      fullPage: false,
    });

    // ── Axe Scan in Dark Mode on Affected Home Page Zones ────────────────────
    const darkHomeAxe = await new AxeBuilder({ page })
      .include('nav')
      .include('[data-testid="hero-secondary-cta-group"]')
      .include('#channels')
      .include('#funding')
      .include('#contribute')
      .include('[aria-label="Live radio player"]')
      .analyze();

    const darkHomeViolations = darkHomeAxe.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(darkHomeViolations).toEqual([]);

    // ── 3. Cycle to System Default ──────────────────────────────────────────
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  });

  test('Issue #239: /top, /library, and /status meet WCAG AA in light mode', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const route of ['/top', '/library', '/status']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('promptfm_theme', 'light');
        document.documentElement.dataset.theme = 'light';
        document.documentElement.dataset.themePreference = 'light';
        document.documentElement.style.colorScheme = 'light';
      });
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await page.waitForTimeout(300);

      const lightAxe = await new AxeBuilder({ page })
        .include('main')
        .analyze();
      const lightViolations = lightAxe.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      );
      expect(lightViolations).toEqual([]);
    }
  });

  test('Issue #239: /top, /library, and /status meet WCAG AA in dark mode', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const route of ['/top', '/library', '/status']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('promptfm_theme', 'dark');
        document.documentElement.dataset.theme = 'dark';
        document.documentElement.dataset.themePreference = 'dark';
        document.documentElement.style.colorScheme = 'dark';
      });
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

      const darkAxe = await new AxeBuilder({ page })
        .include('main')
        .analyze();
      const darkViolations = darkAxe.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      );
      expect(darkViolations).toEqual([]);
    }
  });
});
