import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveGcpSecret,
  clearSecretCache,
  destroyPreviousSecretVersions,
} from '../../src/lib/infra/gcp-secrets';

describe('GCP Secret Manager Zero-Cost Resolver (src/lib/infra/gcp-secrets.ts)', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    clearSecretCache();
    process.env = { ...origEnv };
    delete process.env.TEST_DB_URL;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    process.env = { ...origEnv };
    clearSecretCache();
    vi.restoreAllMocks();
  });

  it('resolves from environment variable first without invoking gcloud', async () => {
    process.env.TEST_DB_URL = 'postgres://user:pass@host:5432/db';
    const mockExec = vi.fn();

    const secret = await resolveGcpSecret('promptfm-database-url', {
      fallbackEnvVar: 'TEST_DB_URL',
      execGcloud: mockExec,
    });

    expect(secret).toBe('postgres://user:pass@host:5432/db');
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('skips redacted [SENSITIVE] environment values and falls back to gcloud', async () => {
    process.env.TEST_DB_URL = '[SENSITIVE]';
    const mockExec = vi.fn().mockReturnValue('postgres://real:pass@host:5432/realdb\n');

    const secret = await resolveGcpSecret('promptfm-database-url', {
      fallbackEnvVar: 'TEST_DB_URL',
      execGcloud: mockExec,
    });

    expect(secret).toBe('postgres://real:pass@host:5432/realdb');
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('gcloud secrets versions access latest --secret=promptfm-database-url')
    );
  });

  it('caches resolved secrets in-memory to prevent repeated API calls ($0 rule)', async () => {
    const mockExec = vi.fn().mockReturnValue('postgres://cached:pass@host:5432/cacheddb');

    const first = await resolveGcpSecret('promptfm-database-url', {
      execGcloud: mockExec,
    });
    const second = await resolveGcpSecret('promptfm-database-url', {
      execGcloud: mockExec,
    });

    expect(first).toBe('postgres://cached:pass@host:5432/cacheddb');
    expect(second).toBe('postgres://cached:pass@host:5432/cacheddb');
    expect(mockExec).toHaveBeenCalledTimes(1); // Cached in memory!
  });

  it('expires cache after TTL and refetches', async () => {
    let callCount = 0;
    const mockExec = vi.fn().mockImplementation(() => {
      callCount++;
      return `secret-val-${callCount}`;
    });

    const first = await resolveGcpSecret('test-secret', {
      ttlMs: 50,
      execGcloud: mockExec,
    });
    expect(first).toBe('secret-val-1');

    // Wait 60ms for TTL to expire
    await new Promise((r) => setTimeout(r, 60));

    const second = await resolveGcpSecret('test-secret', {
      ttlMs: 50,
      execGcloud: mockExec,
    });
    expect(second).toBe('secret-val-2');
    expect(mockExec).toHaveBeenCalledTimes(2);
  });

  it('returns empty string if gcloud fails and required is false', async () => {
    const mockExec = vi.fn().mockImplementation(() => {
      throw new Error('Secret not found');
    });

    const secret = await resolveGcpSecret('non-existent-secret', {
      execGcloud: mockExec,
      required: false,
    });

    expect(secret).toBe('');
  });

  it('throws descriptive error if gcloud fails and required is true', async () => {
    const mockExec = vi.fn().mockImplementation(() => {
      throw new Error('Secret not found in project');
    });

    await expect(
      resolveGcpSecret('required-secret', {
        execGcloud: mockExec,
        required: true,
      })
    ).rejects.toThrow(/Failed to resolve required GCP secret/);
  });

  it('ignores cache when skipCache is true', async () => {
    let count = 0;
    const mockExec = vi.fn().mockImplementation(() => `val-${++count}`);

    const val1 = await resolveGcpSecret('my-sec', { execGcloud: mockExec });
    const val2 = await resolveGcpSecret('my-sec', { skipCache: true, execGcloud: mockExec });

    expect(val1).toBe('val-1');
    expect(val2).toBe('val-2');
    expect(mockExec).toHaveBeenCalledTimes(2);
  });

  it('bypasses empty fallbackEnvVar string to fetch from gcloud', async () => {
    process.env.EMPTY_ENV_VAR = '   ';
    const mockExec = vi.fn().mockReturnValue('from-gcloud');

    const result = await resolveGcpSecret('promptfm-database-url', {
      fallbackEnvVar: 'EMPTY_ENV_VAR',
      execGcloud: mockExec,
    });

    expect(result).toBe('from-gcloud');
    expect(mockExec).toHaveBeenCalled();
  });

  it('destroys previous secret versions to maintain <= 6 active versions ($0 destroy-on-rotate rule)', async () => {
    // Mock listing versions where version 3 is latest (enabled), version 2 is disabled, and version 1 is destroyed
    const listJson = JSON.stringify([
      { name: 'projects/123/secrets/test-secret/versions/3', state: 'ENABLED' },
      { name: 'projects/123/secrets/test-secret/versions/2', state: 'DISABLED' },
      { name: 'projects/123/secrets/test-secret/versions/1', state: 'DESTROYED' },
    ]);

    const mockExec = vi.fn().mockImplementation((cmd: string) => {
      if (cmd.includes('versions list')) return listJson;
      if (cmd.includes('versions destroy')) return 'Destroyed version [2]';
      return '';
    });

    const destroyed = await destroyPreviousSecretVersions('test-secret', {
      projectId: 'promptfm-radio-1793623670',
      keepVersions: 1,
      execGcloud: mockExec,
    });

    // Version 2 should be destroyed because it is active (DISABLED counts against quota), while 1 was already DESTROYED
    expect(destroyed).toEqual(['2']);
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('gcloud secrets versions destroy 2 --secret=test-secret')
    );
  });

  it('handles non-array JSON or command failure gracefully in destroyPreviousSecretVersions', async () => {
    const mockExec = vi.fn().mockReturnValue('{"error": "not found"}');
    const destroyed = await destroyPreviousSecretVersions('missing-secret', { execGcloud: mockExec });
    expect(destroyed).toEqual([]);

    const throwingExec = vi.fn().mockImplementation(() => {
      throw new Error('Command failed');
    });
    const destroyed2 = await destroyPreviousSecretVersions('error-secret', { execGcloud: throwingExec });
    expect(destroyed2).toEqual([]);
  });
});
