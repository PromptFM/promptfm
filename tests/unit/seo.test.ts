// tests/unit/seo.test.ts
// Unit tests for SEO, Robots, Sitemap, Manifest, and Schema.org Structured Data

import { describe, it, expect } from 'vitest';
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  generateRobotsConfig,
  generateSitemapUrls,
  generateRadioStationJsonLd,
  generateWebSiteJsonLd,
} from '@/lib/seo/structured-data';

describe('SEO & Structured Data Service', () => {
  it('defines the correct canonical production site metadata constants', () => {
    expect(SITE_URL).toBe('https://promptfm.live');
    expect(SITE_NAME).toBe('PromptFM');
    expect(SITE_TAGLINE).toBe('24/7 AI Music Radio & Charts');
    expect(SITE_DESCRIPTION).toContain('Stream 24/7 live AI-generated music radio');
  });

  describe('generateRobotsConfig', () => {
    it('generates compliant robots.txt rules allowing public pages and disallowing admin and api', () => {
      const robotsConfig = generateRobotsConfig();
      expect(robotsConfig).toHaveProperty('rules');
      expect(robotsConfig).toHaveProperty('sitemap', 'https://promptfm.live/sitemap.xml');
      expect(robotsConfig).toHaveProperty('host', 'https://promptfm.live');

      const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules : [robotsConfig.rules];
      expect(rules.length).toBe(2);

      const mainRule = rules.find((r) => r.userAgent === '*');
      expect(mainRule).toBeDefined();
      expect(mainRule?.allow).toEqual(['/']);
      expect(mainRule?.disallow).toEqual(['/admin', '/api/']);

      const imageRule = rules.find((r) => r.userAgent === 'Googlebot-Image');
      expect(imageRule).toBeDefined();
      expect(imageRule?.allow).toEqual(['/', '/icon.png', '/logo-mark.png', '/opengraph-image']);
    });
  });

  describe('generateSitemapUrls', () => {
    it('generates complete sitemap items with canonical URLs, change frequencies, and priorities', () => {
      const testDate = new Date('2026-11-03T00:00:00Z');
      const sitemap = generateSitemapUrls(testDate);
      expect(sitemap.length).toBe(8);

      const urls = sitemap.map((s) => s.url);
      expect(urls).toContain('https://promptfm.live');
      expect(urls).toContain('https://promptfm.live/channels');
      expect(urls).toContain('https://promptfm.live/top');
      expect(urls).toContain('https://promptfm.live/submit');

      const homeEntry = sitemap.find((s) => s.url === 'https://promptfm.live');
      expect(homeEntry?.priority).toBe(1.0);
      expect(homeEntry?.changeFrequency).toBe('hourly');
      expect(homeEntry?.lastModified).toBe(testDate);

      const channelsEntry = sitemap.find((s) => s.url === 'https://promptfm.live/channels');
      expect(channelsEntry?.priority).toBe(0.9);
      expect(channelsEntry?.changeFrequency).toBe('daily');
      expect(channelsEntry?.lastModified).toBe(testDate);

      const topEntry = sitemap.find((s) => s.url === 'https://promptfm.live/top');
      expect(topEntry?.priority).toBe(0.9);
      expect(topEntry?.changeFrequency).toBe('daily');
      expect(topEntry?.lastModified).toBe(testDate);

      const submitEntry = sitemap.find((s) => s.url === 'https://promptfm.live/submit');
      expect(submitEntry?.priority).toBe(0.7);
      expect(submitEntry?.changeFrequency).toBe('monthly');
      expect(submitEntry?.lastModified).toBe(testDate);

      // Channel deep links
      ['main', 'cyberpunk', 'chillout', 'kids'].forEach((slug) => {
        const chEntry = sitemap.find((s) => s.url === `https://promptfm.live/channels?channel=${slug}`);
        expect(chEntry).toBeDefined();
        expect(chEntry?.priority).toBe(0.8);
        expect(chEntry?.changeFrequency).toBe('daily');
        expect(chEntry?.lastModified).toBe(testDate);
      });
    });

    it('defaults to current timestamp if now argument is omitted', () => {
      const sitemap = generateSitemapUrls();
      expect(sitemap[0]?.lastModified).toBeInstanceOf(Date);
    });
  });

  describe('generateRadioStationJsonLd', () => {
    it('generates valid Schema.org RadioStation JSON-LD structured data', () => {
      const jsonLd = generateRadioStationJsonLd();
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('RadioStation');
      expect(jsonLd.name).toBe('PromptFM');
      expect(jsonLd.url).toBe('https://promptfm.live');
      expect(jsonLd.logo).toBe('https://promptfm.live/logo-mark.png');
      expect(jsonLd.image).toBe('https://promptfm.live/logo-mark.png');
      expect(jsonLd.description).toBe(SITE_DESCRIPTION);
      expect(jsonLd.broadcastDisplayName).toBe('PromptFM AI Radio');
      expect(jsonLd.broadcastFrequency).toBe('Online 24/7 Live Stream');
      expect(jsonLd.genre).toEqual(['AI Music', 'Cyberpunk', 'Ambient', 'Synthwave', 'Electronic']);

      expect(jsonLd.potentialAction).toEqual({
        '@type': 'ListenAction',
        target: [
          {
            '@type': 'EntryPoint',
            urlTemplate: 'https://promptfm.live',
            actionPlatform: [
              'http://schema.org/DesktopWebPlatform',
              'http://schema.org/MobileWebPlatform',
            ],
          },
        ],
        expectsAcceptanceOf: {
          '@type': 'Offer',
          category: 'free',
          price: '0',
          priceCurrency: 'USD',
        },
      });
    });
  });

  describe('generateWebSiteJsonLd', () => {
    it('generates valid Schema.org WebSite JSON-LD structured data', () => {
      const jsonLd = generateWebSiteJsonLd();
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('WebSite');
      expect(jsonLd.name).toBe('PromptFM');
      expect(jsonLd.url).toBe('https://promptfm.live');
      expect(jsonLd.description).toBe(SITE_DESCRIPTION);
      expect(jsonLd.potentialAction).toEqual({
        '@type': 'SearchAction',
        target: 'https://promptfm.live/top?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      });
    });
  });
});
