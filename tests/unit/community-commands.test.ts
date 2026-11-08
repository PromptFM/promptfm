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
      expect(AIRPLAY_CLOCK_SEGMENTS[0]?.title).toBe('Top 40 Power');

      expect(AIRPLAY_CLOCK_SEGMENTS[1]?.range).toBe(':15 – :30');
      expect(AIRPLAY_CLOCK_SEGMENTS[1]?.title).toBe('Deep Cuts');

      expect(AIRPLAY_CLOCK_SEGMENTS[2]?.range).toBe(':30 – :45');
      expect(AIRPLAY_CLOCK_SEGMENTS[2]?.title).toBe('Rhythm Transition');

      expect(AIRPLAY_CLOCK_SEGMENTS[3]?.range).toBe(':45 – :00');
      expect(AIRPLAY_CLOCK_SEGMENTS[3]?.title).toBe('Listener Showcase');
    });

    it('resolves active segment accurately for current minute (including 15:11 -> Top 40 Power)', () => {
      // 15:11 -> minute 11 should be Top 40 Power (:00 - :15)
      const segAt11 = getActiveClockSegment(11);
      expect(segAt11.index).toBe(0);
      expect(segAt11.title).toBe('Top 40 Power');
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
    });
  });
  it('contains valid definitions for all essential listener commands', () => {
    expect(LISTENER_COMMANDS.length).toBeGreaterThanOrEqual(8);

    const songCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/song'));
    expect(songCmd).toBeDefined();
    expect(songCmd?.category).toBe('Airplay');
    expect(songCmd?.example).toContain('/song');
    expect(songCmd?.desc).toContain('Queue an AI track');

    const queueCmd = LISTENER_COMMANDS.find((c) => c.command === '/queue');
    expect(queueCmd).toBeDefined();
    expect(queueCmd?.desc).toContain('View the upcoming 5 songs');

    const reqCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/request'));
    expect(reqCmd).toBeDefined();
    expect(reqCmd?.desc).toContain('lifecycle status');
    expect(reqCmd?.category).toBe('Airplay');

    const npCmd = LISTENER_COMMANDS.find((c) => c.command === '/nowplaying');
    expect(npCmd).toBeDefined();
    expect(npCmd?.category).toBe('Info');

    const voteCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/vote'));
    expect(voteCmd).toBeDefined();

    const dedicateCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/dedicate'));
    expect(dedicateCmd).toBeDefined();
    expect(dedicateCmd?.category).toBe('Community');

    const weatherCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/weather'));
    expect(weatherCmd).toBeDefined();

    const zodiacCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/zodiac'));
    expect(zodiacCmd).toBeDefined();

    const reportCmd = LISTENER_COMMANDS.find((c) => c.command.startsWith('/report'));
    expect(reportCmd).toBeDefined();

    const helpCmd = LISTENER_COMMANDS.find((c) => c.command === '/help');
    expect(helpCmd).toBeDefined();
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
