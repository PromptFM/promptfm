import { test, expect } from '@playwright/test';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), 'tests/e2e/screenshots');

test.describe('Issue #205: creator spotlight sponsor ribbon layout', () => {
  test('shows full creator copy on desktop without clipping and captures ribbon screenshot', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const ribbon = page.getByRole('complementary', { name: 'Sponsor Announcement' });
    await expect(ribbon).toBeVisible();

    const description = ribbon.getByText(/Transform prompts into studio tracks/i);
    await expect(description).toBeVisible();

    const box = await description.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(320);
    }

    await ribbon.screenshot({
      path: path.join(screenshotDir, 'desktop-sponsor-ribbon-issue-205.png'),
    });
  });
});

test.describe('Issue #190: player quick vote accessibility', () => {
  test('exposes pressed state on the vote control when marked voted', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const player = page.getByRole('region', { name: /Live radio player/i });
    await expect(player).toBeVisible({ timeout: 15000 });

    const voteButton = player.getByRole('button', { name: /upvote track|upvoted/i });
    await expect(voteButton).toBeVisible();
    await expect(voteButton).toHaveAttribute('aria-pressed');
  });
});