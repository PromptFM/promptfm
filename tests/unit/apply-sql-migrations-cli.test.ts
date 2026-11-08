import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  it('exits with 1 when no credentials are provided in live mode', async () => {
    const prevUrl = process.env.DATABASE_URL;
    const prevSubUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevSubKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_DB_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const exitCode = await runSQLMigrationCLI([]);
      expect(exitCode).toBe(1);
    } finally {
      if (prevUrl) process.env.DATABASE_URL = prevUrl;
      if (prevSubUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = prevSubUrl;
      if (prevSubKey) process.env.SUPABASE_SERVICE_ROLE_KEY = prevSubKey;
    }
  });
});
