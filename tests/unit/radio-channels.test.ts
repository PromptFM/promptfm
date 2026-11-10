// tests/unit/radio-channels.test.ts
// Unit tests for PromptFM Theme Radio Channels Service

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getAllChannels,
  getChannelBySlug,
  isValidChannelSlug,
  getStreamUrlForChannel,
  DEFAULT_CHANNEL_SLUG,
  OFFICIAL_CHANNELS,
  type RadioChannel,
} from '@/lib/radio/channels';

describe('Radio Channels Service', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('DEFAULT_CHANNEL_SLUG', () => {
    it('defaults to main', () => {
      expect(DEFAULT_CHANNEL_SLUG).toBe('main');
    });
  });

  describe('getAllChannels', () => {
    it('returns all 5 official PromptFM theme channels with proper metadata', () => {
      const channels = getAllChannels();
      expect(channels).toHaveLength(5);

      const slugs = channels.map((c) => c.slug);
      expect(slugs).toContain('main');
      expect(slugs).toContain('cyberpunk');
      expect(slugs).toContain('chillout');
      expect(slugs).toContain('kids');
      expect(slugs).toContain('afterdark');

      for (const ch of channels) {
        expect(ch.name).toBeTruthy();
        expect(ch.shortName).toBeTruthy();
        expect(ch.description).toBeTruthy();
        expect(ch.vibe).toBeTruthy();
        expect(ch.badge).toBeTruthy();
        expect(ch.djId).toBeTruthy();
        expect(ch.accentColor).toBeTruthy();
        expect(typeof ch.isFamilySafe).toBe('boolean');
      }
    });

    it('identifies kids channel as family safe and cyberpunk as explicit watershed enabled', () => {
      const kids = getChannelBySlug('kids');
      expect(kids.isFamilySafe).toBe(true);

      const cyberpunk = getChannelBySlug('cyberpunk');
      expect(cyberpunk.isFamilySafe).toBe(false);
    });
  });

  describe('getChannelBySlug', () => {
    it('returns the channel configuration for known slugs', () => {
      const main = getChannelBySlug('main');
      expect(main.slug).toBe('main');
      expect(main.name).toBe('PromptFM Main Stage');
      expect(main.djId).toBe('dj_neon');

      const cyber = getChannelBySlug('cyberpunk');
      expect(cyber.slug).toBe('cyberpunk');
      expect(cyber.name).toBe('Cyberpunk & Synth');
      expect(cyber.djId).toBe('dj_cipher');

      const chill = getChannelBySlug('chillout');
      expect(chill.slug).toBe('chillout');
      expect(chill.name).toBe('Chillout & Ambient');
      expect(chill.djId).toBe('dj_luna');

      const kids = getChannelBySlug('kids');
      expect(kids.slug).toBe('kids');
      expect(kids.name).toBe('Kids & Family');
      expect(kids.djId).toBe('dj_pixel');
    });

    it('falls back to main channel when slug is unknown, undefined, or whitespace', () => {
      expect(getChannelBySlug('unknown-channel').slug).toBe('main');
      expect(getChannelBySlug(undefined as any).slug).toBe('main');
      expect(getChannelBySlug('').slug).toBe('main');
      expect(getChannelBySlug('   ').slug).toBe('main');
    });

    it('handles uppercase or mixed-case slugs gracefully', () => {
      expect(getChannelBySlug('CYBERPUNK').slug).toBe('cyberpunk');
      expect(getChannelBySlug('ChillOut').slug).toBe('chillout');
      expect(getChannelBySlug('  cyberpunk  ').slug).toBe('cyberpunk');
    });
  });

  describe('isValidChannelSlug', () => {
    it('validates official channel slugs correctly', () => {
      expect(isValidChannelSlug('main')).toBe(true);
      expect(isValidChannelSlug('cyberpunk')).toBe(true);
      expect(isValidChannelSlug('  cyberpunk  ')).toBe(true);
      expect(isValidChannelSlug('chillout')).toBe(true);
      expect(isValidChannelSlug('kids')).toBe(true);

      expect(isValidChannelSlug('random')).toBe(false);
      expect(isValidChannelSlug('')).toBe(false);
      expect(isValidChannelSlug(null as any)).toBe(false);
    });
  });

  describe('getStreamUrlForChannel', () => {
    it('returns primary live stream URL for main channel', () => {
      const url = getStreamUrlForChannel('main');
      expect(url).toContain('stream.promptfm.live/stream.mp3');
    });

    it('returns channel-specific mount or fallback stream URL for theme channels', () => {
      const cyberUrl = getStreamUrlForChannel('cyberpunk');
      expect(cyberUrl).toBeTruthy();

      const chillUrl = getStreamUrlForChannel('chillout');
      expect(chillUrl).toBeTruthy();

      const kidsUrl = getStreamUrlForChannel('kids');
      expect(kidsUrl).toBeTruthy();
    });

    it('builds channel URLs from NEXT_PUBLIC_STREAM_URL when local stream env is present', async () => {
      vi.stubEnv('NEXT_PUBLIC_STREAM_URL', 'http://localhost:8000/stream.mp3');

      const { getStreamUrlForChannel } = await import('@/lib/radio/channels');

      expect(getStreamUrlForChannel('main')).toBe('http://localhost:8000/stream.mp3');
      expect(getStreamUrlForChannel('chillout')).toBe('http://localhost:8000/stream.mp3?channel=chillout');
    });
  });
});
