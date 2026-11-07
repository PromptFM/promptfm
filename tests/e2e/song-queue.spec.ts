// tests/e2e/song-queue.spec.ts
// Playwright E2E test verifying live song queue airplay and ETA pathway (Issue #43)

import { test, expect } from '@playwright/test';

test.describe('Unified Song Queue & Live Airplay Pathway (Issue #43)', () => {
  test('serves the admin queue API with accurate positions and live ETAs', async ({ request }) => {
    const adminKey = process.env.ADMIN_API_KEY || 'promptfm-local-dev-key';
    const res = await request.get(`/api/admin/queue?channel=main&key=${adminKey}`, {
      headers: {
        Authorization: `Bearer ${adminKey}`,
        'x-admin-key': adminKey,
      },
    });
    expect(res.ok()).toBe(true);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.channelSlug).toBe('main');
    expect(typeof json.totalQueued).toBe('number');
    expect(Array.isArray(json.items)).toBe(true);

    // If items exist in the queue, verify each has position, track info, and formatted ETA
    if (json.items.length > 0) {
      const first = json.items[0];
      expect(first.position).toBe(1);
      expect(first.eta).toBeDefined();
      expect(first.eta.formattedETA).toContain('Up Next');
    }
  });

  test('renders the schedule page with 24/7 airplay information and community request showcase', async ({ page }) => {
    await page.goto('/schedule');

    // Page title and heading
    await expect(page).toHaveTitle(/Schedule|PromptFM/i);
    const scheduleHeading = page.getByRole('heading', { name: /Broadcast Schedule/i });
    await expect(scheduleHeading).toBeVisible();

    // Check presence of queue / request slot info
    const content = page.locator('body');
    await expect(content).toContainText(/Community|Queue|Song|Airplay/i);
  });
});
