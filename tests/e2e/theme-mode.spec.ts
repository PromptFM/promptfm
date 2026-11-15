import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), 'tests/e2e/screenshots');

test.describe('Issue #82 light and dark mode', () => {
  test('toggles the document theme, persists it, and stays accessible', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('theme-82-seeded')) {
        localStorage.setItem('promptfm_theme', 'dark');
        sessionStorage.setItem('theme-82-seeded', '1');
      }
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const toggle = page.getByRole('button', { name: 'Switch to light mode' });
    await expect(toggle).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, 'theme-82-dark.png'),
      fullPage: false,
    });

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, 'theme-82-light.png'),
      fullPage: false,
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const results = await new AxeBuilder({ page }).include('nav').analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious).toEqual([]);
  });
});
