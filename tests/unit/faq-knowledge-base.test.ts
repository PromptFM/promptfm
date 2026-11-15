// tests/unit/faq-knowledge-base.test.ts
// Unit tests for PromptFM FAQ Knowledge Base and Schema.org FAQPage generation.

import { describe, it, expect } from 'vitest';
import { FAQ_CATEGORIES, FAQ_ITEMS, getAllFaqItems, getFaqItemsByCategory } from '@/lib/faq/faq-data';
import { generateFaqJsonLd } from '@/lib/seo/structured-data';

describe('FAQ Knowledge Base Service', () => {
  it('defines structured FAQ categories with substantial editorial depth', () => {
    expect(FAQ_CATEGORIES).toHaveLength(4);

    expect(FAQ_CATEGORIES[0]).toEqual({
      slug: 'station-architecture',
      name: 'Station Architecture & AI DJs',
      description: 'How PromptFM operates 24/7 autonomous clock-wheel broadcasting with Google Gemini AI DJs.',
    });

    expect(FAQ_CATEGORIES[1]).toEqual({
      slug: 'ai-synthesis',
      name: 'AI Music Synthesis & Tools',
      description: 'Foundation audio models including Suno v3.5, Udio v1.5, and Stable Audio 2.0.',
    });

    expect(FAQ_CATEGORIES[2]).toEqual({
      slug: 'community-governance',
      name: 'Community Governance & Charts',
      description: 'Listener upvoting, song queue mechanics, and weekly countdown charts.',
    });

    expect(FAQ_CATEGORIES[3]).toEqual({
      slug: 'copyright-licensing',
      name: 'Copyright, Safety & Licensing',
      description: 'Commercial broadcast rights, DMCA Safe Harbor (17 U.S.C. § 512), and anti-voice clone safeguards.',
    });
  });

  it('contains comprehensive answers covering Suno, Udio, Gemini, and DMCA across all items', () => {
    const allItems = getAllFaqItems();
    expect(allItems).toHaveLength(11);
    expect(allItems).toBe(FAQ_ITEMS);

    const itemMap = new Map(allItems.map((item) => [item.id, item]));

    // Check specific items thoroughly
    const stationWorks = itemMap.get('how-station-works');
    expect(stationWorks?.categorySlug).toBe('station-architecture');
    expect(stationWorks?.question).toBe('How does PromptFM broadcast 24/7 without human intervention?');
    expect(stationWorks?.answer).toContain('Google Gemini');
    expect(stationWorks?.answer).toContain('clock-wheel rotation engine');

    const djPersonalities = itemMap.get('ai-dj-personalities');
    expect(djPersonalities?.categorySlug).toBe('station-architecture');
    expect(djPersonalities?.question).toBe('Who are the resident AI DJs and how do they curate their shifts?');
    expect(djPersonalities?.answer).toContain('DJ Neon');
    expect(djPersonalities?.answer).toContain('DJ Cipher');
    expect(djPersonalities?.answer).toContain('DJ Luna');
    expect(djPersonalities?.answer).toContain('DJ Pixel');

    const aiTools = itemMap.get('supported-ai-tools');
    expect(aiTools?.categorySlug).toBe('ai-synthesis');
    expect(aiTools?.question).toBe('Which AI music generation tools are supported on PromptFM?');
    expect(aiTools?.answer).toContain('Suno');
    expect(aiTools?.answer).toContain('Udio');
    expect(aiTools?.answer).toContain('Stable Audio');

    const pgvector = itemMap.get('semantic-search-pgvector');
    expect(pgvector?.categorySlug).toBe('ai-synthesis');
    expect(pgvector?.question).toBe('How does semantic prompt matching work for song discovery?');
    expect(pgvector?.answer).toContain('pgvector');
    expect(pgvector?.answer).toContain('cosine similarity');

    const voting = itemMap.get('how-voting-works');
    expect(voting?.categorySlug).toBe('community-governance');
    expect(voting?.question).toBe('How does community voting affect track airplay and rotation?');
    expect(voting?.answer).toContain('rotational weight');

    const queue = itemMap.get('song-requests-queue');
    expect(queue?.categorySlug).toBe('community-governance');
    expect(queue?.question).toBe('Can listeners request songs to play live on air?');
    expect(queue?.answer).toContain('/song');
    expect(queue?.answer).toContain('anti-repeat rules');

    const rights = itemMap.get('commercial-rights-requirement');
    expect(rights?.categorySlug).toBe('copyright-licensing');
    expect(rights?.question).toBe('Do creators need commercial rights to submit AI music?');
    expect(rights?.answer).toContain('commercial broadcast rights');

    const clones = itemMap.get('voice-clone-restrictions');
    expect(clones?.categorySlug).toBe('copyright-licensing');
    expect(clones?.question).toBe('Are vocal deepfakes or celebrity voice clones allowed on PromptFM?');
    expect(clones?.answer).toContain('anti-voice clone policy');

    const dmca = itemMap.get('dmca-compliance');
    expect(dmca?.categorySlug).toBe('copyright-licensing');
    expect(dmca?.question).toBe('How does PromptFM handle DMCA copyright takedown notices?');
    expect(dmca?.answer).toContain('17 U.S.C. § 512');
    expect(dmca?.answer).toContain('dmca@promptfm.live');

    const watershed = itemMap.get('parental-controls-watershed');
    expect(watershed?.categorySlug).toBe('copyright-licensing');
    expect(watershed?.question).toBe('How are explicit lyrics and family content moderated?');
    expect(watershed?.answer).toContain('Whisper and Gemini lyric scanning');
    expect(watershed?.answer).toContain('watershed hours');

    const audioQuality = itemMap.get('audio-quality-standards');
    expect(audioQuality?.categorySlug).toBe('ai-synthesis');
    expect(audioQuality?.question).toBe('What audio formats and quality standards are required for broadcast?');
    expect(audioQuality?.answer).toContain('192 kbps');
    expect(audioQuality?.answer).toContain('MP3 format');
  });

  it('filters FAQ items cleanly by category slug', () => {
    const aiItems = getFaqItemsByCategory('ai-synthesis');
    expect(aiItems.length).toBe(3);
    aiItems.forEach((item) => {
      expect(item.categorySlug).toBe('ai-synthesis');
    });

    const nonExistent = getFaqItemsByCategory('unknown-category');
    expect(nonExistent).toEqual([]);
  });

  it('generates compliant Schema.org FAQPage JSON-LD structured data', () => {
    const jsonLd = generateFaqJsonLd();
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('FAQPage');
    expect(Array.isArray(jsonLd.mainEntity)).toBe(true);
    expect(jsonLd.mainEntity.length).toBe(11);

    const firstItem = jsonLd.mainEntity[0];
    expect(firstItem).toBeDefined();
    if (!firstItem) throw new Error('Expected firstItem to be defined');
    expect(firstItem['@type']).toBe('Question');
    expect(firstItem.name).toBe('How does PromptFM broadcast 24/7 without human intervention?');
    expect(firstItem.acceptedAnswer['@type']).toBe('Answer');
    expect(firstItem.acceptedAnswer.text).toContain('Google Gemini');
  });
});
