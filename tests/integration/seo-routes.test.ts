// tests/integration/seo-routes.test.ts
// Integration tests for Next.js App Router metadata route generators (robots, sitemap, manifest)

import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import manifest from '@/app/manifest';

describe('Next.js App Router Metadata Routes Integration', () => {
  it('robots() generates valid Next.js Robots metadata', () => {
    const result = robots();
    expect(result).toHaveProperty('rules');
    expect(result.sitemap).toBe('https://promptfm.live/sitemap.xml');
    expect(result.host).toBe('https://promptfm.live');

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules.length).toBeGreaterThanOrEqual(1);

    const publicRule = rules.find((r) => r.userAgent === '*');
    expect(publicRule).toBeDefined();
    expect(publicRule?.allow).toContain('/');
    expect(publicRule?.disallow).toContain('/admin');
    expect(publicRule?.disallow).toContain('/api/');
  });

  it('sitemap() generates valid Next.js Sitemap metadata with all required canonical URLs', () => {
    const result = sitemap();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(8);

    const urls = result.map((r) => r.url);
    expect(urls).toContain('https://promptfm.live');
    expect(urls).toContain('https://promptfm.live/channels');
    expect(urls).toContain('https://promptfm.live/top');
    expect(urls).toContain('https://promptfm.live/submit');

    // Theme radio channel URLs
    expect(urls).toContain('https://promptfm.live/channels?channel=main');
    expect(urls).toContain('https://promptfm.live/channels?channel=cyberpunk');
    expect(urls).toContain('https://promptfm.live/channels?channel=chillout');
    expect(urls).toContain('https://promptfm.live/channels?channel=kids');

    // Priority checks
    const home = result.find((r) => r.url === 'https://promptfm.live');
    expect(home?.priority).toBe(1.0);
    expect(home?.changeFrequency).toBe('hourly');
  });

  it('manifest() generates valid PWA Web App Manifest with touch and maskable icons', () => {
    const result = manifest();
    expect(result.name).toContain('PromptFM');
    expect(result.short_name).toBe('PromptFM');
    expect(result.start_url).toBe('/');
    expect(result.display).toBe('standalone');
    expect(result.theme_color).toBe('#10b981');
    expect(result.background_color).toBe('#09090b');
    expect(result.icons?.length).toBeGreaterThanOrEqual(3);

    const maskableIcon = result.icons?.find((icon) => icon.purpose === 'maskable');
    expect(maskableIcon).toBeDefined();

    const appleIcon = result.icons?.find((icon) => icon.src.includes('apple-touch-icon'));
    expect(appleIcon).toBeDefined();
    expect(appleIcon?.sizes).toBe('180x180');
  });
});
