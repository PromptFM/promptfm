// tests/unit/main-stage-public-ui.test.ts
// TDD Reproduction & Verification Suite for Issue #85:
// Finish main-stage-only public UI so counts, copy, icons, and layout match the single visible station.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import LiveListenersBadge, { LiveListenersBadgeProps } from '@/components/LiveListenersBadge';
import ChannelsGrid from '@/components/ChannelsGrid';
import {
  getPublicChannels,
  getPublicChannelBySlug,
  setChannelActiveOverride,
  resetChannelActiveOverrides,
} from '@/lib/radio/channels';
import { metadata as channelsMetadata } from '@/app/channels/page';
import HomePage from '@/app/page';

describe('Issue #85: Main-Stage-Only Public UI (TDD)', () => {
  beforeEach(() => {
    resetChannelActiveOverrides();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetChannelActiveOverrides();
    vi.restoreAllMocks();
  });

  describe('LiveListenersBadge - Dynamic Single Station vs Multi-Channel Telemetry', () => {
    it('reproduces bug: currently hardcodes 4 LIVE CHANNELS instead of reflecting single public station', () => {
      // With default config, only 1 channel ('main') is public
      const publicChannels = getPublicChannels();
      expect(publicChannels).toHaveLength(1);

      const html = renderToString(React.createElement(LiveListenersBadge));

      // Must NOT hard-code "4 LIVE CHANNELS"
      expect(html).not.toContain('4 LIVE CHANNELS');
      // When 1 station is public, it should indicate MAIN STAGE LIVE
      expect(html).toContain('MAIN STAGE LIVE');
      expect(html).toContain('24/7 BROADCAST');
    });

    it('displays single-stage listener copy instead of NETWORK LISTENERS when 1 station is active', () => {
      const html = renderToString(React.createElement<LiveListenersBadgeProps>(LiveListenersBadge, { initialCount: 42 }));

      expect(html).toContain('42 LIVE LISTENERS');
      expect(html).not.toContain('NETWORK LISTENERS');
      expect(html).toContain('42 live listeners on PromptFM Main Stage');
    });

    it('dynamically adapts badge when multiple channels are activated in the future', () => {
      // Simulate multiple channels enabled
      setChannelActiveOverride('cyberpunk', true);
      setChannelActiveOverride('chillout', true);

      expect(getPublicChannels().length).toBe(3);

      const html = renderToString(React.createElement<LiveListenersBadgeProps>(LiveListenersBadge, { initialCount: 150 }));

      expect(html).toContain('3 LIVE CHANNELS');
      expect(html).toContain('150 NETWORK LISTENERS');
      expect(html).toContain('150 total live listeners across all PromptFM channels');
    });

    it('kills surviving mutants in getPublicChannelBySlug with multiple active channels', () => {
      setChannelActiveOverride('cyberpunk', true);
      const publicChannels = getPublicChannels();
      expect(publicChannels.length).toBeGreaterThan(1);

      // Testing non-default public channel with whitespace and uppercase
      const resolved = getPublicChannelBySlug('   CYBERPUNK   ');
      expect(resolved.slug).toBe('cyberpunk');

      // Testing invalid slug falls back to defaultChannel
      const fallback = getPublicChannelBySlug('invalid-non-existent');
      expect(fallback.slug).toBe('main');

      // Testing falsy slug
      expect(getPublicChannelBySlug(null).slug).toBe('main');
      expect(getPublicChannelBySlug('').slug).toBe('main');
    });

    it('falls back to OFFICIAL_CHANNELS[0] when all public channels are deactivated', () => {
      setChannelActiveOverride('main', false);
      expect(getPublicChannels()).toHaveLength(0);
      expect(getPublicChannelBySlug('any').slug).toBe('main');
    });
  });

  describe('ChannelsGrid - Main Stage Showcase Layout & Copy', () => {
    it('renders single-stage header and featured stage layout when only main stage is public', () => {
      const publicChannels = getPublicChannels();
      expect(publicChannels).toHaveLength(1);

      const html = renderToString(React.createElement(ChannelsGrid));

      // Header copy checks
      expect(html).toContain('LIVE BROADCAST STAGE');
      expect(html).toContain('PromptFM Main Stage Broadcast');
      expect(html).not.toContain('Choose Your Radio Station');
      expect(html).not.toContain('LIVE THEME CHANNELS');

      // Layout should be a featured showcase container (max-w-2xl or max-w-3xl), not cramped max-w-md
      expect(html).toMatch(/max-w-(2xl|3xl)/);
      expect(html).not.toContain('max-w-md mx-auto sm:mx-0');

      // Card content for Main Stage
      expect(html).toContain('Main Stage');
      expect(html).toContain('DJ Neon');
      expect(html).toContain('🏆 Top Hits');
      expect(html).toContain('Family Safe');
    });

    it('provides accessible ARIA attributes and labels on the main stage tune-in control', () => {
      const html = renderToString(React.createElement(ChannelsGrid));

      expect(html).toContain('aria-label');
      expect(html).toMatch(/aria-label=".*Main Stage.*"/);
    });
  });

  describe('Channels Page Metadata', () => {
    it('describes PromptFM Main Stage rather than multi-channel directory', () => {
      expect(channelsMetadata.title).toContain('Main Stage');
      expect(channelsMetadata.description).toContain('Main Stage');
      expect(channelsMetadata.description).not.toContain('Kids & Family');
    });
  });

  describe('HomePage - Hero Station Icon Treatment & Clean Main-Stage Copy', () => {
    it('renders main-stage-specific station icon treatment in hero rather than generic lone logo mark', () => {
      const html = renderToString(React.createElement(HomePage));

      // Hero icon alt text should explicitly identify Main Stage / 24/7 AI Radio
      expect(html).toContain('alt="PromptFM Main Stage 24/7 AI Radio"');
      // Hero should feature a Main Stage identifier badge or tag near the icon
      expect(html).toContain('Main Stage');

      // No lingering references to 5 stations in pills or copy
      expect(html).not.toContain('5 Live Stations');
      expect(html).not.toContain('5 curated theme stations');
    });
  });
});
