import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), 'tests/e2e/screenshots');

const nowPlayingPayload = {
  success: true,
  channel: 'main',
  now_playing: {
    id: 'vote-track-190',
    type: 'music',
    title: 'Lone Star Melody',
    artist: 'Synth Solitary',
    cover_art_url: '/logo-mark.png',
    tool_used: 'Suno',
    upvotes_count: 24,
  },
  up_next: [],
  listeners_count: 12,
  listeners: { channel: 12, network_total: 40, active_channels_count: 1 },
  active_dj: { id: 'dj_neon', name: 'DJ Neon', title: 'Morning Host' },
  elapsed_seconds: 10,
  duration_seconds: 180,
  started_at: new Date().toISOString(),
};

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

    const cta = ribbon.getByRole('link', { name: /Submit Your Track/i });
    const descBox = box!;
    const ctaBox = await cta.boundingBox();
    expect(ctaBox).not.toBeNull();
    if (ctaBox) {
      expect(descBox.x + descBox.width).toBeLessThanOrEqual(ctaBox.x + 8);
    }

    await ribbon.screenshot({
      path: path.join(screenshotDir, 'desktop-sponsor-ribbon-issue-205.png'),
    });

    const results = await new AxeBuilder({ page }).include('[aria-label="Sponsor Announcement"]').analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('Issue #190: player quick vote accessibility', () => {
  test('exposes pressed state on the vote control when a track is on air', async ({ page }) => {
    await page.route('**/api/radio/now*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(nowPlayingPayload),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const player = page.getByRole('region', { name: /Live radio player/i });
    await expect(player).toBeVisible({ timeout: 15000 });

    const voteButton = player.getByRole('button', { name: /Upvote track/i });
    await expect(voteButton).toBeVisible();
    await expect(voteButton).toHaveAttribute('aria-pressed', 'false');

    await player.screenshot({
      path: path.join(screenshotDir, 'desktop-player-vote-issue-190.png'),
    });

    const results = await new AxeBuilder({ page }).include('[aria-label="Live radio player"]').analyze();
    expect(results.violations.filter((v) => v.id !== 'color-contrast')).toEqual([]);
  });
});
