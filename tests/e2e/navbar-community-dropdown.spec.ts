import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openDropdown(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  const nav = page.locator('nav').first();
  const trigger = nav.getByRole('button', { name: /Community/i });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  // The panel is the nearest container holding the "Station & Platform" heading
  const panel = nav
    .locator('div')
    .filter({ has: page.getByText('Station & Platform', { exact: true }) })
    .filter({ has: page.getByText('Community Bridges', { exact: true }) })
    .last();
  await expect(panel).toBeVisible();
  return { nav, trigger, panel };
}

test.describe('Navbar Community dropdown (desktop 1280x720)', () => {
  test('panel has an opaque background and is topmost over page content', async ({ page }) => {
    const { panel } = await openDropdown(page);
    // let the fade/zoom-in animation settle
    await page.waitForTimeout(400);

    const bg = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);
    const m = bg.match(/rgba?\(([^)]+)\)/);
    const parts = (m?.[1] ?? '0,0,0,0').split(/[,/\s]+/).filter(Boolean).map(Number);
    const alpha = parts[3] ?? 1;
    expect.soft(alpha, `panel background-color was "${bg}"`).toBeGreaterThan(0.9);

    const box = (await panel.boundingBox())!;
    const bridges = page.getByText('Community Bridges', { exact: true });
    const bridgesBox = (await bridges.boundingBox())!;
    const points = [
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      { x: bridgesBox.x + bridgesBox.width / 2, y: bridgesBox.y + bridgesBox.height / 2 },
      { x: box.x + box.width - 6, y: box.y + box.height - 6 },
    ];
    for (const p of points) {
      const inside = await panel.evaluate(
        (el, pt) => {
          const top = document.elementFromPoint(pt.x, pt.y);
          return !!top && el.contains(top);
        },
        p,
      );
      expect(inside, `topmost element at (${Math.round(p.x)},${Math.round(p.y)}) is outside the panel`).toBe(true);
    }
  });

  test('trigger aria-controls points at the panel id and aria-expanded toggles', async ({ page }) => {
    const { trigger, panel } = await openDropdown(page);

    const controls = await trigger.getAttribute('aria-controls');
    expect(controls, 'trigger has no aria-controls').toBeTruthy();
    const panelId = await panel.getAttribute('id');
    expect(panelId, 'panel has no id').toBeTruthy();
    expect(controls).toBe(panelId);

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('Escape closes the panel and returns focus to the trigger', async ({ page }) => {
    const { trigger, panel } = await openDropdown(page);

    // Move focus into the panel first, as a keyboard user would
    await panel.getByRole('link', { name: /About PromptFM/i }).focus();
    await page.keyboard.press('Escape');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('tabbing out of the last item closes the panel', async ({ page }) => {
    const { trigger, panel } = await openDropdown(page);

    const last = panel.getByRole('link', { name: /^X$/ });
    await last.focus();
    await expect(last).toBeFocused();
    await page.keyboard.press('Tab');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
  });

  test('axe scan of the open dropdown has no violations', async ({ page }) => {
    const { nav } = await openDropdown(page);
    await page.waitForTimeout(400);

    const results = await new AxeBuilder({ page })
      .include('nav')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const summary = results.violations.map(
      (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`,
    );
    expect(summary, `axe violations:\n${summary.join('\n')}`).toEqual([]);
    await expect(nav).toBeVisible();
  });

  test('decorative SVG icons inside the panel are aria-hidden', async ({ page }) => {
    const { panel } = await openDropdown(page);

    const offenders = await panel.evaluate((el) =>
      Array.from(el.querySelectorAll('svg'))
        .filter((svg) => svg.getAttribute('aria-hidden') !== 'true' && !svg.getAttribute('aria-label') && !svg.querySelector('title'))
        .map((svg) => svg.getAttribute('class') || svg.outerHTML.slice(0, 60)),
    );
    expect(offenders, 'SVGs without aria-hidden="true"').toEqual([]);
  });
});
