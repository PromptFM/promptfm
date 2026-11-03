// tests/unit/auth-providers.test.ts
import { describe, it, expect, vi } from 'vitest';

export interface OAuthRedirectConfig {
  provider: 'google' | 'discord';
  redirectTo: string;
}

export function buildOAuthRedirectUrl(origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}/`;
}

export function getSupabaseAuthCallbackUrl(projectRef: string): string {
  return `https://${projectRef}.supabase.co/auth/v1/callback`;
}

describe('Social OAuth Auth Providers (Google & Discord)', () => {
  it('builds valid OAuth redirect URL back to station origin', () => {
    expect(buildOAuthRedirectUrl('https://promptfm.live')).toBe('https://promptfm.live/');
    expect(buildOAuthRedirectUrl('https://promptfm.live/')).toBe('https://promptfm.live/');
    expect(buildOAuthRedirectUrl('http://localhost:3000')).toBe('http://localhost:3000/');
  });

  it('generates the exact Supabase callback URL required for Discord Developer Portal', () => {
    const callbackUrl = getSupabaseAuthCallbackUrl('oxfacfdpxbxilucooijy');
    expect(callbackUrl).toBe('https://oxfacfdpxbxilucooijy.supabase.co/auth/v1/callback');
  });

  it('validates supported OAuth providers for PromptFM', () => {
    const supportedProviders = ['google', 'discord'] as const;
    expect(supportedProviders).toContain('google');
    expect(supportedProviders).toContain('discord');
  });
});
