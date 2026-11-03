// src/lib/radio/channels.ts
// PromptFM Official Live Theme Radio Channels Service
// Manages stream channels, active DJ assignments, vibes, and parental ratings.

import { DEFAULT_STREAM_URL } from '../audio/player-controller';

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
    streamUrl: DEFAULT_STREAM_URL,
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
    streamUrl: `${DEFAULT_STREAM_URL}?channel=cyberpunk`,
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
    streamUrl: `${DEFAULT_STREAM_URL}?channel=chillout`,
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
    streamUrl: `${DEFAULT_STREAM_URL}?channel=kids`,
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
    streamUrl: `${DEFAULT_STREAM_URL}?channel=afterdark`,
  },
] as const;

/**
 * Returns all official PromptFM radio channels.
 */
export function getAllChannels(): RadioChannel[] {
  return [...OFFICIAL_CHANNELS];
}

/**
 * Validates whether a string is a recognized official channel slug.
 */
export function isValidChannelSlug(slug?: string | null): boolean {
  if (!slug) return false;
  const clean = slug.toLowerCase().trim();
  return OFFICIAL_CHANNELS.some((c) => c.slug === clean);
}

/**
 * Resolves a channel by slug, falling back to main stage if not recognized.
 */
export function getChannelBySlug(slug?: string | null): RadioChannel {
  if (!slug) {
    return OFFICIAL_CHANNELS[0]!;
  }
  const clean = slug.toLowerCase().trim();
  const found = OFFICIAL_CHANNELS.find((c) => c.slug === clean);
  return found || OFFICIAL_CHANNELS[0]!;
}

/**
 * Returns the stream mount or playback URL for the given channel.
 */
export function getStreamUrlForChannel(slug?: string | null): string {
  const channel = getChannelBySlug(slug);
  return channel.streamUrl;
}
