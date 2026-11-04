import { test, expect } from '@playwright/test';

test.describe('PromptFM Live Status & Funding Dashboard', () => {
  test('displays operational health telemetry and latency metrics', async ({ page }) => {
    await page.goto('/status');

    // Title and Header
    await expect(page).toHaveTitle(/PromptFM/i);
    await expect(page.getByRole('heading', { name: /System Status/i })).toBeVisible();

    // Operational indicator badge
    await expect(page.locator('text=Operational').first()).toBeVisible();

    // 30-Day Uptime indicator
    await expect(page.getByText(/9\d\.\d+%/).first()).toBeVisible();

    // Component health items
    await expect(page.getByText(/Audio Streaming Engine/i).first()).toBeVisible();
    await expect(page.getByText(/PostgreSQL Database/i).first()).toBeVisible();
    await expect(page.getByText(/Generative AI DJ Roster/i).first()).toBeVisible();
  });

  test('displays transparent community funding model and payment rails', async ({ page }) => {
    await page.goto('/status');

    // Funding header
    await expect(page.locator('text=Transparent Community Funding').first()).toBeVisible();

    // Royalty and Infrastructure Breakdown percentages
    await expect(page.locator('text=35%').first()).toBeVisible(); // Music Licensing
    await expect(page.locator('text=25%').first()).toBeVisible(); // Streaming Infra
    await expect(page.locator('text=20%').first()).toBeVisible(); // AI Compute

    // Multi-rail buttons / links
    const stripeLink = page.locator('a[href*="stripe.com"]').first();
    await expect(stripeLink).toBeVisible();

    const paypalLink = page.locator('a[href*="paypal.me"]').first();
    await expect(paypalLink).toBeVisible();

    // Mainnet Only crypto badges
    await expect(page.locator('text=Bitcoin Mainnet Only').first()).toBeVisible();
    await expect(page.locator('text=Ethereum Mainnet Only').first()).toBeVisible();
  });
});
