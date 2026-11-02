// tests/unit/ads-service.test.ts
// Unit tests for PromptFM Website Ads and Sponsor Banner Service.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_SPONSOR_CAMPAIGNS,
  getActiveSponsorBanners,
  getBannerById,
  recordAdEvent,
  getAdStats,
  clearAdStatsForTesting,
  type SponsorBanner,
  type AdEventType,
} from '@/lib/ads/banner-service';

describe('PromptFM Website Ads & Sponsor Banner Service', () => {
  beforeEach(() => {
    clearAdStatsForTesting();
  });

  describe('DEFAULT_SPONSOR_CAMPAIGNS', () => {
    it('contains valid default campaigns with all required metadata', () => {
      expect(DEFAULT_SPONSOR_CAMPAIGNS.length).toBeGreaterThanOrEqual(3);

      for (const campaign of DEFAULT_SPONSOR_CAMPAIGNS) {
        expect(campaign.id).toBeDefined();
        expect(campaign.sponsor).toBeDefined();
        expect(campaign.title).toBeDefined();
        expect(campaign.description).toBeDefined();
        expect(campaign.ctaText).toBeDefined();
        expect(campaign.targetUrl).toMatch(/^https?:\/\//);
        expect(campaign.placements.length).toBeGreaterThan(0);
        expect(campaign.active).toBe(true);
        expect(campaign.weight).toBeGreaterThan(0);
      }
    });

    it('includes Suno, ElevenLabs, and PromptFM Community Club campaigns with exact attributes', () => {
      const suno = DEFAULT_SPONSOR_CAMPAIGNS.find((c) => c.id === 'suno_creator')!;
      expect(suno.sponsor).toBe('Suno AI');
      expect(suno.title).toBe('Create Studio Songs in Seconds');
      expect(suno.tagline).toBe('Generative AI Audio Engine');
      expect(suno.description).toBe('Transform prompts and lyrics into radio-ready songs across any musical style.');
      expect(suno.ctaText).toBe('Try Suno v3');
      expect(suno.targetUrl).toBe('https://suno.com/?ref=promptfm');
      expect(suno.badge).toBe('Official Partner');
      expect(suno.placements).toEqual(['header_ribbon', 'in_feed']);
      expect(suno.weight).toBe(3);
      expect(suno.active).toBe(true);

      const eleven = DEFAULT_SPONSOR_CAMPAIGNS.find((c) => c.id === 'elevenlabs_ai')!;
      expect(eleven.sponsor).toBe('ElevenLabs');
      expect(eleven.title).toBe('Next-Gen Voice AI & Sound Design');
      expect(eleven.tagline).toBe('Lifelike Voices & Stems');
      expect(eleven.description).toBe('Powering PromptFM DJ voices, spoken interstitials, and generative audio sound effects.');
      expect(eleven.ctaText).toBe('Explore Voices');
      expect(eleven.targetUrl).toBe('https://elevenlabs.io/?ref=promptfm');
      expect(eleven.badge).toBe('Featured Sponsor');
      expect(eleven.placements).toEqual(['header_ribbon', 'in_feed']);
      expect(eleven.weight).toBe(3);
      expect(eleven.active).toBe(true);

      const club = DEFAULT_SPONSOR_CAMPAIGNS.find((c) => c.id === 'promptfm_club')!;
      expect(club.sponsor).toBe('PromptFM Creator Club');
      expect(club.title).toBe('Support 24/7 Cloud Streams & Get Airplay');
      expect(club.tagline).toBe('Community Powered');
      expect(club.description).toBe('Keep the servers running, unlock custom AI DJ dedications, and earn verified creator flair.');
      expect(club.ctaText).toBe('Join Creator Club');
      expect(club.targetUrl).toBe('https://promptfm.live/submit');
      expect(club.badge).toBe('Station Patron');
      expect(club.placements).toEqual(['header_ribbon', 'in_feed']);
      expect(club.weight).toBe(4);
      expect(club.active).toBe(true);
    });
  });

  describe('getActiveSponsorBanners', () => {
    it('returns only active banners for the requested placement', () => {
      const headerBanners = getActiveSponsorBanners('header_ribbon');
      expect(headerBanners.length).toBeGreaterThan(0);
      for (const b of headerBanners) {
        expect(b.active).toBe(true);
        expect(b.placements).toContain('header_ribbon');
      }

      const inFeedBanners = getActiveSponsorBanners('in_feed');
      expect(inFeedBanners.length).toBeGreaterThan(0);
      for (const b of inFeedBanners) {
        expect(b.active).toBe(true);
        expect(b.placements).toContain('in_feed');
      }
    });

    it('returns empty array for non-existent placement', () => {
      // @ts-expect-error testing invalid placement
      const banners = getActiveSponsorBanners('non_existent_slot');
      expect(banners).toEqual([]);
    });
  });

  describe('getBannerById', () => {
    it('returns the matching banner by ID', () => {
      const banner = getBannerById('suno_creator');
      expect(banner).toBeDefined();
      expect(banner?.sponsor).toBe('Suno AI');
    });

    it('returns undefined when ID is not found or empty', () => {
      expect(getBannerById('unknown_ad')).toBeUndefined();
      expect(getBannerById('')).toBeUndefined();
    });
  });

  describe('recordAdEvent & getAdStats', () => {
    it('increments impression count when event is impression', () => {
      recordAdEvent('suno_creator', 'impression');
      recordAdEvent('suno_creator', 'impression');

      const stats = getAdStats('suno_creator');
      expect(stats.impressions).toBe(2);
      expect(stats.clicks).toBe(0);
      expect(stats.ctrPercent).toBe(0);
    });

    it('increments clicks and calculates click-through rate (CTR) accurately', () => {
      recordAdEvent('elevenlabs_ai', 'impression');
      recordAdEvent('elevenlabs_ai', 'impression');
      recordAdEvent('elevenlabs_ai', 'click');

      const stats = getAdStats('elevenlabs_ai');
      expect(stats.impressions).toBe(2);
      expect(stats.clicks).toBe(1);
      expect(stats.ctrPercent).toBe(50.0);
    });

    it('returns zero stats for an untracked campaign ID', () => {
      const stats = getAdStats('untracked_ad_999');
      expect(stats.impressions).toBe(0);
      expect(stats.clicks).toBe(0);
      expect(stats.ctrPercent).toBe(0);
    });

    it('ignores empty ad ID or invalid event gracefully', () => {
      const res1 = recordAdEvent('', 'impression');
      expect(res1).toBe(false);

      // @ts-expect-error testing invalid event type
      const res2 = recordAdEvent('suno_creator', 'invalid_event');
      expect(res2).toBe(false);
    });
  });
});
