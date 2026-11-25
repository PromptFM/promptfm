// tests/unit/editorial-guides.test.ts
// Unit tests for PromptFM Editorial Guides, Curation Standards, and Structured Data.
// Enforces rich original content to resolve AdSense Low-Value Content and Thin Content policies.

import { describe, it, expect } from 'vitest';
import {
  EDITORIAL_GUIDES,
  getGuideBySlug,
  type EditorialGuide,
} from '@/lib/guides/guides-data';
import {
  generateArticleJsonLd,
  generateSitemapUrls,
} from '@/lib/seo/structured-data';

describe('Editorial Guides & AdSense Value Standards', () => {
  describe('EDITORIAL_GUIDES catalog', () => {
    it('defines comprehensive guides for prompt engineering, radio architecture, and editorial standards', () => {
      expect(EDITORIAL_GUIDES.length).toBeGreaterThanOrEqual(3);

      const slugs = EDITORIAL_GUIDES.map((g) => g.slug);
      expect(slugs).toContain('prompt-engineering');
      expect(slugs).toContain('radio-architecture');
      expect(slugs).toContain('editorial-standards');
    });

    it('contains rich textual substance and structured sections in each guide', () => {
      EDITORIAL_GUIDES.forEach((guide: EditorialGuide) => {
        expect(guide.slug).toBeTruthy();
        expect(guide.title.length).toBeGreaterThan(15);
        expect(guide.metaTitle.length).toBeGreaterThan(20);
        expect(guide.description.length).toBeGreaterThan(50);
        expect(guide.canonicalPath).toMatch(/^\/(guides\/|editorial-standards)/);
        expect(guide.readingTimeMinutes).toBeGreaterThanOrEqual(5);
        expect(guide.lastUpdated).toBeTruthy();
        expect(guide.sections.length).toBeGreaterThanOrEqual(4);

        // Verify high-quality, deep textual depth per section (countering thin content)
        guide.sections.forEach((section) => {
          expect(section.heading.length).toBeGreaterThan(5);
          expect(section.body.length).toBeGreaterThan(100);
        });
      });
    });

    it('retrieves specific guide by slug correctly', () => {
      const guide = getGuideBySlug('prompt-engineering');
      expect(guide).toBeDefined();
      expect(guide?.title).toContain('Prompt Engineering');
      expect(guide?.slug).toBe('prompt-engineering');

      const nonExistent = getGuideBySlug('non-existent-guide');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('generateArticleJsonLd', () => {
    it('generates valid Schema.org TechArticle JSON-LD for technical guides', () => {
      const jsonLd = generateArticleJsonLd({
        title: 'Mastering AI Music Prompt Engineering for Suno & Udio',
        description: 'Complete guide to crafting harmonic prompts, structural tags, and arrangement descriptors.',
        url: 'https://promptfm.live/guides/prompt-engineering',
        datePublished: '2026-11-01T00:00:00Z',
        dateModified: '2026-11-25T00:00:00Z',
        author: 'PromptFM Team',
        keywords: ['AI Music', 'Prompt Engineering', 'Suno', 'Udio', 'Stable Audio'],
        isTechnical: true,
      });

      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('TechArticle');
      expect(jsonLd.headline).toBe('Mastering AI Music Prompt Engineering for Suno & Udio');
      expect(jsonLd.description).toContain('Complete guide to crafting harmonic prompts');
      expect(jsonLd.url).toBe('https://promptfm.live/guides/prompt-engineering');
      expect(jsonLd.inLanguage).toBe('en-US');
      expect(jsonLd.datePublished).toBe('2026-11-01T00:00:00Z');
      expect(jsonLd.dateModified).toBe('2026-11-25T00:00:00Z');
      expect(jsonLd.keywords).toBe('AI Music, Prompt Engineering, Suno, Udio, Stable Audio');
      expect(jsonLd.mainEntityOfPage).toEqual({
        '@type': 'WebPage',
        '@id': 'https://promptfm.live/guides/prompt-engineering',
      });
      expect(jsonLd.author).toEqual({
        '@type': 'Organization',
        name: 'PromptFM Team',
        url: 'https://promptfm.live',
      });
      expect(jsonLd.publisher).toEqual({
        '@type': 'Organization',
        name: 'PromptFM',
        url: 'https://promptfm.live',
        logo: {
          '@type': 'ImageObject',
          url: 'https://promptfm.live/logo-mark.png',
        },
      });
    });

    it('generates valid Schema.org Article JSON-LD for editorial standards with defaults', () => {
      const jsonLd = generateArticleJsonLd({
        title: 'PromptFM Editorial & Curation Standards',
        description: 'Quality criteria, parent advisory rules, and community governance.',
        url: 'https://promptfm.live/editorial-standards',
        isTechnical: false,
      });

      expect(jsonLd['@type']).toBe('Article');
      expect(jsonLd.headline).toBe('PromptFM Editorial & Curation Standards');
      expect(jsonLd.datePublished).toBe('2026-11-01T00:00:00Z');
      expect(jsonLd.dateModified).toBeTruthy();
      expect(jsonLd.keywords).toBeUndefined();
      expect(jsonLd.author).toEqual({
        '@type': 'Organization',
        name: 'PromptFM Editorial Engineering Team',
        url: 'https://promptfm.live',
      });
      expect(jsonLd.mainEntityOfPage).toEqual({
        '@type': 'WebPage',
        '@id': 'https://promptfm.live/editorial-standards',
      });
    });
  });

  describe('generateSitemapUrls inclusion', () => {
    it('includes all editorial guides and curation standards in the sitemap', () => {
      const testDate = new Date('2026-11-25T00:00:00Z');
      const sitemap = generateSitemapUrls(testDate);

      const urls = sitemap.map((s) => s.url);
      expect(urls).toContain('https://promptfm.live/guides/prompt-engineering');
      expect(urls).toContain('https://promptfm.live/guides/radio-architecture');
      expect(urls).toContain('https://promptfm.live/editorial-standards');

      const promptGuide = sitemap.find((s) => s.url === 'https://promptfm.live/guides/prompt-engineering');
      expect(promptGuide?.priority).toBe(0.9);
      expect(promptGuide?.changeFrequency).toBe('weekly');

      const archGuide = sitemap.find((s) => s.url === 'https://promptfm.live/guides/radio-architecture');
      expect(archGuide?.priority).toBe(0.9);
      expect(archGuide?.changeFrequency).toBe('weekly');

      const standards = sitemap.find((s) => s.url === 'https://promptfm.live/editorial-standards');
      expect(standards?.priority).toBe(0.8);
      expect(standards?.changeFrequency).toBe('monthly');
    });
  });
});
