// tests/unit/community-commands.test.ts
// Unit tests for listener commands directory and bot help text formatting

import { describe, it, expect } from 'vitest';
import {
  LISTENER_COMMANDS,
  getBotHelpText,
  AIRPLAY_CLOCK_SEGMENTS,
  getActiveClockSegment,
} from '@/lib/community/commands';

describe('Listener Commands Directory & Bot Help Formatter', () => {
  describe('Airplay Clock Wheel & Live Segment Resolution', () => {
    it('defines 4 accurate recurring quarter-hour clock segments', () => {
      expect(AIRPLAY_CLOCK_SEGMENTS).toHaveLength(4);
      expect(AIRPLAY_CLOCK_SEGMENTS[0]?.range).toBe(':00 – :15');
      expect(AIRPLAY_CLOCK_SEGMENTS[0]?.title).toBe('Community Headliners');
      expect(AIRPLAY_CLOCK_SEGMENTS[0]?.description).toBe('Featured community AI music productions and catalog highlights.');

      expect(AIRPLAY_CLOCK_SEGMENTS[1]?.range).toBe(':15 – :30');
      expect(AIRPLAY_CLOCK_SEGMENTS[1]?.title).toBe('Deep Cuts');
      expect(AIRPLAY_CLOCK_SEGMENTS[1]?.description).toBe('Lo-Fi, ambient soundscapes, and hidden gems.');

      expect(AIRPLAY_CLOCK_SEGMENTS[2]?.range).toBe(':30 – :45');
      expect(AIRPLAY_CLOCK_SEGMENTS[2]?.title).toBe('Rhythm Transition');
      expect(AIRPLAY_CLOCK_SEGMENTS[2]?.description).toBe('High-tempo synthwave, breakbeats, and remixes.');

      expect(AIRPLAY_CLOCK_SEGMENTS[3]?.range).toBe(':45 – :00');
      expect(AIRPLAY_CLOCK_SEGMENTS[3]?.title).toBe('Listener Showcase');
      expect(AIRPLAY_CLOCK_SEGMENTS[3]?.description).toBe('Your time slot! Songs requested via /song take live priority.');
      expect(AIRPLAY_CLOCK_SEGMENTS[3]?.badge).toBe('Priority Requests');
    });

    it('resolves active segment accurately for current minute (including 15:11 -> Community Headliners)', () => {
      // 15:11 -> minute 11 should be Community Headliners (:00 - :15)
      const segAt11 = getActiveClockSegment(11);
      expect(segAt11.index).toBe(0);
      expect(segAt11.title).toBe('Community Headliners');
      expect(segAt11.range).toBe(':00 – :15');

      // Boundary tests
      expect(getActiveClockSegment(0).index).toBe(0);
      expect(getActiveClockSegment(14).index).toBe(0);

      expect(getActiveClockSegment(15).index).toBe(1);
      expect(getActiveClockSegment(20).index).toBe(1);
      expect(getActiveClockSegment(29).index).toBe(1);

      expect(getActiveClockSegment(30).index).toBe(2);
      expect(getActiveClockSegment(44).index).toBe(2);

      expect(getActiveClockSegment(45).index).toBe(3);
      expect(getActiveClockSegment(55).index).toBe(3);
      expect(getActiveClockSegment(59).index).toBe(3);

      // Clamping and fallback
      expect(getActiveClockSegment(-5).index).toBe(0);
      expect(getActiveClockSegment(100).index).toBe(3);
    });
  });
  it('contains valid definitions for all essential listener commands', () => {
    expect(LISTENER_COMMANDS.length).toBeGreaterThanOrEqual(8);

    for (const cmd of LISTENER_COMMANDS) {
      expect(cmd.command.length).toBeGreaterThan(0);
      expect(cmd.desc.length).toBeGreaterThan(0);
      expect(cmd.category.length).toBeGreaterThan(0);
      expect(cmd.example.length).toBeGreaterThan(0);
    }

    const songCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/song'));
    expect(songCmd).toBeDefined();
    expect(songCmd?.category).toBe('Airplay');
    expect(songCmd?.example).toBe('/song synthwave cyberpunk sunset');
    expect(songCmd?.desc).toBe('Queue an AI track matching your vibe into the live stream next');

    const queueCmd = LISTENER_COMMANDS.find((c) => c.command === '/queue');
    expect(queueCmd).toBeDefined();
    expect(queueCmd?.category).toBe('Airplay');
    expect(queueCmd?.desc).toBe('View the upcoming 5 songs in rotation and listener requests');
    expect(queueCmd?.example).toBe('/queue');

    const reqCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/request'));
    expect(reqCmd).toBeDefined();
    expect(reqCmd?.desc).toContain('lifecycle status');
    expect(reqCmd?.category).toBe('Airplay');

    const npCmd = LISTENER_COMMANDS.find((c) => c.command === '/nowplaying');
    expect(npCmd).toBeDefined();
    expect(npCmd?.category).toBe('Info');
    expect(npCmd?.desc).toBe('See live track metadata, host AI DJ, and tap to upvote');
    expect(npCmd?.example).toBe('/nowplaying');

    const voteCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/vote'));
    expect(voteCmd).toBeDefined();
    expect(voteCmd?.category).toBe('Airplay');
    expect(voteCmd?.desc).toBe('Cast an upvote for any track to boost its weekly chart ranking');
    expect(voteCmd?.example).toBe('/vote 186f9b8c-557858');

    const dedicateCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/dedicate'));
    expect(dedicateCmd).toBeDefined();
    expect(dedicateCmd?.category).toBe('Community');
    expect(dedicateCmd?.desc).toBe('Schedule a personalized on-air shoutout by the active DJ');
    expect(dedicateCmd?.example).toBe('/dedicate @maria Happy Birthday from PromptFM!');

    const weatherCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/weather'));
    expect(weatherCmd).toBeDefined();
    expect(weatherCmd?.category).toBe('Interactive');
    expect(weatherCmd?.desc).toBe('Request a live regional weather forecast in the next drop');
    expect(weatherCmd?.example).toBe('/weather Tokyo');

    const zodiacCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/zodiac'));
    expect(zodiacCmd).toBeDefined();
    expect(zodiacCmd?.category).toBe('Interactive');
    expect(zodiacCmd?.desc).toBe('Request a fun cosmic AI astrological reading');
    expect(zodiacCmd?.example).toBe('/zodiac Scorpio');

    const reportCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/report'));
    expect(reportCmd).toBeDefined();
    expect(reportCmd?.category).toBe('Help');
    expect(reportCmd?.desc).toBe('Alert station moderators of a standards violation or issue');
    expect(reportCmd?.example).toBe('/report track-101 Explicit lyrics on family channel');

    const helpCmd = LISTENER_COMMANDS.find((c) => c.command === '/help');
    expect(helpCmd).toBeDefined();
    expect(helpCmd?.category).toBe('Help');
    expect(helpCmd?.desc).toBe('View the full interactive command cheat sheet and guidelines');
    expect(helpCmd?.example).toBe('/help');
  });

  it('generates formatted help text for Discord', () => {
    const text = getBotHelpText('discord');
    expect(text).toContain('PromptFM Interactive Bot & Broadcast Guide');
    expect(text).toContain('`/nowplaying`');
    expect(text).toContain('`/song <vibe or title>`');
    expect(text).toContain('`/request <id or query>`');
    expect(text).toContain('`:45 - :00`');
    expect(text).toContain('https://promptfm.live');
  });

  it('generates formatted help text for Telegram Markdown', () => {
    const text = getBotHelpText('markdown_v1');
    expect(text).toContain('*PromptFM Interactive Bot & Broadcast Guide*');
    expect(text).toContain('/request <id or query>');
    expect(text).toContain('/nowplaying');
    expect(text).toContain('/song <vibe or title>');
    expect(text).toContain(':45 - :00');
    expect(text).toContain('https://promptfm.live');
  });
});
