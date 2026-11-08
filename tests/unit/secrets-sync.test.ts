import { describe, it, expect } from 'vitest';
import {
  formatVercelSecretPayload,
  buildVercelCliEnvArgs,
  getSecretShareProcessInfo,
} from '@/lib/infra/secrets-sync';

describe('Vercel Secrets Sync & SecretShare Process', () => {
  describe('formatVercelSecretPayload', () => {
    it('formats a valid secret payload for default environments and trims spaces', () => {
      const payload = formatVercelSecretPayload('  NEXT_PUBLIC_API_URL  ', '  https://api.promptfm.live  ');
      expect(payload.key).toBe('NEXT_PUBLIC_API_URL');
      expect(payload.value).toBe('https://api.promptfm.live');
      expect(payload.environments).toEqual(['production', 'preview', 'development']);
    });

    it('allows specific targeted environments and filters empty strings', () => {
      const payload = formatVercelSecretPayload('VERCEL_SECRET_KEY', 'secret_val_123', ['production', '']);
      expect(payload.environments).toEqual(['production']);
    });

    it('throws error when environments array is empty or contains only falsy values', () => {
      expect(() => formatVercelSecretPayload('VALID_KEY', 'value', [])).toThrow(
        'At least one target environment must be specified'
      );
      expect(() => formatVercelSecretPayload('VALID_KEY', 'value', ['', '   ' as any])).toThrow(
        'At least one target environment must be specified'
      );
    });

    it('throws error for invalid environment variable names', () => {
      expect(() => formatVercelSecretPayload('invalid-name-with-dashes', 'val')).toThrow(
        'Invalid environment variable key'
      );
      expect(() => formatVercelSecretPayload('123_STARTS_WITH_NUM', 'val')).toThrow(
        'Invalid environment variable key'
      );
      expect(() => formatVercelSecretPayload('', 'val')).toThrow(
        'Invalid environment variable key'
      );
    });

    it('throws error for empty secret value', () => {
      expect(() => formatVercelSecretPayload('VALID_KEY', '')).toThrow('Secret value cannot be empty');
    });
  });

  describe('buildVercelCliEnvArgs', () => {
    it('constructs argument list for vercel env add command', () => {
      const args = buildVercelCliEnvArgs('SUPABASE_SERVICE_ROLE_KEY', 'production');
      expect(args).toEqual(['env', 'add', 'SUPABASE_SERVICE_ROLE_KEY', 'production']);
    });
  });

  describe('getSecretShareProcessInfo', () => {
    it('returns documented secret share URL and documentation guide link', () => {
      const info = getSecretShareProcessInfo();
      expect(info.documentationPath).toBe('docs/admin-guide.md');
      expect(info.secretShareUrl).toContain('secretshare');
      expect(info.instructions).toContain('Vercel');
    });
  });
});
