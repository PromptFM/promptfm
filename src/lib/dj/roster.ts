// src/lib/dj/roster.ts
// PromptFM AI DJ Roster & Sponsor Ad Engine
// Manages DJ personas, voices (Google Cloud TTS / Journey), timeslot rotations, and sponsor spots.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface DJVoiceConfig {
  name: string;
  languageCode: string;
  ssmlGender: 'FEMALE' | 'MALE' | 'NEUTRAL';
  speakingRate?: number;
  pitch?: number;
}

export interface DJProfile {
  id: string;
  name: string;
  title: string;
  bio: string;
  stylePrompt: string;
  voice: DJVoiceConfig;
  shifts: string[]; // e.g. ["06:00 - 10:00"]
  defaultChannels: string[];
}

export interface AdSpotConfig {
  id: string;
  sponsor: string;
  title: string;
  type: 'ai_read' | 'pre_recorded';
  copy?: string;
  audioUrl?: string;
  durationSeconds: number;
  weight: number;
  active: boolean;
}

export interface AdsConfig {
  enabled: boolean;
  frequencyTracks: number;
  clockMinutes: number[];
  minIntervalMinutes: number;
  spots: AdSpotConfig[];
}

export interface ParentalControlConfig {
  enabled: boolean;
  safeChannels: string[];
  allowExplicitLateNight: boolean;
  lateNightStartUtc: number;
  lateNightEndUtc: number;
  blockSevereProfanity: boolean;
}

export const DEFAULT_PARENTAL_CONTROL: ParentalControlConfig = {
  enabled: true,
  safeChannels: ['kids', 'chillout'],
  allowExplicitLateNight: true,
  lateNightStartUtc: 22,
  lateNightEndUtc: 6,
  blockSevereProfanity: true,
};

// ── Built-in DJ Roster (Used as robust fallbacks if YAML is missing) ─────────

export const DEFAULT_DJS: DJProfile[] = [
  {
    id: 'dj_neon',
    name: 'DJ Neon',
    title: 'The Electric Morning Host & Synth Enthusiast',
    bio: 'High-energy, tech-optimist host who lives on the cutting edge of AI models and electronic synth beats.',
    stylePrompt: 'High morning energy, witty, fast-paced, optimistic radio charisma with subtle sci-fi flair.',
    voice: {
      name: 'en-US-Journey-F',
      languageCode: 'en-US',
      ssmlGender: 'FEMALE',
      speakingRate: 1.05,
      pitch: 0.0,
    },
    shifts: ['06:00 - 10:00', '15:00 - 20:00'],
    defaultChannels: ['main'],
  },
  {
    id: 'dj_luna',
    name: 'DJ Luna',
    title: 'The Ambient Nomad & Chillwave Whisperer',
    bio: 'Soothing, reflective minimalist voice who guides listeners through deep focus sessions, generative soundscapes, and lofi beats.',
    stylePrompt: 'Calm, warm, soothing, poetic, relaxed radio whisper. Never shouts; speaks with intimate, meditative warmth.',
    voice: {
      name: 'en-US-Journey-D',
      languageCode: 'en-US',
      ssmlGender: 'MALE',
      speakingRate: 0.95,
      pitch: -1.0,
    },
    shifts: ['10:00 - 15:00'],
    defaultChannels: ['chillout'],
  },
  {
    id: 'dj_cipher',
    name: 'DJ Cipher',
    title: 'The Cyberpunk Hacker & Night Shift Renegade',
    bio: 'Gritty, mysterious late-night pirate radio host broadcasting from an underground terminal with dry humor and philosophical punchlines.',
    stylePrompt: 'Gritty, late-night pirate radio host, deadpan dry wit, deep knowledge of code, neural weights, and dark synthwave.',
    voice: {
      name: 'en-US-Neural2-J',
      languageCode: 'en-US',
      ssmlGender: 'MALE',
      speakingRate: 1.0,
      pitch: -2.5,
    },
    shifts: ['20:00 - 06:00'],
    defaultChannels: ['cyberpunk'],
  },
  {
    id: 'dj_pixel',
    name: 'DJ Pixel',
    title: 'The 8-Bit Chiptune & Family Jam Host',
    bio: 'Bubbly, energetic, game-loving host playing upbeat tunes, playful chiptunes, and family-friendly AI melodies.',
    stylePrompt: 'Playful, joyful, super enthusiastic, arcade gaming references, friendly and upbeat.',
    voice: {
      name: 'en-US-Neural2-F',
      languageCode: 'en-US',
      ssmlGender: 'FEMALE',
      speakingRate: 1.15,
      pitch: 2.5,
    },
    shifts: [],
    defaultChannels: ['kids'],
  },
  {
    id: 'dj_vance',
    name: 'DJ Vance',
    title: 'The Velvet Baritone & Chart Countdown Master',
    bio: 'Classic golden-era FM broadcaster with a rich, resonant velvet voice who presents the weekly Top 20 countdown and community milestones.',
    stylePrompt: 'Classic FM velvet baritone, smooth, authoritative, nostalgic, legendary radio host delivery.',
    voice: {
      name: 'en-US-Neural2-D',
      languageCode: 'en-US',
      ssmlGender: 'MALE',
      speakingRate: 0.98,
      pitch: -3.5,
    },
    shifts: [],
    defaultChannels: [],
  },
];

export const DEFAULT_ADS: AdsConfig = {
  enabled: true,
  frequencyTracks: 5,
  clockMinutes: [20, 40],
  minIntervalMinutes: 12,
  spots: [
    {
      id: 'promptfm_creator_drop',
      sponsor: 'PromptFM Creators',
      title: 'Submit Your AI Tracks for Airplay',
      type: 'ai_read',
      copy: 'Calling all prompt producers and generative musicians. Have a track you created with AI? Submit it right now at promptfm.live to get featured in our daily rotation and weekly leaderboard.',
      durationSeconds: 15,
      weight: 4,
      active: true,
    },
    {
      id: 'patreon_community',
      sponsor: 'PromptFM Community Club',
      title: 'Support PromptFM Radio',
      type: 'ai_read',
      copy: 'Love what you are hearing? PromptFM is 100 percent community driven. Support our cloud streaming servers and unlock custom DJ shoutouts at promptfm.live.',
      durationSeconds: 15,
      weight: 4,
      active: true,
    },
    {
      id: 'elevenlabs_creator',
      sponsor: 'ElevenLabs',
      title: 'Voice Cloning & Audio Generation',
      type: 'ai_read',
      copy: 'This hour of PromptFM is brought to you by next-generation voice AI. Turn your words into lifelike audio and custom voices in seconds with ElevenLabs.',
      durationSeconds: 15,
      weight: 2,
      active: true,
    },
  ],
};

/**
 * Parses DJs declared in config/schedule.yaml. Falls back to DEFAULT_DJS.
 */
export function getAllDJs(): DJProfile[] {
  try {
    const p = join(process.cwd(), 'config', 'schedule.yaml');
    if (!existsSync(p)) return DEFAULT_DJS;
    const raw = readFileSync(p, 'utf8');

    // Isolate djs: section
    const djsSectionMatch = raw.match(/djs:([\s\S]*?)(?:\n[a-z_]+:|$)/i);
    const djsText = djsSectionMatch ? djsSectionMatch[1] : raw;

    // Extract DJ blocks
    const djRegex = /-\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"[\s\S]*?bio:\s*"([^"]+)"[\s\S]*?style_prompt:\s*"([^"]+)"[\s\S]*?voice:[\s\S]*?name:\s*"([^"]+)"[\s\S]*?language_code:\s*"([^"]+)"[\s\S]*?ssml_gender:\s*"([^"]+)"(?:[\s\S]*?speaking_rate:\s*([\d.]+))?(?:[\s\S]*?pitch:\s*(-?[\d.]+))?/gi;
    const matches = [...(djsText || '').matchAll(djRegex)];

    if (matches.length > 0) {
      return matches.map((m) => {
        const id = m[1] || 'dj_neon';
        const fallback = DEFAULT_DJS.find((d) => d.id === id);
        return {
          id,
          name: m[2] || fallback?.name || id,
          title: m[3] || fallback?.title || '',
          bio: m[4] || fallback?.bio || '',
          stylePrompt: m[5] || fallback?.stylePrompt || '',
          voice: {
            name: m[6] || fallback?.voice.name || 'en-US-Journey-F',
            languageCode: m[7] || 'en-US',
            ssmlGender: (m[8] as 'FEMALE' | 'MALE' | 'NEUTRAL') || fallback?.voice.ssmlGender || 'FEMALE',
            speakingRate: m[9] ? parseFloat(m[9]) : fallback?.voice.speakingRate ?? 1.0,
            pitch: m[10] ? parseFloat(m[10]) : fallback?.voice.pitch ?? 0.0,
          },
          shifts: fallback?.shifts || [],
          defaultChannels: fallback?.defaultChannels || [],
        };
      });
    }
  } catch (e) {
    console.warn('Error reading schedule.yaml DJs:', e);
  }

  return DEFAULT_DJS;
}

/**
 * Finds a DJ by ID or name (case-insensitive).
 */
export function getDJById(idOrName?: string): DJProfile {
  const djs = getAllDJs();
  if (!idOrName) return djs[0] || DEFAULT_DJS[0]!;

  const needle = idOrName.toLowerCase().replace(/^dj[_\s-]*/i, '');
  const found = djs.find(
    (d) =>
      d.id.toLowerCase() === idOrName.toLowerCase() ||
      d.id.toLowerCase().includes(needle) ||
      d.name.toLowerCase().includes(needle)
  );

  return found || djs[0] || DEFAULT_DJS[0]!;
}

/**
 * Determines which AI DJ is currently on air based on UTC hour or channel.
 */
export function getActiveDJ(channelSlug?: string, date = new Date()): DJProfile {
  const djs = getAllDJs();

  // 1. Channel-specific DJ mapping (e.g. kids channel -> DJ Pixel)
  if (channelSlug) {
    const channelDJ = djs.find((d) => d.defaultChannels.includes(channelSlug));
    if (channelDJ) return channelDJ;
  }

  // 2. Program schedule timeslot mapping based on current UTC hour
  const currentHour = date.getUTCHours();

  if (currentHour >= 6 && currentHour < 10) {
    // 06:00 - 10:00: Morning Beats -> DJ Neon
    return getDJById('dj_neon');
  } else if (currentHour >= 10 && currentHour < 15) {
    // 10:00 - 15:00: Deep Focus & Ambient -> DJ Luna
    return getDJById('dj_luna');
  } else if (currentHour >= 15 && currentHour < 20) {
    // 15:00 - 20:00: Cyberpunk Rush -> DJ Neon (or DJ Vance during 18:00 countdown)
    if (currentHour === 18) return getDJById('dj_vance');
    return getDJById('dj_neon');
  } else {
    // 20:00 - 06:00: Night Shift -> DJ Cipher
    return getDJById('dj_cipher');
  }
}

/**
 * Parses ads configuration from config/schedule.yaml.
 */
export function getAdsConfig(): AdsConfig {
  try {
    const p = join(process.cwd(), 'config', 'schedule.yaml');
    if (!existsSync(p)) return DEFAULT_ADS;
    const raw = readFileSync(p, 'utf8');

    // Isolate ads: section
    const adsSectionMatch = raw.match(/\nads:([\s\S]*?)(?:\n[a-z_]+:|$)/i);
    const adsText = adsSectionMatch ? adsSectionMatch[1] : '';

    if (!adsText) return DEFAULT_ADS;

    const freqMatch = adsText.match(/frequency_tracks:\s*(\d+)/i);
    const enabledMatch = adsText.match(/enabled:\s*(true|false)/i);

    const spotRegex = /-\s*id:\s*"([^"]+)"[\s\S]*?sponsor:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"[\s\S]*?type:\s*"([^"]+)"(?:[\s\S]*?copy:\s*"([^"]+)")?(?:[\s\S]*?audio_url:\s*"([^"]+)")?(?:[\s\S]*?duration_seconds:\s*(\d+))?(?:[\s\S]*?weight:\s*(\d+))?(?:[\s\S]*?active:\s*(true|false))?/gi;
    const spotMatches = [...adsText.matchAll(spotRegex)];

    const spots: AdSpotConfig[] = spotMatches.map((m) => ({
      id: m[1] || 'ad-spot',
      sponsor: m[2] || 'Sponsor',
      title: m[3] || 'Promo',
      type: (m[4] as 'ai_read' | 'pre_recorded') || 'ai_read',
      copy: m[5],
      audioUrl: m[6],
      durationSeconds: m[7] ? parseInt(m[7], 10) : 15,
      weight: m[8] ? parseInt(m[8], 10) : 1,
      active: m[9] !== 'false',
    }));

    return {
      enabled: enabledMatch ? enabledMatch[1] === 'true' : true,
      frequencyTracks: freqMatch ? parseInt(freqMatch[1] || '5', 10) : 5,
      clockMinutes: [20, 40],
      minIntervalMinutes: 12,
      spots: spots.length > 0 ? spots : DEFAULT_ADS.spots,
    };
  } catch (e) {
    console.warn('Error reading schedule.yaml ads:', e);
  }

  return DEFAULT_ADS;
}

/**
 * Returns a weighted randomly chosen active sponsor spot.
 */
export function getActiveAdSpot(): AdSpotConfig | null {
  const config = getAdsConfig();
  if (!config.enabled) return null;

  const activeSpots = config.spots.filter((s) => s.active);
  if (activeSpots.length === 0) return null;

  // Weighted lottery pool
  const pool: AdSpotConfig[] = [];
  for (const spot of activeSpots) {
    const weight = Math.max(1, spot.weight || 1);
    for (let i = 0; i < weight; i++) {
      pool.push(spot);
    }
  }

  return pool[Math.floor(Math.random() * pool.length)] || activeSpots[0] || null;
}

/**
 * Parses parental control settings from config/schedule.yaml.
 */
export function getParentalControlConfig(): ParentalControlConfig {
  try {
    const p = join(process.cwd(), 'config', 'schedule.yaml');
    if (!existsSync(p)) return DEFAULT_PARENTAL_CONTROL;
    const raw = readFileSync(p, 'utf8');

    const pcMatch = raw.match(/parental_control:([\s\S]*?)(?:\n[a-z_]+:|$)/i);
    const pcText = pcMatch ? pcMatch[1] : '';
    if (!pcText) return DEFAULT_PARENTAL_CONTROL;

    const enabledMatch = pcText.match(/enabled:\s*(true|false)/i);
    const lateNightMatch = pcText.match(/allow_explicit_late_night:\s*(true|false)/i);
    const startMatch = pcText.match(/late_night_start_utc:\s*(\d+)/i);
    const endMatch = pcText.match(/late_night_end_utc:\s*(\d+)/i);
    const profanityMatch = pcText.match(/block_severe_profanity:\s*(true|false)/i);

    const safeChannelsMatches = [...pcText.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

    return {
      enabled: enabledMatch ? enabledMatch[1] === 'true' : true,
      safeChannels: safeChannelsMatches.length > 0 ? (safeChannelsMatches as string[]) : DEFAULT_PARENTAL_CONTROL.safeChannels,
      allowExplicitLateNight: lateNightMatch ? lateNightMatch[1] === 'true' : true,
      lateNightStartUtc: startMatch ? parseInt(startMatch[1] || '22', 10) : 22,
      lateNightEndUtc: endMatch ? parseInt(endMatch[1] || '6', 10) : 6,
      blockSevereProfanity: profanityMatch ? profanityMatch[1] === 'true' : true,
    };
  } catch (e) {
    console.warn('Error reading parental control config:', e);
  }

  return DEFAULT_PARENTAL_CONTROL;
}

/**
 * Checks whether a track (explicit/clean/family-friendly) is permitted to air on the given channel right now.
 */
export function isContentAllowedForAirplay(
  isExplicit = false,
  channelSlug = 'main',
  date = new Date(),
  familyFriendly?: boolean
): boolean {
  if (isExplicit) {
    const config = getParentalControlConfig();
    if (!config.enabled) return true;

    // 0. Dedicated 24/7 18+ channels (e.g. afterdark) permit explicit tracks all day long
    if (channelSlug === 'afterdark') {
      return true;
    }

    // 1. Safe channels (e.g. kids, chillout) strictly forbid explicit 18+ content 24/7
    if (config.safeChannels.includes(channelSlug)) {
      return false;
    }

    // 2. If late night watershed is enabled, only permit 18+ between lateNightStartUtc and lateNightEndUtc
    if (config.allowExplicitLateNight) {
      const currentHour = date.getUTCHours();
      const isLateNight = currentHour >= config.lateNightStartUtc || currentHour < config.lateNightEndUtc;
      return isLateNight;
    }

    return false;
  }

  // 3. For Channel 4 ('kids'), explicitly non-family-friendly content is blocked
  if (channelSlug === 'kids' && familyFriendly === false) {
    return false;
  }

  return true;
}
