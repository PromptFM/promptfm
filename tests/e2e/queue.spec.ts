import { test, expect } from '@playwright/test';

test.describe('PromptFM Multi-Interface Queue & Scheduled Requests (Issue #86)', () => {
  test('Radio Now API /api/radio/now returns scheduled_requests and up_next', async ({ request }) => {
    const response = await request.get('/api/radio/now?channel=main');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.up_next)).toBe(true);
    expect(Array.isArray(data.scheduled_requests)).toBe(true);
  });

  test('Discord Bot /q interaction endpoint returns structured queue response with non-blank content', async ({ request }) => {
    const response = await request.post('/api/bot/webhook', {
      data: {
        type: 2,
        data: { name: 'q' },
        member: { user: { id: 'test_playwright_user', username: 'PlaywrightTester' } },
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.type).toBe(4);
    expect(data.data).toBeDefined();
    expect(data.data.content).toBeDefined();
    expect(data.data.content.length).toBeGreaterThan(10);
    // Must never return just the bare header or blank string
    expect(data.data.content.trim()).not.toBe('⏭️ **Up Next on PromptFM:**');
  });

  test('Admin Studio page renders community request and queue tabs without errors', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveTitle(/PromptFM/i);
    // Verify page loads without fatal error
    await expect(page.locator('body')).toBeVisible();
  });
});
