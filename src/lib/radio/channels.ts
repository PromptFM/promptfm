// src/lib/radio/channels.ts
// PromptFM Official Live Theme Radio Channels Service
// Manages stream channels, active DJ assignments, vibes, and parental ratings.

import { buildStreamUrlForChannel } from '../audio/stream-config';

export interface RadioChannel {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  vibe: string;
  badge: string;
  accentColor: string;
  icon: string;
  djId: string;
  djName: string;
  isFamilySafe: boolean;
  minAge?: number;
  requiresAgeGate?: boolean;
  allowExplicitAllDay?: boolean;
  ageGateDisclaimer?: string;
  streamUrl: string;
  isActive: boolean;
  enabled?: boolean;
}

export const DEFAULT_CHANNEL_SLUG = 'main';

export const OFFICIAL_CHANNELS: readonly RadioChannel[] = [
  {
    slug: 'main',
    name: 'PromptFM Main Stage',
    shortName: 'Main Stage',
    description: 'Community top-voted AI hits, chart countdowns, and prime-time DJ shifts.',
    vibe: 'Top AI Hits · Synthwave · Community Hot 40',
    badge: '🏆 Top Hits',
    accentColor: 'emerald',
    icon: 'Radio',
    djId: 'dj_neon',
    djName: 'DJ Neon',
    isFamilySafe: true,
    minAge: 0,
    requiresAgeGate: false,
    allowExplicitAllDay: false,
    streamUrl: buildStreamUrlForChannel('main'),
    isActive: true,
    enabled: true,
  },
  {
    slug: 'cyberpunk',
    name: 'Cyberpunk & Synth',
    shortName: 'Cyberpunk',
    description: 'High energy dark synthwave, industrial basslines, and late-night underground radio.',
    vibe: 'Dark Synthwave · Industrial EBM · Cyber Bass',
    badge: '⚡ Cyberpunk',
    accentColor: 'purple',
    icon: 'Zap',
    djId: 'dj_cipher',
    djName: 'DJ Cipher',
    isFamilySafe: false,
    minAge: 0,
    requiresAgeGate: false,
    allowExplicitAllDay: false,
    streamUrl: buildStreamUrlForChannel('cyberpunk'),
    isActive: false,
    enabled: false,
  },
  {
    slug: 'chillout',
    name: 'Chillout & Ambient',
    shortName: 'Chillout',
    description: 'Soothing lo-fi study beats, generative soundscapes, and meditative ambient.',
    vibe: 'Lo-Fi Chill · Ambient Drone · Study Focus',
    badge: '🌙 Chillout',
    accentColor: 'teal',
    icon: 'Moon',
    djId: 'dj_luna',
    djName: 'DJ Luna',
    isFamilySafe: true,
    minAge: 0,
    requiresAgeGate: false,
    allowExplicitAllDay: false,
    streamUrl: buildStreamUrlForChannel('chillout'),
    isActive: false,
    enabled: false,
  },
  {
    slug: 'kids',
    name: 'Kids & Family',
    shortName: 'Kids Jam',
    description: 'Playful 8-bit chiptunes, uplifting gaming melodies, and 100% wholesome family radio.',
    vibe: 'Chiptune · 8-Bit Arcade · Playful Beats',
    badge: '👾 Kids & Family',
    accentColor: 'amber',
    icon: 'Gamepad2',
    djId: 'dj_pixel',
    djName: 'DJ Pixel',
    isFamilySafe: true,
    minAge: 0,
    requiresAgeGate: false,
    allowExplicitAllDay: false,
    streamUrl: buildStreamUrlForChannel('kids'),
    isActive: false,
    enabled: false,
  },
  {
    slug: 'afterdark',
    name: 'After Dark (18+ Explicit)',
    shortName: 'After Dark 18+',
    description: '24/7 uncensored AI music, explicit lyrics, dark electronic, and raw underground bass.',
    vibe: 'Explicit 18+ · Uncensored 24/7 · Raw Underground',
    badge: '🔞 18+ Explicit',
    accentColor: 'rose',
    icon: 'Flame',
    djId: 'dj_cipher',
    djName: 'DJ Cipher',
    isFamilySafe: false,
    minAge: 18,
    requiresAgeGate: true,
    allowExplicitAllDay: true,
    ageGateDisclaimer: 'LEGAL AGE CONFIRMATION & CONSENT: This channel broadcasts uncensored audio containing adult language, profanity, and mature themes 24 hours a day. By proceeding, you certify under penalty of law that you are at least 18 years of age (or the legal age of majority in your jurisdiction), understand the adult nature of the programming, and affirmatively consent to receiving explicit broadcast content. If you are under 18, please select a Family Safe channel.',
    streamUrl: buildStreamUrlForChannel('afterdark'),
    isActive: false,
    enabled: false,
  },
] as const;

const channelActiveOverrides = new Map<string, boolean>();

/**
 * Resets dynamic runtime channel active overrides (used in testing and maintenance).
 */
export function resetChannelActiveOverrides(): void {
  channelActiveOverrides.clear();
}

/**
 * Sets dynamic runtime active status override for a channel slug.
 */
export function setChannelActiveOverride(slug: string, isActive: boolean): void {
  channelActiveOverrides.set(slug.toLowerCase().trim(), isActive);
}

/**
 * Returns whether a channel slug corresponds to an active (enabled) channel.
 */
export function isChannelActive(slug?: string | null): boolean {
  if (!slug) return false;
  const clean = slug.toLowerCase().trim();
  if (channelActiveOverrides.has(clean)) {
    return Boolean(channelActiveOverrides.get(clean));
  }
  const channel = OFFICIAL_CHANNELS.find((c) => c.slug === clean);
  return channel?.isActive ?? false;
}

/**
 * Checks whether a channel is currently public and enabled.
 */
export function isChannelPublic(slug?: string | null): boolean {
  return isChannelActive(slug);
}

/**
 * Returns all official PromptFM radio channels with current active state.
 * Can optionally filter to public-only/active channels.
 */
export function getAllChannels(options: { publicOnly?: boolean } = {}): RadioChannel[] {
  if (options.publicOnly) {
    return getPublicChannels();
  }
  return OFFICIAL_CHANNELS.map((ch) => {
    const active = channelActiveOverrides.has(ch.slug)
      ? Boolean(channelActiveOverrides.get(ch.slug))
      : ch.isActive;
    return {
      ...ch,
      isActive: active,
      enabled: active,
    };
  });
}

/**
 * Returns only currently active/enabled radio channels.
 */
export function getActiveChannels(): RadioChannel[] {
  return getAllChannels().filter((c) => c.isActive !== false);
}

/**
 * Returns all active public PromptFM radio channels.
 * Channels disabled or pending multi-channel scheduling are excluded.
 */
export function getPublicChannels(): RadioChannel[] {
  return getActiveChannels();
}

/**
 * Resolves an active public channel by slug, falling back to main stage if not public.
 */
export function getPublicChannelBySlug(slug?: string | null): RadioChannel {
  const publicChannels = getPublicChannels();
  const defaultChannel = publicChannels[0] || OFFICIAL_CHANNELS[0]!;
  if (!slug) {
    return defaultChannel;
  }
  const clean = slug.toLowerCase().trim();
  return publicChannels.find((c) => c.slug === clean) || defaultChannel;
}

/**
 * Validates whether a string is a recognized official channel slug.
 */
export function isValidChannelSlug(
  slug?: string | null,
  options: { publicOnly?: boolean } = {}
): boolean {
  if (!slug) return false;
  const clean = slug.toLowerCase().trim();
  const list = options.publicOnly ? getPublicChannels() : OFFICIAL_CHANNELS;
  return list.some((c) => c.slug === clean);
}

/**
 * Resolves a channel by slug, falling back to main stage if not recognized or if inactive when requireActive is true.
 */
export function getChannelBySlug(slug?: string | null, requireActive = false): RadioChannel {
  const all = getAllChannels();
  if (!slug) {
    return all[0]!;
  }
  const clean = slug.toLowerCase().trim();
  const found = all.find((c) => c.slug === clean);
  if (requireActive && found && !found.isActive) {
    return all[0]!;
  }
  return found || all[0]!;
}

/**
 * Returns the stream mount or playback URL for the given channel.
 */
export function getStreamUrlForChannel(slug?: string | null): string {
  const channel = getChannelBySlug(slug);
  return channel.streamUrl;
}
