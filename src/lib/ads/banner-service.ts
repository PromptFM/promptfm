// src/lib/ads/banner-service.ts
// PromptFM Website Ads & Sponsor Banner Management Engine
// Manages privacy-respecting direct sponsor ribbons, in-feed chart cards, and engagement telemetry.

export type AdPlacement = 'header_ribbon' | 'in_feed' | 'player_sidebar';
export type AdEventType = 'impression' | 'click';

export interface SponsorBanner {
  id: string;
  sponsor: string;
  title: string;
  tagline?: string;
  description: string;
  ctaText: string;
  targetUrl: string;
  badge?: string;
  placements: AdPlacement[];
  weight: number;
  active: boolean;
}

export interface AdStats {
  impressions: number;
  clicks: number;
  ctrPercent: number;
}

export const DEFAULT_SPONSOR_CAMPAIGNS: SponsorBanner[] = [
  {
    id: 'suno_creator',
    sponsor: 'Suno AI',
    title: 'Create Studio Songs in Seconds',
    tagline: 'Generative AI Audio Engine',
    description: 'Transform prompts and lyrics into radio-ready songs across any musical style.',
    ctaText: 'Try Suno v3',
    targetUrl: 'https://suno.com/?ref=promptfm',
    badge: 'Official Partner',
    placements: ['header_ribbon', 'in_feed'],
    weight: 3,
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
    id: 'promptfm_club',
    sponsor: 'PromptFM Creator Club',
    title: 'Support 24/7 Cloud Streams & Get Airplay',
    tagline: 'Community Powered',
    description: 'Keep the servers running, unlock custom AI DJ dedications, and earn verified creator flair.',
    ctaText: 'Join Creator Club',
    targetUrl: 'https://promptfm.live/submit',
    badge: 'Station Patron',
    placements: ['header_ribbon', 'in_feed'],
    weight: 4,
    active: true,
  },
];

// In-memory telemetry cache for impression and click counts
const telemetryStore: Record<string, { impressions: number; clicks: number }> = {};

export function clearAdStatsForTesting(): void {
  for (const key of Object.keys(telemetryStore)) {
    delete telemetryStore[key];
  }
}

/**
 * Returns active sponsor banners targeted for a specific web layout placement.
 */
export function getActiveSponsorBanners(placement: AdPlacement): SponsorBanner[] {
  return DEFAULT_SPONSOR_CAMPAIGNS.filter(
    (b) => b.active && b.placements.includes(placement)
  );
}

/**
 * Finds a sponsor banner by its unique ID.
 */
export function getBannerById(id: string): SponsorBanner | undefined {
  if (!id || !id.trim()) return undefined;
  return DEFAULT_SPONSOR_CAMPAIGNS.find((b) => b.id === id.trim());
}

/**
 * Records an impression or click event for a sponsor campaign.
 */
export function recordAdEvent(adId: string, event: AdEventType): boolean {
  if (!adId || !adId.trim()) return false;
  if (event !== 'impression' && event !== 'click') return false;

  const cleanId = adId.trim();
  if (!telemetryStore[cleanId]) {
    telemetryStore[cleanId] = { impressions: 0, clicks: 0 };
  }

  if (event === 'impression') {
    telemetryStore[cleanId].impressions++;
  } else if (event === 'click') {
    telemetryStore[cleanId].clicks++;
  }

  return true;
}

/**
 * Computes performance metrics (impressions, clicks, click-through rate) for an ad.
 */
export function getAdStats(adId: string): AdStats {
  if (!adId || !adId.trim()) {
    return { impressions: 0, clicks: 0, ctrPercent: 0 };
  }

  const cleanId = adId.trim();
  const raw = telemetryStore[cleanId] || { impressions: 0, clicks: 0 };
  const ctr = raw.impressions > 0 ? (raw.clicks / raw.impressions) * 100 : 0;

  return {
    impressions: raw.impressions,
    clicks: raw.clicks,
    ctrPercent: Math.round(ctr * 100) / 100,
  };
}
