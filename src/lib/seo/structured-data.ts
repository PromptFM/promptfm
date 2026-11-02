// src/lib/seo/structured-data.ts
// Centralized SEO configuration, metadata utilities, and Schema.org JSON-LD generators.

import { OFFICIAL_CHANNELS } from '@/lib/radio/channels';

export const SITE_URL = 'https://promptfm.live';
export const SITE_NAME = 'PromptFM';
export const SITE_TAGLINE = '24/7 AI Music Radio & Charts';
export const SITE_DESCRIPTION =
  'Stream 24/7 live AI-generated music radio across 4 genres curated by autonomous AI DJs. Vote on weekly community charts and discover tracks made with Suno, Udio, and Stable Audio.';

export interface RobotsRule {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
}

export interface RobotsConfig {
  rules: RobotsRule | RobotsRule[];
  sitemap: string;
  host: string;
}

export interface SitemapEntry {
  url: string;
  lastModified?: Date | string;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

/**
 * Returns the robots.txt configuration rules.
 */
export function generateRobotsConfig(): RobotsConfig {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: ['/admin', '/api/'],
      },
      {
        userAgent: 'Googlebot-Image',
        allow: ['/', '/icon.png', '/logo-mark.png', '/opengraph-image'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

/**
 * Generates the sitemap entries for all static and channel routes.
 */
export function generateSitemapUrls(now = new Date()): SitemapEntry[] {
  const staticRoutes: SitemapEntry[] = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/channels`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/top`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/submit`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/dmca`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/copyright`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  const channelRoutes: SitemapEntry[] = OFFICIAL_CHANNELS.map((ch) => ({
    url: `${SITE_URL}/channels?channel=${ch.slug}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  return [...staticRoutes, ...channelRoutes];
}

/**
 * Schema.org RadioStation structured data for Google Search rich results.
 */
export function generateRadioStationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'RadioStation',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo-mark.png`,
    image: `${SITE_URL}/logo-mark.png`,
    description: SITE_DESCRIPTION,
    genre: ['AI Music', 'Cyberpunk', 'Ambient', 'Synthwave', 'Electronic'],
    broadcastDisplayName: 'PromptFM AI Radio',
    broadcastFrequency: 'Online 24/7 Live Stream',
    potentialAction: {
      '@type': 'ListenAction',
      target: [
        {
          '@type': 'EntryPoint',
          urlTemplate: SITE_URL,
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
    },
  };
}

/**
 * Schema.org WebSite structured data with SearchAction potential action.
 */
export function generateWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/top?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

