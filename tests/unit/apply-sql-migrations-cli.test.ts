import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as gcpSecretsModule from '../../src/lib/infra/gcp-secrets';
import { runSQLMigrationCLI } from '../../scripts/apply-sql-migrations';

describe('SQL Migration CLI (scripts/apply-sql-migrations.ts)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs successfully in --dry-run mode without credentials', async () => {
    const exitCode = await runSQLMigrationCLI(['--dry-run']);
    expect(exitCode).toBe(0);
  });

  it('exits with 1 when no credentials are provided in live mode and GCP Secret Manager is empty', async () => {
    const prevUrl = process.env.DATABASE_URL;
    const prevSubUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevSubKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_DB_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    vi.spyOn(gcpSecretsModule, 'resolveGcpSecret').mockResolvedValue('');

    try {
      const exitCode = await runSQLMigrationCLI([]);
      expect(exitCode).toBe(1);
    } finally {
      if (prevUrl) process.env.DATABASE_URL = prevUrl;
      if (prevSubUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = prevSubUrl;
      if (prevSubKey) process.env.SUPABASE_SERVICE_ROLE_KEY = prevSubKey;
    }
  });

  it('resolves database URL from Google Cloud Secret Manager when environment variables are unset', async () => {
    const prevUrl = process.env.DATABASE_URL;
    const prevSubUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevSubKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_DB_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const resolveSpy = vi.spyOn(gcpSecretsModule, 'resolveGcpSecret').mockImplementation(async (name) => {
      if (name === 'promptfm-database-url') {
        return 'postgres://mock:mock@localhost:5432/test';
      }
      return '';
    });

    try {
      // In dry-run mode or with mocked client, verify resolveGcpSecret was called
      await runSQLMigrationCLI(['--dry-run']);
      // Now in live mode, verify resolveGcpSecret is invoked
      const exitCode = await runSQLMigrationCLI([]);
      expect(resolveSpy).toHaveBeenCalledWith('promptfm-database-url', expect.anything());
      // Will exit with 1 because connecting to mock localhost fails, but confirms it resolved and attempted connection
      expect(exitCode).toBe(1);
    } finally {
      if (prevUrl) process.env.DATABASE_URL = prevUrl;
      if (prevSubUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = prevSubUrl;
      if (prevSubKey) process.env.SUPABASE_SERVICE_ROLE_KEY = prevSubKey;
    }
  });
});

