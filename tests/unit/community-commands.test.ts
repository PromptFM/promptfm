// tests/unit/community-commands.test.ts
// Unit tests for listener commands directory and bot help text formatting

import { describe, it, expect } from 'vitest';
import { LISTENER_COMMANDS, getBotHelpText } from '@/lib/community/commands';

describe('Listener Commands Directory & Bot Help Formatter', () => {
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
    expect(text).toContain('`:45 - :00`');
    expect(text).toContain('https://promptfm.live');
  });

  it('generates formatted help text for Telegram Markdown', () => {
    const text = getBotHelpText('markdown_v1');
    expect(text).toContain('*PromptFM Interactive Bot & Broadcast Guide*');
    expect(text).toContain('/nowplaying');
    expect(text).toContain('/song <vibe or title>');
    expect(text).toContain(':45 - :00');
    expect(text).toContain('https://promptfm.live');
  });
});
