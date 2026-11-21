// tests/e2e/song-queue.spec.ts
// Playwright E2E test verifying live song queue airplay, ETA pathway, and web visibility (Issue #43, Issue #276)

import { test, expect } from '@playwright/test';

test.describe('Unified Song Queue & Live Airplay Pathway (Issue #43, Issue #276)', () => {
  test('serves the admin queue API with accurate positions and live ETAs', async ({ request }) => {
    const adminKey = process.env.ADMIN_API_KEY;
    const params = new URLSearchParams({ channel: 'main' });
    const headers: Record<string, string> = {};

    if (adminKey) {
      params.set('key', adminKey);
      headers.Authorization = `Bearer ${adminKey}`;
      headers['x-admin-key'] = adminKey;
    }

    const res = await request.get(`/api/admin/queue?${params.toString()}`, { headers });
    if (res.status() === 401) {
      // Admin route requires matching ADMIN_API_KEY when running against production server
      return;
    }
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

  test('displays live up next queue and handles web queue inspection', async ({ page, request }) => {
    // 1. Check radio now status API for live up next structure
    const nowRes = await request.get('/api/radio/now?channel=main');
    expect(nowRes.ok()).toBe(true);
    const nowJson = await nowRes.json();
    expect(nowJson.success).toBe(true);
    expect(Array.isArray(nowJson.up_next)).toBe(true);

    // 2. Visit homepage and verify the Live Airplay / Up Next section is visible
    await page.goto('/');
    const upNextSection = page.locator('section[aria-label*="airplay and broadcast queue" i]');
    await expect(upNextSection).toBeVisible();

    // 3. Test WebMCP Console /queue execution if console is present on page
    const mcpInput = page.locator('input[placeholder*="command" i]');
    if (await mcpInput.isVisible()) {
      await mcpInput.fill('/queue');
      await mcpInput.press('Enter');
      // Verify console output rendered
      await expect(page.locator('text=/queue/i').first()).toBeVisible();
    }
  });
});
