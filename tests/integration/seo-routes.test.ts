// tests/integration/seo-routes.test.ts
// Integration tests for Next.js App Router metadata route generators (robots, sitemap, manifest)

import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import manifest from '@/app/manifest';
import { siteMetadata } from '@/lib/seo/site-metadata';
import { generateRadioStationJsonLd } from '@/lib/seo/structured-data';

describe('Next.js App Router Metadata Routes Integration', () => {
  it('siteMetadata includes valid Google and search engine site verification tokens', () => {
    expect(siteMetadata.verification).toBeDefined();
    expect(siteMetadata.verification?.google).toBe('JyC0MUsTb-PI8ssnpZsCcwmWCw-BxPvn7S07-2FDHRA');
  });

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

    // Static routes
    expect(urls).toContain('https://promptfm.live/status');
    expect(urls).toContain('https://promptfm.live/terms');
    expect(urls).toContain('https://promptfm.live/privacy');
    expect(urls).toContain('https://promptfm.live/dmca');

    // Theme radio channel URLs
    expect(urls).toContain('https://promptfm.live/channels?channel=main');
    expect(urls).toContain('https://promptfm.live/channels?channel=cyberpunk');
    expect(urls).toContain('https://promptfm.live/channels?channel=chillout');
    expect(urls).toContain('https://promptfm.live/channels?channel=kids');
    expect(urls).toContain('https://promptfm.live/channels?channel=afterdark');

    // Every entry must have valid priority, frequency, and HTTPS URL
    result.forEach((entry) => {
      expect(entry.url).toMatch(/^https:\/\/promptfm\.live/);
      expect(entry.priority).toBeGreaterThanOrEqual(0.1);
      expect(entry.priority).toBeLessThanOrEqual(1.0);
      expect(['hourly', 'daily', 'weekly', 'monthly']).toContain(entry.changeFrequency);
    });

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

  it('generateRadioStationJsonLd() produces compliant Schema.org RadioStation JSON-LD for Google', () => {
    const jsonLd = generateRadioStationJsonLd();
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('RadioStation');
    expect(jsonLd.name).toBe('PromptFM');
    expect(jsonLd.url).toBe('https://promptfm.live');
    expect(jsonLd.broadcastDisplayName).toBe('PromptFM AI Radio');
    expect(jsonLd.potentialAction).toBeDefined();
  });
});
