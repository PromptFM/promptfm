import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as gcpSecretsModule from '../../src/lib/infra/gcp-secrets';
import { TRACK_MEDIA_MIGRATION_EXIT_CODES } from '../../src/lib/infra/track-media-migration';
import { parseTrackMediaMigrationArgs, runTrackMediaMigrationCLI } from '../../scripts/migrate-track-media';

function createSupabaseStub(rows: any[]) {
  return {
    from(table: string) {
      expect(table).toBe('tracks');
      return {
        select(columns: string) {
          expect(columns).toBe('id,title,artist_name,status,audio_url,cover_art_url');
          return {
            order(column: string, options: { ascending: boolean }) {
              expect(column).toBe('id');
              expect(options).toEqual({ ascending: true });
              return {
                async range(from: number, to: number) {
                  return {
                    data: rows.slice(from, to + 1),
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function createPostgresClientStub(rows: any[]) {
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    expect(sql).toContain('FROM public.tracks');

    const limit = Number(params?.[0] ?? rows.length);
    const offset = Number(params?.[1] ?? 0);
    const batch = rows.slice(offset, offset + limit);

    return {
      rows: batch,
      rowCount: batch.length,
    };
  });

  const end = vi.fn(async () => {});

  return {
    client: {
      query,
      end,
    },
    query,
    end,
  };
}

describe('migrate-track-media CLI', () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalR2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalPostgresUrlNonPooling = process.env.POSTGRES_URL_NON_POOLING;
  const originalSupabaseDbUrl = process.env.SUPABASE_DB_URL;
  const originalPostgresUrl = process.env.POSTGRES_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://cdn.promptfm.live';
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL_NON_POOLING;
    delete process.env.SUPABASE_DB_URL;
    delete process.env.POSTGRES_URL;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalServiceKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    }

    if (originalR2Base === undefined) {
      delete process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    } else {
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL = originalR2Base;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalPostgresUrlNonPooling === undefined) {
      delete process.env.POSTGRES_URL_NON_POOLING;
    } else {
      process.env.POSTGRES_URL_NON_POOLING = originalPostgresUrlNonPooling;
    }

    if (originalSupabaseDbUrl === undefined) {
      delete process.env.SUPABASE_DB_URL;
    } else {
      process.env.SUPABASE_DB_URL = originalSupabaseDbUrl;
    }

    if (originalPostgresUrl === undefined) {
      delete process.env.POSTGRES_URL;
    } else {
      process.env.POSTGRES_URL = originalPostgresUrl;
    }
  });

  it('parses inventory and migrate args with repo-safe defaults', () => {
    expect(parseTrackMediaMigrationArgs(['inventory', '--require-clean'])).toEqual({
      mode: 'inventory',
      dryRun: true,
      requireClean: true,
      batchSize: 100,
      previewLimit: 10,
    });

    expect(parseTrackMediaMigrationArgs(['migrate'])).toEqual({
      mode: 'migrate',
      dryRun: true,
      requireClean: false,
      batchSize: 100,
      previewLimit: 10,
    });

    expect(parseTrackMediaMigrationArgs(['migrate', '--apply'])).toEqual({
      mode: 'migrate',
      dryRun: false,
      requireClean: false,
      batchSize: 100,
      previewLimit: 10,
    });
  });

  it('returns exit code 2 for CI inventory when Supabase-backed media remains', async () => {
    const exitCode = await runTrackMediaMigrationCLI(['inventory', '--require-clean'], {
      getAdminClient: () =>
        createSupabaseStub([
          {
            id: 'track-1',
            title: 'Neon Drift',
            artist_name: 'PromptFM',
            status: 'approved',
            audio_url: 'https://project.supabase.co/storage/v1/object/public/tracks/live/neon-drift.mp3',
            cover_art_url: null,
          },
        ]) as any,
      resolveGcpSecretImpl: vi.fn().mockResolvedValue(''),
      stdout: console,
    });

    expect(exitCode).toBe(TRACK_MEDIA_MIGRATION_EXIT_CODES.pendingMediaFound);
  });

  it('returns exit code 0 for clean inventory when no Supabase-backed media remains', async () => {
    const exitCode = await runTrackMediaMigrationCLI(['inventory', '--require-clean'], {
      getAdminClient: () =>
        createSupabaseStub([
          {
            id: 'track-1',
            title: 'Already Migrated',
            artist_name: 'PromptFM',
            status: 'approved',
            audio_url: 'https://cdn.promptfm.live/tracks/legacy/live/neon-drift.mp3',
            cover_art_url: 'https://cdn.promptfm.live/tracks/legacy/covers/neon-drift.jpg',
          },
        ]) as any,
      resolveGcpSecretImpl: vi.fn().mockResolvedValue(''),
      stdout: console,
    });

    expect(exitCode).toBe(TRACK_MEDIA_MIGRATION_EXIT_CODES.success);
  });

  it('prefers direct Postgres inventory via POSTGRES_URL_NON_POOLING before Supabase REST', async () => {
    process.env.POSTGRES_URL_NON_POOLING = 'postgres://inventory-user:secret@db.example.com:5432/promptfm';

    const postgres = createPostgresClientStub([
      {
        id: 'track-1',
        title: 'Neon Drift',
        artist_name: 'PromptFM',
        status: 'approved',
        audio_url: 'https://project.supabase.co/storage/v1/object/public/tracks/live/neon-drift.mp3',
        cover_art_url: null,
      },
    ]);
    const createPgClient = vi.fn().mockResolvedValue(postgres.client);
    const getAdminClient = vi.fn(() => createSupabaseStub([]) as any);
    const resolveGcpSecretImpl = vi.fn().mockResolvedValue('');

    const exitCode = await runTrackMediaMigrationCLI(['inventory', '--require-clean'], {
      createPgClient,
      getAdminClient,
      resolveGcpSecretImpl,
      stdout: console,
    });

    expect(exitCode).toBe(TRACK_MEDIA_MIGRATION_EXIT_CODES.pendingMediaFound);
    expect(createPgClient).toHaveBeenCalledWith(process.env.POSTGRES_URL_NON_POOLING);
    expect(postgres.query).toHaveBeenCalledWith(expect.stringContaining('FROM public.tracks'), [100, 0]);
    expect(postgres.end).toHaveBeenCalledTimes(1);
    expect(getAdminClient).not.toHaveBeenCalled();
    expect(resolveGcpSecretImpl).not.toHaveBeenCalled();
  });

  it('resolves promptfm-database-url from GCP for inventory when DB env vars are absent', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const resolvedDatabaseUrl = 'postgres://inventory-user:secret@db.example.com:5432/promptfm';
    const resolveSpy = vi.spyOn(gcpSecretsModule, 'resolveGcpSecret').mockImplementation(async (name) => {
      if (name === 'promptfm-database-url') {
        return resolvedDatabaseUrl;
      }

      return '';
    });
    const postgres = createPostgresClientStub([]);
    const createPgClient = vi.fn().mockResolvedValue(postgres.client);
    const getAdminClient = vi.fn(() => createSupabaseStub([]) as any);

    const exitCode = await runTrackMediaMigrationCLI(['inventory'], {
      createPgClient,
      getAdminClient,
      resolveGcpSecretImpl: gcpSecretsModule.resolveGcpSecret,
      stdout: console,
    });

    expect(exitCode).toBe(TRACK_MEDIA_MIGRATION_EXIT_CODES.success);
    expect(resolveSpy).toHaveBeenCalledWith('promptfm-database-url', {
      fallbackEnvVar: 'DATABASE_URL',
    });
    expect(createPgClient).toHaveBeenCalledWith(resolvedDatabaseUrl);
    expect(postgres.end).toHaveBeenCalledTimes(1);
    expect(process.env.DATABASE_URL).toBe(resolvedDatabaseUrl);
    expect(getAdminClient).not.toHaveBeenCalled();
    expect(resolveSpy.mock.calls.map(([name]) => name)).not.toContain('promptfm-supabase-service-role-key');
  });

  it('resolves the Supabase service role key from GCP when it is absent locally', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resolveSpy = vi.spyOn(gcpSecretsModule, 'resolveGcpSecret').mockImplementation(async (name) => {
      if (name === 'promptfm-supabase-service-role-key') {
        return 'resolved-service-role';
      }

      return '';
    });

    const exitCode = await runTrackMediaMigrationCLI(['inventory'], {
      getAdminClient: () => createSupabaseStub([]) as any,
      resolveGcpSecretImpl: gcpSecretsModule.resolveGcpSecret,
      stdout: console,
    });

    expect(exitCode).toBe(TRACK_MEDIA_MIGRATION_EXIT_CODES.success);
    expect(resolveSpy).toHaveBeenCalledWith('promptfm-database-url', {
      fallbackEnvVar: 'DATABASE_URL',
    });
    expect(resolveSpy).toHaveBeenCalledWith('promptfm-supabase-service-role-key', {
      fallbackEnvVar: 'SUPABASE_SERVICE_ROLE_KEY',
    });
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe('resolved-service-role');
  });

  it('fails fast when both --dry-run and --apply are provided', async () => {
    const exitCode = await runTrackMediaMigrationCLI(['migrate', '--dry-run', '--apply'], {
      getAdminClient: () => createSupabaseStub([]) as any,
      stdout: console,
    });

    expect(exitCode).toBe(TRACK_MEDIA_MIGRATION_EXIT_CODES.failure);
  });
});
