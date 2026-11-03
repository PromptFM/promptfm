// src/lib/radio/schedule.ts
// PromptFM 24/7 Channel Broadcast Schedule Engine
// Generates full 24-hour daily programming blocks, active live show resolution,
// DJ rosters, hourly clock wheel milestones, and timezone conversions.

import { OFFICIAL_CHANNELS, RadioChannel } from './channels';
import { getAllDJs, getDJById, DJProfile } from '../dj/roster';

export interface ClockMilestone {
  minute: number;
  title: string;
  type: 'news' | 'weather' | 'ad' | 'dj_banter' | 'recap';
  icon: string;
  description: string;
}

export interface ScheduleBlock {
  id: string;
  time_utc: string;
  start_hour_utc: number;
  end_hour_utc: number;
  show: string;
  dj: DJProfile;
  genre: string;
  ai_tools: string[];
  dj_prompt_style: string;
  is_live: boolean;
  clock_milestones: ClockMilestone[];
}

export interface StationSchedule {
  channel: RadioChannel;
  current_show: ScheduleBlock | null;
  upcoming_shows: ScheduleBlock[];
  blocks: ScheduleBlock[];
  generated_at_utc: string;
}

const STANDARD_HOURLY_MILESTONES: ClockMilestone[] = [
  {
    minute: 0,
    title: 'Top of the Hour AI News Flash',
    type: 'news',
    icon: 'Radio',
    description: 'Live generative AI breakthroughs, open weights, and community charts.',
  },
  {
    minute: 15,
    title: 'Global Weather Check',
    type: 'weather',
    icon: 'CloudSun',
    description: 'Live temperatures and atmospheric updates from listener cities worldwide.',
  },
  {
    minute: 20,
    title: 'Creator & Sponsor Spotlight',
    type: 'ad',
    icon: 'Sparkles',
    description: 'Live AI-voiced spot spotlighting community track submissions & creator tools.',
  },
  {
    minute: 40,
    title: 'Community Showcase Ad',
    type: 'ad',
    icon: 'Megaphone',
    description: 'Prompts from creators and listeners featured across the network.',
  },
  {
    minute: 45,
    title: 'AI DJ Banter & Music Lore',
    type: 'dj_banter',
    icon: 'Mic',
    description: 'Spontaneous witty observations, prompt engineering tips, and artist trivia.',
  },
];

/**
 * Checks if a given UTC hour falls within a start and end hour range,
 * properly handling midnight crossovers (e.g. 20:00 to 06:00).
 */
export function isHourInBlock(hourUtc: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return true;
  if (startHour < endHour) {
    return hourUtc >= startHour && hourUtc < endHour;
  }
  // Midnight wrap (e.g. 20 to 6)
  return hourUtc >= startHour || hourUtc < endHour;
}

/**
 * Builds schedule blocks for the Main Stage channel.
 */
function getMainStageBlocks(refHourUtc: number): ScheduleBlock[] {
  const djNeon = getDJById('dj_neon');
  const djLuna = getDJById('dj_luna');
  const djCipher = getDJById('dj_cipher');

  return [
    {
      id: 'main-morning-beats',
      time_utc: '06:00 - 10:00 UTC',
      start_hour_utc: 6,
      end_hour_utc: 10,
      show: 'Morning Beats & AI Briefings',
      dj: djNeon,
      genre: 'Upbeat Electro, Lofi Coffee, Pop Synth',
      ai_tools: ['Suno', 'Udio'],
      dj_prompt_style: 'High morning energy, optimistic, coffee-vibes',
      is_live: isHourInBlock(refHourUtc, 6, 10),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
    {
      id: 'main-deep-focus',
      time_utc: '10:00 - 15:00 UTC',
      start_hour_utc: 10,
      end_hour_utc: 15,
      show: 'Deep Focus & Generative Ambient',
      dj: djLuna,
      genre: 'Ambient, Chillwave, Neural Soundscapes',
      ai_tools: ['Stable Audio', 'Other'],
      dj_prompt_style: 'Calm, soothing, minimalist radio whispers',
      is_live: isHourInBlock(refHourUtc, 10, 15),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
    {
      id: 'main-cyberpunk-rush',
      time_utc: '15:00 - 20:00 UTC',
      start_hour_utc: 15,
      end_hour_utc: 20,
      show: 'Cyberpunk Rush & Community Showcase',
      dj: djNeon,
      genre: 'Dark Synthwave, Cyberpunk, Darksynth',
      ai_tools: ['Suno', 'Udio'],
      dj_prompt_style: 'Gritty, futuristic, high-octane 80s synth DJ',
      is_live: isHourInBlock(refHourUtc, 15, 20),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
    {
      id: 'main-night-shift',
      time_utc: '20:00 - 06:00 UTC',
      start_hour_utc: 20,
      end_hour_utc: 6,
      show: 'Night Shift: Experimental & Free Requests',
      dj: djCipher,
      genre: 'All Community Tracks & Listener Queued Prompts',
      ai_tools: ['All Models'],
      dj_prompt_style: 'Late night pirate radio host, candid, interactive',
      is_live: isHourInBlock(refHourUtc, 20, 6),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
  ];
}

/**
 * Builds schedule blocks for Cyberpunk channel.
 */
function getCyberpunkBlocks(refHourUtc: number): ScheduleBlock[] {
  const djCipher = getDJById('dj_cipher');

  return [
    {
      id: 'cyber-neural-dawn',
      time_utc: '06:00 - 12:00 UTC',
      start_hour_utc: 6,
      end_hour_utc: 12,
      show: 'Neural Boot: Industrial Dawn',
      dj: djCipher,
      genre: 'Industrial EBM, Dark Synth, Cyber Breaks',
      ai_tools: ['Suno', 'Udio'],
      dj_prompt_style: 'Underground hacker boot sequence, cold dry wit',
      is_live: isHourInBlock(refHourUtc, 6, 12),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
    {
      id: 'cyber-grid-overdrive',
      time_utc: '12:00 - 18:00 UTC',
      start_hour_utc: 12,
      end_hour_utc: 18,
      show: 'Cyber Grid: High-Octane Darksynth',
      dj: djCipher,
      genre: 'Darkwave, Electro-Industrial, Cyber Bass',
      ai_tools: ['Suno', 'Udio'],
      dj_prompt_style: 'Pumping fast-lane cyberpunk pirate broadcast',
      is_live: isHourInBlock(refHourUtc, 12, 18),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
    {
      id: 'cyber-underground',
      time_utc: '18:00 - 06:00 UTC',
      start_hour_utc: 18,
      end_hour_utc: 6,
      show: 'Neon Overdrive: Underground Terminal Sessions',
      dj: djCipher,
      genre: 'Experimental Cyberpunk, Glitch Hop, Dark AI Beats',
      ai_tools: ['Suno', 'Udio', 'Stable Audio'],
      dj_prompt_style: 'Late night pirate radio, uncensored code commentary',
      is_live: isHourInBlock(refHourUtc, 18, 6),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
  ];
}

/**
 * Builds schedule blocks for Chillout & Ambient channel.
 */
function getChilloutBlocks(refHourUtc: number): ScheduleBlock[] {
  const djLuna = getDJById('dj_luna');

  return [
    {
      id: 'chill-morning-horizon',
      time_utc: '06:00 - 12:00 UTC',
      start_hour_utc: 6,
      end_hour_utc: 12,
      show: 'Morning Horizon: Ambient Dawn',
      dj: djLuna,
      genre: 'Minimal Ambient, Drone, Morning Piano Soundscapes',
      ai_tools: ['Stable Audio', 'Other'],
      dj_prompt_style: 'Calm, meditative, peaceful gentle whispers',
      is_live: isHourInBlock(refHourUtc, 6, 12),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
    {
      id: 'chill-neural-flow',
      time_utc: '12:00 - 18:00 UTC',
      start_hour_utc: 12,
      end_hour_utc: 18,
      show: 'Neural Flow: Deep Focus & Generative Lofi',
      dj: djLuna,
      genre: 'Lo-Fi Chill, Study Beats, Generative Chillwave',
      ai_tools: ['Stable Audio', 'Suno'],
      dj_prompt_style: 'Focused flow state guide, peaceful ambiance',
      is_live: isHourInBlock(refHourUtc, 12, 18),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
    {
      id: 'chill-midnight-slumber',
      time_utc: '18:00 - 06:00 UTC',
      start_hour_utc: 18,
      end_hour_utc: 6,
      show: 'Midnight Slumber: Meditative AI Soundscapes',
      dj: djLuna,
      genre: 'Deep Ambient Drone, Binaural Sleep Waves, Soft Chords',
      ai_tools: ['Stable Audio'],
      dj_prompt_style: 'Whispered night serenity, zero loud interruptions',
      is_live: isHourInBlock(refHourUtc, 18, 6),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
  ];
}

/**
 * Builds schedule blocks for Kids & Family channel.
 */
function getKidsBlocks(refHourUtc: number): ScheduleBlock[] {
  const djPixel = getDJById('dj_pixel');

  return [
    {
      id: 'kids-morning-cartoons',
      time_utc: '06:00 - 12:00 UTC',
      start_hour_utc: 6,
      end_hour_utc: 12,
      show: 'Pixel Pals: Morning Cartoons & Chiptunes',
      dj: djPixel,
      genre: '8-Bit Arcade, Upbeat Game Themes, Playful Pop',
      ai_tools: ['Suno', 'Udio'],
      dj_prompt_style: 'Super cheerful, gaming references, 100% wholesome',
      is_live: isHourInBlock(refHourUtc, 6, 12),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
    {
      id: 'kids-arcade-quest',
      time_utc: '12:00 - 19:00 UTC',
      start_hour_utc: 12,
      end_hour_utc: 19,
      show: 'Arcade Adventure: Upbeat 8-Bit Quest',
      dj: djPixel,
      genre: 'Chiptune, Wholesome Synth Melodies, Sing-alongs',
      ai_tools: ['Suno', 'Udio'],
      dj_prompt_style: 'High-energy side-scroller host, family friendly puzzles',
      is_live: isHourInBlock(refHourUtc, 12, 19),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
    {
      id: 'kids-lullaby-land',
      time_utc: '19:00 - 06:00 UTC',
      start_hour_utc: 19,
      end_hour_utc: 6,
      show: 'Lullaby Land: Gentle 8-Bit Sleep Melodies',
      dj: djPixel,
      genre: 'Soft Music Box, Gentle Chiptune Lullabies, Calming Harp',
      ai_tools: ['Stable Audio', 'Suno'],
      dj_prompt_style: 'Gentle, sleepy nighttime stories and quiet melodies',
      is_live: isHourInBlock(refHourUtc, 19, 6),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
  ];
}

/**
 * Builds schedule blocks for After Dark 18+ channel.
 */
function getAfterDarkBlocks(refHourUtc: number): ScheduleBlock[] {
  const djCipher = getDJById('dj_cipher');
  const djVance = getDJById('dj_vance');

  return [
    {
      id: 'afterdark-daytime-grooves',
      time_utc: '06:00 - 22:00 UTC',
      start_hour_utc: 6,
      end_hour_utc: 22,
      show: 'Watershed Warmup: Deep Bass & Uncut Grooves',
      dj: djVance,
      genre: 'Heavy Bass, Dark Synth, Instrumental Grooves',
      ai_tools: ['Suno', 'Udio'],
      dj_prompt_style: 'Smooth velvet baritone, mature music appreciation',
      is_live: isHourInBlock(refHourUtc, 6, 22),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
    {
      id: 'afterdark-midnight-uncensored',
      time_utc: '22:00 - 06:00 UTC',
      start_hour_utc: 22,
      end_hour_utc: 6,
      show: 'After Dark Uncensored: Underground AI Beats & Raw Lyricism',
      dj: djCipher,
      genre: 'Explicit Rap, Darkcore AI, Raw Synthwave, Uncensored Prompts',
      ai_tools: ['Suno', 'Udio'],
      dj_prompt_style: 'Raw underground pirate radio host, unfiltered candid grit',
      is_live: isHourInBlock(refHourUtc, 22, 6),
      clock_milestones: STANDARD_HOURLY_MILESTONES,
    },
  ];
}

/**
 * Returns the schedule block matching a specific UTC hour for a channel.
 */
export function getScheduleBlockForHour(hourUtc: number, channelSlug = 'main'): ScheduleBlock | null {
  const schedule = getStationSchedule(channelSlug, new Date(Date.UTC(2026, 0, 1, hourUtc, 0, 0)));
  return schedule.current_show;
}

/**
 * Returns full 24-hour broadcast programming for a given channel.
 */
export function getStationSchedule(channelSlug = 'main', referenceDate = new Date()): StationSchedule {
  const channel = OFFICIAL_CHANNELS.find((c) => c.slug === channelSlug) || OFFICIAL_CHANNELS[0]!;
  const refHourUtc = referenceDate.getUTCHours();

  let blocks: ScheduleBlock[];
  switch (channel.slug) {
    case 'cyberpunk':
      blocks = getCyberpunkBlocks(refHourUtc);
      break;
    case 'chillout':
      blocks = getChilloutBlocks(refHourUtc);
      break;
    case 'kids':
      blocks = getKidsBlocks(refHourUtc);
      break;
    case 'afterdark':
      blocks = getAfterDarkBlocks(refHourUtc);
      break;
    case 'main':
    default:
      blocks = getMainStageBlocks(refHourUtc);
      break;
  }

  const currentShow = blocks.find((b) => b.is_live) || blocks[0] || null;
  const currentIndex = currentShow ? blocks.indexOf(currentShow) : -1;
  const upcomingShows =
    currentIndex >= 0
      ? [...blocks.slice(currentIndex + 1), ...blocks.slice(0, currentIndex)]
      : blocks;

  return {
    channel,
    current_show: currentShow,
    upcoming_shows: upcomingShows,
    blocks,
    generated_at_utc: referenceDate.toISOString(),
  };
}

/**
 * Returns daily broadcast schedule for all official channels.
 */
export function getAllChannelsSchedule(referenceDate = new Date()): StationSchedule[] {
  return OFFICIAL_CHANNELS.map((ch) => getStationSchedule(ch.slug, referenceDate));
}

