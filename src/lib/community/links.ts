// src/lib/community/links.ts
// Centralized, verified external community links and protocol endpoints

export interface CommunityLinks {
  discord: string;
  telegramChannel: string;
  telegramBot: string;
  mcpProtocol: string;
}

export function getCommunityLinks(): CommunityLinks {
  return {
    discord: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || 'https://discord.gg/promptfm',
    telegramChannel: process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL || 'https://t.me/promptfm_live',
    telegramBot: process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/PromptFMLiveBot',
    mcpProtocol: '/api/mcp',
  };
}

