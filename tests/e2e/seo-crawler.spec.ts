import { test, expect } from '@playwright/test';

test.describe('SEO & Search Crawler Compliance Endpoints', () => {
  test('serves dynamic robots.txt pointing to sitemap.xml', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('User-Agent: *');
    expect(body).toContain('Allow: /');
    expect(body).toContain('Disallow: /admin');
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Sitemap: https://promptfm.live/sitemap.xml');
  });

  test('serves dynamic sitemap.xml with canonical URLs', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('<loc>https://promptfm.live</loc>');
    expect(body).toContain('<loc>https://promptfm.live/status</loc>');
    expect(body).toContain('<loc>https://promptfm.live/channels</loc>');
    expect(body).toContain('<loc>https://promptfm.live/top</loc>');
  });

  test('serves Google site verification HTML file at root', async ({ request }) => {
    const response = await request.get('/google3484fcd19afd4e82.html');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('google-site-verification: google3484fcd19afd4e82.html');
  });

  test('serves PWA web app manifest with required icon assets', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toContain('PromptFM');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(1);
  });
});
