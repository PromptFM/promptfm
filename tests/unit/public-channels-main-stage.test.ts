// tests/unit/public-channels-main-stage.test.ts
// TDD Test Suite for Issue #46: Hide every channel except main stage until channel behavior,
// scheduling, and Discord support are defined.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OFFICIAL_CHANNELS,
  DEFAULT_CHANNEL_SLUG,
  getPublicChannels,
  getAllChannels,
  isChannelPublic,
  getPublicChannelBySlug,
  getChannelBySlug,
  isValidChannelSlug,
} from '@/lib/radio/channels';
import { GET as getRadioChannels } from '@/app/api/radio/channels/route';
import { GET as getRadioSchedule } from '@/app/api/radio/schedule/route';
import * as rotation from '@/lib/dj/rotation';
import { NextRequest } from 'next/server';

describe('Issue #46: Public Channel Isolation to Main Stage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(rotation, 'getNowPlaying').mockResolvedValue({
      item: {
        id: 'mock-track',
        type: 'music',
        title: 'Mock Track',
        artist: 'Mock Artist',
        audio_url: 'https://example.com/audio.mp3',
      },
      startedAt: new Date().toISOString(),
      elapsedSeconds: 10,
      activeDJ: {
        id: 'dj_neon',
        name: 'DJ Neon',
        title: 'Host',
        bio: '',
        stylePrompt: '',
        voice: { name: 'en-US-Journey-F', languageCode: 'en-US', ssmlGender: 'FEMALE' },
        shifts: [],
        defaultChannels: ['main'],
      },
    });
  });

  describe('Channel Configuration & Public Visibility', () => {
    it('marks main stage as enabled and all other stages as disabled', () => {
      const main = OFFICIAL_CHANNELS.find((c) => c.slug === 'main');
      expect(main).toBeDefined();
      expect(main?.enabled).toBe(true);

      const nonMainChannels = OFFICIAL_CHANNELS.filter((c) => c.slug !== 'main');
      expect(nonMainChannels.length).toBeGreaterThanOrEqual(4);
      for (const ch of nonMainChannels) {
        expect(ch.enabled).toBe(false);
      }
    });

    it('getPublicChannels returns only active public broadcast channels (main stage only)', () => {
      const publicChannels = getPublicChannels();
      expect(publicChannels).toHaveLength(1);
      expect(publicChannels[0]?.slug).toBe('main');
      expect(publicChannels[0]?.shortName).toBe('Main Stage');
    });

    it('getAllChannels supports publicOnly filter option', () => {
      const publicOnly = getAllChannels({ publicOnly: true });
      expect(publicOnly).toHaveLength(1);
      expect(publicOnly[0]?.slug).toBe('main');

      const allChannels = getAllChannels({ publicOnly: false });
      expect(allChannels.length).toBeGreaterThanOrEqual(5);
    });

    it('isChannelPublic returns true only for enabled public channels', () => {
      expect(isChannelPublic('main')).toBe(true);
      expect(isChannelPublic('MAIN')).toBe(true);
      expect(isChannelPublic('  main  ')).toBe(true);

      expect(isChannelPublic('cyberpunk')).toBe(false);
      expect(isChannelPublic('chillout')).toBe(false);
      expect(isChannelPublic('kids')).toBe(false);
      expect(isChannelPublic('afterdark')).toBe(false);
      expect(isChannelPublic('unknown-channel')).toBe(false);
      expect(isChannelPublic(null)).toBe(false);
      expect(isChannelPublic(undefined)).toBe(false);
    });

    it('getPublicChannelBySlug falls back to main stage when requested channel is disabled or unknown', () => {
      expect(getPublicChannelBySlug('main').slug).toBe('main');
      expect(getPublicChannelBySlug('MAIN').slug).toBe('main');
      expect(getPublicChannelBySlug('  main  ').slug).toBe('main');
      expect(getPublicChannelBySlug('cyberpunk').slug).toBe('main');
      expect(getPublicChannelBySlug('chillout').slug).toBe('main');
      expect(getPublicChannelBySlug('kids').slug).toBe('main');
      expect(getPublicChannelBySlug('afterdark').slug).toBe('main');
      expect(getPublicChannelBySlug('nonexistent').slug).toBe('main');
      expect(getPublicChannelBySlug('').slug).toBe('main');
      expect(getPublicChannelBySlug(null).slug).toBe('main');
      expect(getPublicChannelBySlug(undefined).slug).toBe('main');
    });

    it('isValidChannelSlug supports publicOnly validation', () => {
      expect(isValidChannelSlug('main', { publicOnly: true })).toBe(true);
      expect(isValidChannelSlug('cyberpunk', { publicOnly: true })).toBe(false);
      expect(isValidChannelSlug('cyberpunk', { publicOnly: false })).toBe(true);
    });
  });

  describe('API: /api/radio/channels Endpoint', () => {
    it('returns channels with enabled status indicating main is enabled and others are disabled', async () => {
      const req = new NextRequest('http://localhost:3000/api/radio/channels');
      const res = await getRadioChannels(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      const main = json.channels.find((c: any) => c.slug === 'main');
      expect(main.enabled).toBe(true);

      const others = json.channels.filter((c: any) => c.slug !== 'main');
      for (const ch of others) {
        expect(ch.enabled).toBe(false);
      }
    });

    it('filters strictly to public channels when public_only=true is provided', async () => {
      const req = new NextRequest('http://localhost:3000/api/radio/channels?public_only=true');
      const res = await getRadioChannels(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.channels).toHaveLength(1);
      expect(json.channels[0].slug).toBe('main');
    });
  });

  describe('API: /api/radio/schedule Endpoint', () => {
    it('returns schedules for only public channels when all=true&public_only=true is requested', async () => {
      const req = new NextRequest('http://localhost:3000/api/radio/schedule?all=true&public_only=true');
      const res = await getRadioSchedule(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.channels).toHaveLength(1);
      expect(json.channels[0].channel.slug).toBe('main');
    });
  });
});

