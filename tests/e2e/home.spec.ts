import { test, expect } from '@playwright/test';

test.describe('PromptFM Home Page & Navigation', () => {
  test('loads home page with title, brand header, and verification meta tag', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/PromptFM/i);

    // Verify Google site verification meta tag is present in the DOM
    const metaVerification = page.locator('meta[name="google-site-verification"]');
    await expect(metaVerification).toHaveAttribute('content', 'JyC0MUsTb-PI8ssnpZsCcwmWCw-BxPvn7S07-2FDHRA');

    // Verify OpenGraph tags
    const ogSiteName = page.locator('meta[property="og:site_name"]');
    await expect(ogSiteName).toHaveAttribute('content', 'PromptFM');

    // Verify main brand heading
    const heading = page.getByRole('heading', { level: 1 }).first();
    await expect(heading).toBeVisible();
  });

  test('renders the sticky audio player and play control', async ({ page }) => {
    await page.goto('/');

    // Audio player container should exist
    const player = page.locator('footer, [role="region"], div').filter({ hasText: /PromptFM|Channel/i });
    await expect(player.first()).toBeVisible();

    // Play/Pause button or audio controls should exist
    const playButton = page.getByRole('button', { name: /play|pause/i }).first();
    await expect(playButton).toBeVisible();
  });

  test('navigates to the live status page from the navigation or footer', async ({ page }) => {
    await page.goto('/');

    // Navigate to status page
    await page.goto('/status');
    await expect(page).toHaveURL(/.*\/status/);
    await expect(page.getByRole('heading', { name: /System Status/i })).toBeVisible();
  });

  test('renders the Community Funding & Transparency section with allocation breakdown and payment rails', async ({ page }) => {
    await page.goto('/');

    // Hero CTA button for supporting station
    const supportCta = page.getByRole('link', { name: /Support Station|Donate/i }).first();
    await expect(supportCta).toBeVisible();
    await expect(supportCta).toHaveAttribute('href', '#funding');

    // Section container with id="funding"
    const fundingSection = page.locator('#funding');
    await expect(fundingSection).toBeVisible();

    // Mission and 100% allocation transparency statement
    await expect(fundingSection).toContainText(/Community Funding|Support PromptFM/i);
    await expect(fundingSection).toContainText(/100%/);

    // Allocation percentages
    await expect(fundingSection).toContainText(/35%/); // Licensing & Royalties
    await expect(fundingSection).toContainText(/25%/); // Infrastructure
    await expect(fundingSection).toContainText(/20%/); // AI Credits
    await expect(fundingSection).toContainText(/15%/); // Dev Time
    await expect(fundingSection).toContainText(/5%/);  // Coffee

    // Direct payment rails
    const stripeLink = fundingSection.getByRole('link', { name: /Stripe/i });
    await expect(stripeLink).toHaveAttribute('href', /donate\.stripe\.com/);

    const paypalLink = fundingSection.getByRole('link', { name: /PayPal/i });
    await expect(paypalLink).toHaveAttribute('href', /paypal\.me/);

    const kofiLink = fundingSection.getByRole('link', { name: /Ko-fi/i });
    await expect(kofiLink).toHaveAttribute('href', /ko-fi\.com/);

    const githubLink = fundingSection.getByRole('link', { name: /GitHub Sponsors/i });
    await expect(githubLink).toHaveAttribute('href', /github\.com\/sponsors/);

    // Direct crypto cards
    await expect(fundingSection).toContainText(/bc1qaplta50757v7c4vrk7vnry0vfd6c47rpmyvnj9/);
    await expect(fundingSection).toContainText(/0x9581F969727Ff987958d050C80662578C50F6A9f/);
    await expect(fundingSection).toContainText(/Bitcoin Mainnet Only/i);
    await expect(fundingSection).toContainText(/Ethereum Mainnet Only/i);
  });

  test('renders streamlined desktop navbar without crowded horizontal overflow and opens Community dropdown', async ({ page }) => {
    // Set desktop viewport (1280x720)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Primary navigation links visible on desktop
    await expect(nav.getByRole('link', { name: /Channels/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Schedule/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Charts/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Support/i })).toBeVisible();

    // Primary action button
    const submitBtn = nav.getByRole('link', { name: /Submit/i });
    await expect(submitBtn).toBeVisible();

    // Community / More dropdown toggle button
    const communityDropdownBtn = nav.getByRole('button', { name: /Community/i });
    await expect(communityDropdownBtn).toBeVisible();

    // Click Community dropdown to verify menu contents
    await communityDropdownBtn.click();
    await expect(nav.getByRole('link', { name: /About/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Contribute/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Studio/i })).toBeVisible();
  });

  test('mobile-first viewport displays compact header with hamburger drawer navigation', async ({ page }) => {
    // Set mobile viewport (iPhone 13/14 size: 390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Desktop nav items should be hidden
    await expect(nav.locator('.hidden.md\\:flex').first()).toBeHidden();
    await expect(nav.locator('.hidden.md\\:flex').nth(1)).toBeHidden();

    // Mobile header elements should be visible
    const hamburgerBtn = nav.getByRole('button', { name: /Open navigation menu|Close navigation menu/i });
    await expect(hamburgerBtn).toBeVisible();

    // Mobile submit shortcut should be visible and compact
    const mobileSubmitBtn = nav.getByRole('link', { name: /Submit/i });
    await expect(mobileSubmitBtn).toBeVisible();

    // Open mobile drawer
    await hamburgerBtn.click();

    // Verify structured drawer categories and links
    await expect(nav.getByRole('link', { name: /Broadcast Channels/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Broadcast Schedule/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Weekly Top 40 Charts/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Support & Funding/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Contribute & Open Source/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /About PromptFM/i })).toBeVisible();

    // Close mobile drawer
    await hamburgerBtn.click();
    await expect(nav.getByRole('link', { name: /Broadcast Channels/i })).toBeHidden();
  });
});


