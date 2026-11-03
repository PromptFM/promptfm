// src/lib/auth/providers.ts
// Configuration, helpers, and display metadata for supported social OAuth providers

export const SUPPORTED_OAUTH_PROVIDERS = ['google', 'discord', 'twitter'] as const;

export type OAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

export interface OAuthProviderDisplay {
  id: OAuthProvider;
  label: string;
  shortName: string;
}

export function buildOAuthRedirectUrl(origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}/`;
}

export function getSupabaseAuthCallbackUrl(projectRef: string): string {
  return `https://${projectRef}.supabase.co/auth/v1/callback`;
}

export function getOAuthProviderDisplay(provider: OAuthProvider): OAuthProviderDisplay {
  switch (provider) {
    case 'google':
      return {
        id: 'google',
        label: 'Continue with Google',
        shortName: 'Google',
      };
    case 'discord':
      return {
        id: 'discord',
        label: 'Continue with Discord',
        shortName: 'Discord',
      };
    case 'twitter':
      return {
        id: 'twitter',
        label: 'Continue with X',
        shortName: 'X',
      };
  }
}
