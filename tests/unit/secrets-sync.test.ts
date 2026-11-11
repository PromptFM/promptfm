import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  NON_INFRA_APP_ENV_GCP_SECRET_NAME,
  formatVercelSecretPayload,
  buildVercelCliEnvArgs,
  getNonInfraAppEnvManifest,
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

  describe('getNonInfraAppEnvManifest', () => {
    it('tracks the shared non-infra app env contract used by OCI and secret sync', () => {
      const manifest = getNonInfraAppEnvManifest();

      expect(NON_INFRA_APP_ENV_GCP_SECRET_NAME).toBe('promptfm-web-app-env');
      expect(manifest.gcpBundleSecretName).toBe('promptfm-web-app-env');
      expect(manifest.buildKeys).toEqual(
        expect.arrayContaining([
          'NEXT_PUBLIC_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          'NEXT_PUBLIC_SITE_URL',
          'NEXT_PUBLIC_STREAM_URL',
          'NEXT_PUBLIC_R2_PUBLIC_URL',
        ])
      );
      expect(manifest.runtimeKeys).toEqual(
        expect.arrayContaining([
          'SUPABASE_SERVICE_ROLE_KEY',
          'ADMIN_API_KEY',
          'R2_ACCOUNT_ID',
          'R2_ACCESS_KEY_ID',
          'R2_SECRET_ACCESS_KEY',
          'RESEND_API_KEY',
          'GEMINI_API_KEY',
          'CRON_SECRET',
          'STREAM_CONTROLLER_SECRET',
        ])
      );
      expect(manifest.requiredRuntimeKeys).toEqual(
        expect.arrayContaining([
          'NEXT_PUBLIC_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          'SUPABASE_SERVICE_ROLE_KEY',
          'ADMIN_API_KEY',
        ])
      );
      expect(manifest.staticRuntimeEnv).toMatchObject({ VERCEL_ENV: 'production' });
      expect(manifest.directGcpSecretNames).toMatchObject({
        ADMIN_API_KEY: 'promptfm-admin-api-key',
        RESEND_API_KEY: 'promptfm-resend-api-key',
        SUPABASE_SERVICE_ROLE_KEY: 'promptfm-supabase-service-role-key',
      });
      expect(manifest.runtimeKeys.length).toBe(new Set(manifest.runtimeKeys).size);
      expect(manifest.buildKeys.length).toBe(new Set(manifest.buildKeys).size);
    });

    it('shares the bundle secret and direct secret lookup with the workflow helper script CLI', () => {
      const manifest = getNonInfraAppEnvManifest();
      const rootDir = path.resolve(__dirname, '../..');
      const scriptPath = path.join(rootDir, 'scripts/resolve-oci-web-env.cjs');
      const bundleName = execFileSync('node', [scriptPath, '--print-bundle-secret-name'], {
        cwd: rootDir,
        encoding: 'utf8',
      }).trim();
      const adminApiDirectSecret = execFileSync(
        'node',
        [scriptPath, '--print-direct-gcp-secret-name', 'ADMIN_API_KEY'],
        {
          cwd: rootDir,
          encoding: 'utf8',
        }
      ).trim();
      const unknownDirectSecret = execFileSync(
        'node',
        [scriptPath, '--print-direct-gcp-secret-name', 'NOT_IN_MANIFEST'],
        {
          cwd: rootDir,
          encoding: 'utf8',
        }
      ).trim();

      expect(bundleName).toBe(manifest.gcpBundleSecretName);
      expect(adminApiDirectSecret).toBe(manifest.directGcpSecretNames.ADMIN_API_KEY);
      expect(unknownDirectSecret).toBe('');
    });

    it('covers every non-test src env key used by the app-facing runtime contract', () => {
      const manifest = getNonInfraAppEnvManifest();
      const manifestKeys = new Set([
        ...manifest.buildKeys,
        ...manifest.runtimeKeys,
        ...Object.keys(manifest.staticRuntimeEnv),
      ]);
      const rootDir = path.resolve(__dirname, '../..');
      const allowedOutOfManifest = new Set([
        'DEV_FALLBACK_SIMULATION',
        'GCP_PROJECT_ID',
        'GCP_SA_KEY',
        'GOOGLE_CLOUD_PROJECT',
        'HOME',
        'HOSTINGER_API_BASE',
        'HOSTINGER_API_TOKEN',
        'HOSTINGER_TOKEN',
        'NODE_ENV',
        'PROMPTFM_STATUS_STREAM_URL',
        'SUPABASE_URL',
        'USERPROFILE',
        'VITEST',
      ]);
      const sourceRoots = [path.join(rootDir, 'src')];
      const patterns = [
        /process\.env\.([A-Z][A-Z0-9_]+)/g,
        /requireEnv\(["']([A-Z][A-Z0-9_]+)["']\)/g,
      ];
      const foundKeys = new Set<string>();

      const visit = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            visit(fullPath);
            continue;
          }
          if (!/\.(?:[cm]?js|tsx?)$/u.test(entry.name)) {
            continue;
          }
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const pattern of patterns) {
            for (const match of content.matchAll(pattern)) {
              foundKeys.add(match[1]!);
            }
          }
        }
      };

      for (const sourceRoot of sourceRoots) {
        visit(sourceRoot);
      }

      const missing = [...foundKeys]
        .filter((key) => !manifestKeys.has(key) && !allowedOutOfManifest.has(key))
        .sort();

      expect(missing).toEqual([]);
    });
  });

  describe('getSecretShareProcessInfo', () => {
    it('returns documented secret share URL and documentation guide link', () => {
      const info = getSecretShareProcessInfo();
      expect(info.documentationPath).toBe('docs/admin-guide.md');
      expect(info.secretShareUrl).toContain('secretshare');
      expect(info.instructions).toContain('Vercel');
      expect(info.instructions).toContain('Google Cloud Secret Manager');
    });
  });
});
