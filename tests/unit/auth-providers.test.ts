// tests/unit/auth-providers.test.ts
// Unit tests for supported OAuth social auth providers and redirection logic

import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_OAUTH_PROVIDERS,
  type OAuthProvider,
  buildOAuthRedirectUrl,
  getSupabaseAuthCallbackUrl,
  getOAuthProviderDisplay,
} from '@/lib/auth/providers';

describe('Social OAuth Auth Providers (Google, Discord, X/Twitter, GitHub)', () => {
  it('builds valid OAuth redirect URL back to station origin', () => {
    expect(buildOAuthRedirectUrl('https://promptfm.live')).toBe('https://promptfm.live/');
    expect(buildOAuthRedirectUrl('https://promptfm.live/')).toBe('https://promptfm.live/');
    expect(buildOAuthRedirectUrl('http://localhost:3000')).toBe('http://localhost:3000/');
  });

  it('generates the exact Supabase callback URL required for external developer portals', () => {
    const callbackUrl = getSupabaseAuthCallbackUrl('oxfacfdpxbxilucooijy');
    expect(callbackUrl).toBe('https://oxfacfdpxbxilucooijy.supabase.co/auth/v1/callback');
  });

  it('validates supported OAuth providers for PromptFM', () => {
    expect(SUPPORTED_OAUTH_PROVIDERS).toEqual(['google', 'discord', 'twitter', 'github']);
    expect(SUPPORTED_OAUTH_PROVIDERS).toContain('google');
    expect(SUPPORTED_OAUTH_PROVIDERS).toContain('discord');
    expect(SUPPORTED_OAUTH_PROVIDERS).toContain('twitter');
    expect(SUPPORTED_OAUTH_PROVIDERS).toContain('github');
  });

  it('provides correct display label and metadata for each provider', () => {
    expect(getOAuthProviderDisplay('google')).toEqual({
      id: 'google',
      label: 'Continue with Google',
      shortName: 'Google',
    });
    expect(getOAuthProviderDisplay('discord')).toEqual({
      id: 'discord',
      label: 'Continue with Discord',
      shortName: 'Discord',
    });
    expect(getOAuthProviderDisplay('twitter')).toEqual({
      id: 'twitter',
      label: 'Continue with X',
      shortName: 'X',
    });
    expect(getOAuthProviderDisplay('github')).toEqual({
      id: 'github',
      label: 'Continue with GitHub',
      shortName: 'GitHub',
    });
  });
});
