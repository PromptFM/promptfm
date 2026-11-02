// tests/unit/channel-navigation.test.ts
import { describe, it, expect } from 'vitest';
import {
  OFFICIAL_CHANNELS,
  DEFAULT_CHANNEL_SLUG,
  getChannelBySlug,
  isValidChannelSlug,
  getStreamUrlForChannel,
  getAllChannels,
} from '@/lib/radio/channels';

describe('Channel Navigation & Selection Logic', () => {
  it('contains exactly 4 curated theme stations', () => {
    const channels = getAllChannels();
    expect(channels).toHaveLength(4);
    const slugs = channels.map((c) => c.slug);
    expect(slugs).toEqual(['main', 'cyberpunk', 'chillout', 'kids']);
  });

  it('assigns unique DJs and stream configurations to all stations', () => {
    const channels = getAllChannels();
    const djIds = new Set(channels.map((c) => c.djId));
    expect(djIds.size).toBe(4);

    const djNames = new Set(channels.map((c) => c.djName));
    expect(djNames.size).toBe(4);

    channels.forEach((c) => {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.shortName.length).toBeGreaterThan(0);
      expect(c.vibe.length).toBeGreaterThan(0);
      expect(c.badge.length).toBeGreaterThan(0);
      expect(c.streamUrl).toBeDefined();
    });
  });

  it('correctly maps URL search params and handles unknown channels safely', () => {
    expect(getChannelBySlug('CYBERPUNK').slug).toBe('cyberpunk');
    expect(getChannelBySlug('chillout').slug).toBe('chillout');
    expect(getChannelBySlug('kids').slug).toBe('kids');
    expect(getChannelBySlug('unknown-pirate-radio').slug).toBe(DEFAULT_CHANNEL_SLUG);
    expect(getChannelBySlug(null).slug).toBe(DEFAULT_CHANNEL_SLUG);
  });

  it('provides distinct stream URLs for theme channels and default stream for main stage', () => {
    const mainStream = getStreamUrlForChannel('main');
    const cyberpunkStream = getStreamUrlForChannel('cyberpunk');
    const chilloutStream = getStreamUrlForChannel('chillout');
    const kidsStream = getStreamUrlForChannel('kids');

    expect(mainStream).not.toContain('channel=');
    expect(cyberpunkStream).toContain('channel=cyberpunk');
    expect(chilloutStream).toContain('channel=chillout');
    expect(kidsStream).toContain('channel=kids');
  });

  it('correctly flags family-safe channels for parents and classrooms', () => {
    const kids = getChannelBySlug('kids');
    const chillout = getChannelBySlug('chillout');
    const main = getChannelBySlug('main');
    const cyberpunk = getChannelBySlug('cyberpunk');

    expect(kids.isFamilySafe).toBe(true);
    expect(chillout.isFamilySafe).toBe(true);
    expect(main.isFamilySafe).toBe(true);
    expect(cyberpunk.isFamilySafe).toBe(false);
  });
});
