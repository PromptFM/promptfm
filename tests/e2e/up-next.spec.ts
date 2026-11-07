import { test, expect } from '@playwright/test';

test.describe('Issue #84: Up Next Widgets & Accessibility (E2E)', () => {
  test('UpNextSection handles "only now playing exists" without broken 3-column empty space', async ({ page }) => {
    // Intercept /api/radio/now to guarantee the exact issue #84 state:
    // Station has an active track on air, but ZERO queued upcoming tracks.
    await page.route('**/api/radio/now*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          channel: 'main',
          now_playing: {
            id: 'solo-now-playing-123',
            type: 'music',
            title: 'Lone Star Melody',
            artist: 'Synth Solitary',
            cover_art_url: '/logo-mark.png',
            tool_used: 'Suno',
            upvotes_count: 24,
            rank: 1,
            total_approved_tracks: 5,
          },
          up_next: [],
          listeners_count: 42,
          listeners: { channel: 42, network_total: 100, active_channels_count: 5 },
          active_dj: {
            id: 'dj_neon',
            name: 'DJ Neon',
            title: 'Morning Host',
          },
          elapsed_seconds: 45,
          duration_seconds: 180,
          started_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/');

    // Locate the section
    const section = page.locator('section[aria-label="Live airplay and broadcast queue"]');
    await expect(section).toBeVisible();

    // Verify copy switched from "Up Next on Air" to "Now on Air"
    await expect(section.getByRole('heading', { level: 2 })).toContainText('Now on Air');

    // Verify status indicator shows queue is standing by
    await expect(section).toContainText(/Queue Standing By/i);

    // Verify the on-air track card is visible and accessible
    const onAirArticle = section.locator('article[aria-label*="Currently playing: Lone Star Melody"]');
    await expect(onAirArticle).toBeVisible();
    await expect(onAirArticle).toContainText('Lone Star Melody');
    await expect(onAirArticle).toContainText('Synth Solitary');
    await expect(onAirArticle).toContainText('ON AIR');

    // Verify accessibility of on-air progress bar
    const progressbar = onAirArticle.locator('[role="progressbar"]');
    await expect(progressbar).toBeVisible();
    await expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    await expect(progressbar).toHaveAttribute('aria-valuemax', '100');

    // Verify the companion Queue Standing By card occupies the second column
    const standingByCard = section.locator('[data-testid="queue-standing-by-card"]');
    await expect(standingByCard).toBeVisible();
    await expect(standingByCard).toContainText('No upcoming tracks queued');
    await expect(standingByCard).toContainText(/automatically spin the next high-ranking track/i);

    // Verify actionable community engagement links
    const voteLink = standingByCard.getByRole('link', { name: /Vote on tracks/i });
    await expect(voteLink).toHaveAttribute('href', '/top');

    const submitLink = standingByCard.getByRole('link', { name: /Submit a track/i });
    await expect(submitLink).toHaveAttribute('href', '/submit');
  });

  test('AudioPlayer playbar Up Next popover accessibility and "now-playing-only" state', async ({ page }) => {
    // Intercept /api/radio/now with only now playing
    await page.route('**/api/radio/now*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          channel: 'main',
          now_playing: {
            id: 'solo-now-playing-456',
            type: 'music',
            title: 'Midnight Transmission',
            artist: 'Cyber Resident',
            cover_art_url: '/logo-mark.png',
            tool_used: 'Udio',
            upvotes_count: 15,
          },
          up_next: [],
          listeners_count: 18,
          listeners: { channel: 18, network_total: 50, active_channels_count: 5 },
          active_dj: { id: 'dj_neon', name: 'DJ Neon' },
          elapsed_seconds: 30,
          duration_seconds: 180,
          started_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/');

    // Check the toggle button accessibility attributes before clicking
    const queueToggleBtn = page.getByRole('button', { name: /Toggle Up Next airplay queue/i });
    await expect(queueToggleBtn).toBeVisible();
    await expect(queueToggleBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(queueToggleBtn).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(queueToggleBtn).toHaveAttribute('aria-controls', 'player-queue-popover');

    // Click toggle button to open popover
    await queueToggleBtn.click();
    await expect(queueToggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Popover dialog must appear
    const popover = page.locator('#player-queue-popover');
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute('role', 'dialog');

    // Popover header should reflect live queue state
    await expect(popover).toContainText(/Live Queue on (PromptFM )?Main Stage/i);

    // Verify current track is labeled as ON AIR
    await expect(popover).toContainText('Midnight Transmission');
    await expect(popover).toContainText('Cyber Resident');
    await expect(popover).toContainText('ON AIR');

    // Verify the explicit standing-by message is present
    const standingBy = popover.locator('[data-testid="player-queue-standing-by"]');
    await expect(standingBy).toBeVisible();
    await expect(standingBy).toContainText('No upcoming tracks queued');
    await expect(standingBy).toContainText(/Automated rotation will select the next track/i);

    // Verify Schedule link is present
    const scheduleLink = popover.getByRole('link', { name: /Full 24-Hour Broadcast Schedule/i });
    await expect(scheduleLink).toBeVisible();

    // Close popover using the close button
    const closeBtn = popover.getByRole('button', { name: /Close queue popover/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await expect(popover).toBeHidden();
    await expect(queueToggleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('UpNextSection renders active upcoming queue when tracks exist', async ({ page }) => {
    // Intercept /api/radio/now with multiple upcoming tracks
    await page.route('**/api/radio/now*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          channel: 'main',
          now_playing: {
            id: 'now-track-1',
            type: 'music',
            title: 'Current Groove',
            artist: 'Groove Master',
            cover_art_url: '/logo-mark.png',
          },
          up_next: [
            { id: 'next-track-1', title: 'Next Banger', artist: 'Beat Maker' },
            { id: 'next-track-2', title: 'Third Track', artist: 'Future Sounds' },
          ],
          listeners_count: 50,
          listeners: { channel: 50, network_total: 150, active_channels_count: 5 },
          active_dj: { id: 'dj_neon', name: 'DJ Neon' },
          elapsed_seconds: 60,
          duration_seconds: 180,
          started_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/');

    const section = page.locator('section[aria-label="Live airplay and broadcast queue"]');
    await expect(section).toBeVisible();

    // Header says "Up Next on Air" when upcoming tracks exist
    await expect(section.getByRole('heading', { level: 2 })).toContainText('Up Next on Air');
    await expect(section).toContainText(/Live Airplay Queue/i);

    // Shows cards for now playing and upcoming
    await expect(section).toContainText('Current Groove');
    await expect(section).toContainText('Next Banger');
    await expect(section).toContainText('Third Track');
    await expect(section).toContainText('#1 NEXT');
    await expect(section).toContainText('#2 NEXT');
  });
});
