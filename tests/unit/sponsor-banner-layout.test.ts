import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SponsorBanner as SponsorBannerRecord } from '@/lib/ads/banner-service';

const reactMockState = vi.hoisted(() => {
  const useStateMock = vi.fn();
  const useEffectMock = vi.fn<(callback: () => void, deps?: unknown[]) => void>((callback) => {
    callback();
  });

  return { useStateMock, useEffectMock };
});

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: reactMockState.useStateMock,
    useEffect: reactMockState.useEffectMock,
  };
});

const bannerServiceMock = vi.hoisted(() => {
  const defaultCampaigns = [
    {
      id: 'promptfm_creator',
      sponsor: 'PromptFM Creators',
      title: 'Broadcast Your AI Music Live on Air',
      tagline: 'Community Submissions Open',
      description: 'Transform prompts into studio tracks and get played to a global 24/7 radio audience.',
      ctaText: 'Submit Your Track',
      targetUrl: 'https://promptfm.live/submit',
      badge: 'Creator Spotlight',
      placements: ['header_ribbon', 'in_feed'],
      weight: 4,
      active: true,
    },
    {
      id: 'elevenlabs_ai',
      sponsor: 'ElevenLabs',
      title: 'Next-Gen Voice AI & Sound Design',
      tagline: 'Lifelike Voices & Stems',
      description: 'Powering PromptFM DJ voices, spoken interstitials, and generative audio sound effects.',
      ctaText: 'Explore Voices',
      targetUrl: 'https://elevenlabs.io/?ref=promptfm',
      badge: 'Featured Sponsor',
      placements: ['header_ribbon', 'in_feed'],
      weight: 3,
      active: true,
    },
    {
      id: 'player_only',
      sponsor: 'Sidebar Only',
      title: 'Player Slot',
      description: 'Not eligible for header or in-feed placements.',
      ctaText: 'Ignore Me',
      targetUrl: 'https://example.com/sidebar',
      badge: 'Sidebar',
      placements: ['player_sidebar'],
      weight: 1,
      active: true,
    },
    {
      id: 'inactive_header',
      sponsor: 'Inactive Header',
      title: 'Should not render',
      description: 'Inactive banner should be filtered out.',
      ctaText: 'Do Not Show',
      targetUrl: 'https://example.com/inactive',
      badge: 'Inactive',
      placements: ['header_ribbon'],
      weight: 1,
      active: false,
    },
  ];

  return {
    campaignsRef: { value: defaultCampaigns },
    defaultCampaigns,
  };
});

const campaignsRef = bannerServiceMock.campaignsRef as { value: SponsorBannerRecord[] };
const defaultCampaigns = bannerServiceMock.defaultCampaigns as SponsorBannerRecord[];
const { useStateMock, useEffectMock } = reactMockState;

vi.mock('@/lib/ads/banner-service', () => ({
  get DEFAULT_SPONSOR_CAMPAIGNS() {
    return campaignsRef.value;
  },
}));

import React from 'react';
import { renderToString } from 'react-dom/server';
import SponsorBanner from '@/components/SponsorBanner';

function setUseStateValues(values: unknown[]) {
  const setters = values.map(() => vi.fn());
  useStateMock.mockReset();
  values.forEach((value, index) => {
    useStateMock.mockImplementationOnce(() => [value, setters[index]]);
  });
  return setters;
}

function renderBanner(props?: React.ComponentProps<typeof SponsorBanner>) {
  return renderToString(React.createElement(SponsorBanner, props));
}

function renderBannerElement(props?: React.ComponentProps<typeof SponsorBanner>) {
  return SponsorBanner(props ?? {});
}

function collectElements(node: React.ReactNode): React.ReactElement[] {
  if (node == null || typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectElements);
  }

  if (!React.isValidElement(node)) {
    return [];
  }

  const children = collectElements(node.props.children);
  return [node, ...children];
}

function useInitialStateValues() {
  useStateMock.mockReset();
  useStateMock
    .mockImplementationOnce((initial) => [initial, vi.fn()])
    .mockImplementationOnce((initial) => [initial, vi.fn()]);
}

describe('Issue #205: Creator spotlight sponsor ribbon', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    campaignsRef.value = defaultCampaigns;
    useEffectMock.mockClear();
    setUseStateValues([false, 0]);
    fetchMock.mockReset();
    fetchMock.mockReturnValue(Promise.resolve(undefined));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the creator promo copy without hard truncation so the headline can wrap', () => {
    const html = renderBanner();

    expect(html).toContain('Creator Spotlight');
    expect(html).toContain('PromptFM Creators:');
    expect(html).toContain('Broadcast Your AI Music Live on Air');
    expect(html).toContain('Transform prompts into studio tracks and get played to a global 24/7 radio audience.');

    expect(html).not.toContain('text-zinc-300 text-xs truncate max-w-xl');
    expect(html).toMatch(/text-xs[^\"]*text-zinc-300[^\"]*whitespace-normal/);
  });

  it('keeps the CTA and dismiss controls in a dedicated non-shrinking action cluster and preserves custom classes', () => {
    const html = renderBanner({ className: 'ring-1 ring-emerald-500', placement: 'header_ribbon' });

    expect(html).toContain('Submit Your Track');
    expect(html).toContain('Dismiss sponsor message');
    expect(html).toMatch(/flex items-center gap-2 flex-shrink-0/);
    expect(html).toContain('ring-1 ring-emerald-500');
  });

  it('starts with dismissed=false, currentAdIndex=0, and no stray default className text', () => {
    useInitialStateValues();

    const html = renderBanner();

    expect(useStateMock.mock.calls).toEqual([[false], [0]]);
    expect(html).not.toContain('Stryker was here!');
  });

  it('logs an anonymous impression for the active eligible banner on render', () => {
    renderBanner();

    expect(fetchMock).toHaveBeenCalledWith('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId: 'promptfm_creator', event: 'impression' }),
    });
    expect(useEffectMock).toHaveBeenCalledTimes(1);
    expect(useEffectMock.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ id: 'promptfm_creator', sponsor: 'PromptFM Creators' }),
      false,
    ]);
  });

  it('filters banners by placement and active state before choosing the current campaign', () => {
    const html = renderBanner({ placement: 'in_feed' });

    expect(html).toContain('PromptFM Creators:');
    expect(html).not.toContain('Sidebar Only');
    expect(html).not.toContain('Inactive Header');
  });

  it('falls back to the first eligible banner when the current index is out of range', () => {
    setUseStateValues([false, 99]);

    const html = renderBanner({ placement: 'header_ribbon' });

    expect(html).toContain('PromptFM Creators:');
    expect(html).toContain('Submit Your Track');
    expect(fetchMock).toHaveBeenCalledWith('/api/ads', expect.objectContaining({
      body: JSON.stringify({ adId: 'promptfm_creator', event: 'impression' }),
    }));
  });

  it('renders nothing and skips impression logging when all campaigns are ineligible', () => {
    campaignsRef.value = [
      {
        id: 'sidebar_only',
        sponsor: 'Sidebar Only',
        title: 'No Header Campaign',
        description: 'No eligible banner for current placement.',
        ctaText: 'Unavailable',
        targetUrl: 'https://example.com/sidebar-only',
        badge: 'Sidebar',
        placements: ['player_sidebar'],
        weight: 1,
        active: true,
      },
    ];

    const html = renderBanner({ placement: 'header_ribbon' });

    expect(html).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders nothing and skips logging when the banner has been dismissed', () => {
    setUseStateValues([true, 0]);

    const html = renderBanner();

    expect(html).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows fetch rejections from impression logging', () => {
    fetchMock.mockReturnValueOnce(Promise.reject(new Error('network down')));

    expect(() => renderBanner()).not.toThrow();
  });

  it('swallows synchronous fetch errors from impression logging', () => {
    fetchMock.mockImplementationOnce(() => {
      throw new Error('sync failure');
    });

    expect(() => renderBanner()).not.toThrow();
  });

  it('wires the CTA link to the selected banner target and click telemetry payload', () => {
    const element = renderBannerElement();
    const anchor = collectElements(element).find(
      (child) => child.type === 'a' && child.props.href === 'https://promptfm.live/submit'
    );

    expect(anchor).toBeDefined();
    expect(anchor?.props.rel).toBe('noopener noreferrer sponsored');
    expect(anchor?.props.target).toBe('_blank');

    fetchMock.mockClear();
    anchor?.props.onClick();

    expect(fetchMock).toHaveBeenCalledWith('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId: 'promptfm_creator', event: 'click' }),
    });
  });

  it('wires the dismiss button to set dismissed state', () => {
    const [setDismissed] = setUseStateValues([false, 0]);
    const element = renderBannerElement();
    const dismissButton = collectElements(element).find(
      (child) => child.type === 'button' && child.props['aria-label'] === 'Dismiss sponsor message'
    );

    expect(dismissButton).toBeDefined();

    dismissButton?.props.onClick();

    expect(setDismissed).toHaveBeenCalledWith(true);
  });

  it('renders the next eligible campaign when currentAdIndex points at a later active banner', () => {
    setUseStateValues([false, 1]);

    const html = renderBanner({ placement: 'header_ribbon' });

    expect(html).toContain('ElevenLabs:');
    expect(html).toContain('Explore Voices');
    expect(html).not.toContain('PromptFM Creators:');
    expect(fetchMock).toHaveBeenCalledWith('/api/ads', expect.objectContaining({
      body: JSON.stringify({ adId: 'elevenlabs_ai', event: 'impression' }),
    }));
  });

  it('falls back to the Sponsored badge label when a campaign omits badge text', () => {
    campaignsRef.value = [
      {
        id: 'no_badge',
        sponsor: 'Badge Free Sponsor',
        title: 'Sponsor without badge copy',
        description: 'Uses the default sponsored label.',
        ctaText: 'Learn More',
        targetUrl: 'https://example.com/no-badge',
        placements: ['header_ribbon'],
        weight: 1,
        active: true,
      },
    ];

    const html = renderBanner();

    expect(html).toContain('Sponsored');
    expect(html).toContain('Badge Free Sponsor:');
  });
});
