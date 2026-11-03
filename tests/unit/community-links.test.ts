// tests/unit/community-links.test.ts
// Unit tests for centralized community links and environment variable overrides

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCommunityLinks } from '@/lib/community/links';

describe('Community Links Directory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('provides verified default links for Discord, Telegram Channel, and Telegram Bot', () => {
    delete process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;
    delete process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL;
    delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL;
    delete process.env.NEXT_PUBLIC_X_URL;
    delete process.env.NEXT_PUBLIC_TWITTER_URL;

    const links = getCommunityLinks();
    expect(links.discord).toBe('https://discord.gg/promptfm');
    expect(links.telegramChannel).toBe('https://t.me/promptfm_live');
    expect(links.telegramBot).toBe('https://t.me/PromptFMLiveBot');
    expect(links.xTwitter).toBe('https://x.com/promptfm_live');
    expect(links.mcpProtocol).toBe('/api/mcp');
  });

  it('allows environment variable overrides for custom invite and bot URLs', () => {
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL = 'https://discord.gg/custom-invite';
    process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL = 'https://t.me/custom_channel';
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL = 'https://t.me/custom_bot';
    process.env.NEXT_PUBLIC_X_URL = 'https://x.com/custom_handle';

    const links = getCommunityLinks();
    expect(links.discord).toBe('https://discord.gg/custom-invite');
    expect(links.telegramChannel).toBe('https://t.me/custom_channel');
    expect(links.telegramBot).toBe('https://t.me/custom_bot');
    expect(links.xTwitter).toBe('https://x.com/custom_handle');
  });
});

