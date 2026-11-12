#!/usr/bin/env node
// scripts/migrate-track-media.ts
// Inventory and migrate public track media from Supabase Storage to R2.

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import {
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { loadLocalEnvFiles } from '../src/lib/infra/prepare-infra';
import { resolveGcpSecret } from '../src/lib/infra/gcp-secrets';
import { NON_INFRA_APP_ENV_GCP_SECRET_NAME } from '../src/lib/infra/secrets-sync';
import { createAdminClient } from '../src/lib/supabase/server';
import { getBucketName, getPublicUrl, getR2Client } from '../src/lib/r2';
import {
  buildTrackMediaMigrationPlan,
  createTrackMediaMigrationExecutionSummary,
  createTrackMediaMigrationReport,
  formatTrackMediaMigrationReport,
  getTrackMediaMigrationExitCode,
  guessContentTypeFromPath,
  TRACK_MEDIA_MIGRATION_EXIT_CODES,
  type TrackMediaInventoryRow,
  type TrackMediaMigrationExecutionSummary,
  type TrackMediaMigrationMode,
  type TrackMediaMigrationObject,
  type TrackMediaMigrationPlan,
  type TrackMediaMigrationReference,
} from '../src/lib/infra/track-media-migration';

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_PREVIEW_LIMIT = 10;
const TRACK_MEDIA_PG_CONNECTION_TIMEOUT_MS = 15_000;
const TRACK_MEDIA_PG_STATEMENT_TIMEOUT_MS = 30_000;
const TRACK_MEDIA_PG_QUERY_TIMEOUT_MS = 35_000;
const TRACK_MEDIA_PG_LOCK_TIMEOUT_MS = 5_000;
const TRACK_MEDIA_PG_APPLICATION_NAME = 'promptfm-track-media-migration';

export interface RunTrackMediaMigrationDeps {
  fetchImpl?: typeof fetch;
  getAdminClient?: typeof createAdminClient;
  getR2ClientImpl?: typeof getR2Client;
  getBucketNameImpl?: typeof getBucketName;
  getPublicUrlImpl?: typeof getPublicUrl;
  resolveGcpSecretImpl?: typeof resolveGcpSecret;
  createPgClient?: (connectionString: string) => Promise<TrackMediaPostgresClient>;
  stdout?: Pick<typeof console, 'log' | 'error' | 'warn'>;
}

export interface RunTrackMediaMigrationOptions {
  mode: TrackMediaMigrationMode;
  dryRun: boolean;
  requireClean: boolean;
  batchSize?: number;
  previewLimit?: number;
}

export interface TrackMediaPostgresClient {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{
    rows: unknown[];
    rowCount?: number | null;
  }>;
  end: () => Promise<void>;
}

const TRACK_MEDIA_DATABASE_URL_ENV_KEYS = [
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'SUPABASE_DB_URL',
  'POSTGRES_URL',
] as const;

type TrackMediaDatabaseUrlEnvKey = (typeof TRACK_MEDIA_DATABASE_URL_ENV_KEYS)[number];

interface TrackMediaDatabaseUrlSelection {
  key: TrackMediaDatabaseUrlEnvKey | 'promptfm-database-url';
  value: string;
}

const TRACK_MEDIA_BUNDLED_APP_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_R2_PUBLIC_URL',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
] as const;

type TrackMediaBundledAppEnvKey = (typeof TRACK_MEDIA_BUNDLED_APP_ENV_KEYS)[number];

function parseTrackMediaBundledAppEnv(raw: string): Partial<Record<TrackMediaBundledAppEnvKey, string>> {
  if (!raw || !raw.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse ${NON_INFRA_APP_ENV_GCP_SECRET_NAME} bundled app env JSON: ${formatTrackMediaMigrationError(error)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `${NON_INFRA_APP_ENV_GCP_SECRET_NAME} bundled app env JSON must be an object.`,
    );
  }

  const parsedRecord = parsed as Record<string, unknown>;

  const hydrated: Partial<Record<TrackMediaBundledAppEnvKey, string>> = {};
  for (const key of TRACK_MEDIA_BUNDLED_APP_ENV_KEYS) {
    const value = parsedRecord[key];
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed === '[SENSITIVE]' || trimmed.startsWith('[SENSITIVE')) {
      continue;
    }

    hydrated[key] = trimmed;
  }

  return hydrated;
}

async function ensureBundledAppEnv(
  deps: Required<Pick<RunTrackMediaMigrationDeps, 'resolveGcpSecretImpl'>>,
): Promise<void> {
  const missingKeys = TRACK_MEDIA_BUNDLED_APP_ENV_KEYS.filter((key) => !process.env[key]?.trim());
  if (missingKeys.length === 0) {
    return;
  }

  const bundledAppEnvRaw = await deps.resolveGcpSecretImpl(NON_INFRA_APP_ENV_GCP_SECRET_NAME, {
    fallbackEnvVar: 'GCP_BUNDLED_APP_ENV_JSON',
  });
  if (!bundledAppEnvRaw) {
    return;
  }

  const bundledAppEnv = parseTrackMediaBundledAppEnv(bundledAppEnvRaw);
  for (const key of missingKeys) {
    const value = bundledAppEnv[key];
    if (value) {
      process.env[key] = value;
    }
  }
}

function getTrackMediaDatabaseUrlFromEnv(): TrackMediaDatabaseUrlSelection | null {
  for (const key of TRACK_MEDIA_DATABASE_URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return { key, value };
    }
  }

  return null;
}

function getSupabasePoolerHost(databaseUrl: string): string | null {
  try {
    const parsed = new URL(databaseUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'pooler.supabase.com' || hostname.endsWith('.pooler.supabase.com')) {
      return parsed.host;
    }
  } catch {
    const match = databaseUrl.match(/\/\/([^/?#]*pooler\.supabase\.com(?::\d+)?)(?:[/?#]|$)/i);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function validateTrackMediaDatabaseUrlSelection(selection: TrackMediaDatabaseUrlSelection): void {
  const poolerHost = getSupabasePoolerHost(selection.value);
  if (!poolerHost) {
    return;
  }

  const source =
    selection.key === 'promptfm-database-url'
      ? 'resolved promptfm-database-url secret'
      : `${selection.key}`;

  throw new Error(
    `Selected database URL from ${source} points at Supabase pooler host ${poolerHost}. Track media migration requires a true non-pooling Postgres URL (usually the direct port 5432 connection). Set POSTGRES_URL_NON_POOLING to the direct database URL, not a *.pooler.supabase.com address.`,
  );
}

function canFallbackFromDatabaseSelection(selection: TrackMediaDatabaseUrlSelection): boolean {
  return selection.key === 'promptfm-database-url' || selection.key === 'DATABASE_URL' || selection.key === 'POSTGRES_URL';
}

function hasSupabaseAdminFallbackEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function buildTrackMediaPgClientOptions(connectionString: string): {
  connectionString: string;
  ssl: false | { rejectUnauthorized: false };
  connectionTimeoutMillis: number;
  statement_timeout: number;
  query_timeout: number;
  lock_timeout: number;
  application_name: string;
} {
  const sharedOptions = {
    connectionString,
    connectionTimeoutMillis: TRACK_MEDIA_PG_CONNECTION_TIMEOUT_MS,
    statement_timeout: TRACK_MEDIA_PG_STATEMENT_TIMEOUT_MS,
    query_timeout: TRACK_MEDIA_PG_QUERY_TIMEOUT_MS,
    lock_timeout: TRACK_MEDIA_PG_LOCK_TIMEOUT_MS,
    application_name: TRACK_MEDIA_PG_APPLICATION_NAME,
  };

  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
    const ssl = parsed.searchParams.get('ssl')?.toLowerCase();

    if (sslMode === 'disable' || ssl === '0' || ssl === 'false') {
      return {
        ...sharedOptions,
        ssl: false,
      };
    }

    if (sslMode === 'no-verify') {
      return {
        ...sharedOptions,
        ssl: { rejectUnauthorized: false },
      };
    }

    if (sslMode === 'require' || sslMode === 'prefer' || sslMode === 'verify-ca' || ssl === 'true') {
      parsed.searchParams.delete('ssl');
      parsed.searchParams.set('sslmode', 'no-verify');

      return {
        ...sharedOptions,
        connectionString: parsed.toString(),
        ssl: { rejectUnauthorized: false },
      };
    }
  } catch {
    // Ignore invalid or mock connection strings and fall back to the repo's default SSL override.
  }

  return {
    ...sharedOptions,
    ssl: { rejectUnauthorized: false },
  };
}

async function defaultCreatePgClient(connectionString: string): Promise<TrackMediaPostgresClient> {
  const { Client } = await import('pg');
  const client = new Client(buildTrackMediaPgClientOptions(connectionString));
  await client.connect();
  return client;
}

function formatTrackMediaMigrationError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function connectTrackMediaPostgres(
  databaseUrl: string,
  context: string,
  deps: Required<Pick<RunTrackMediaMigrationDeps, 'createPgClient' | 'stdout'>>,
): Promise<TrackMediaPostgresClient> {
  const pgOptions = buildTrackMediaPgClientOptions(databaseUrl);
  deps.stdout.log(
    `[track-media-migration] connecting to Postgres for ${context} (connect timeout=${pgOptions.connectionTimeoutMillis}ms, query timeout=${pgOptions.query_timeout}ms, statement timeout=${pgOptions.statement_timeout}ms, lock timeout=${pgOptions.lock_timeout}ms)`,
  );

  const client = await deps.createPgClient(databaseUrl);
  deps.stdout.log(`[track-media-migration] connected to Postgres for ${context}`);
  return client;
}

async function closeTrackMediaPostgres(
  client: TrackMediaPostgresClient,
  context: string,
  deps: Required<Pick<RunTrackMediaMigrationDeps, 'stdout'>>,
): Promise<void> {
  try {
    await client.end();
  } catch (error) {
    deps.stdout.warn(
      `[track-media-migration] failed to close Postgres connection for ${context}: ${formatTrackMediaMigrationError(error)}`,
    );
  }
}

function parseArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1] && !args[index + 1]!.startsWith('--')) {
    return args[index + 1];
  }

  const prefix = `${flag}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  return undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received "${value}".`);
  }

  return parsed;
}

function parseOptionalPositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received "${value}".`);
  }

  return parsed;
}

export function parseTrackMediaMigrationArgs(args: string[]): RunTrackMediaMigrationOptions {
  const modeArg = args[0];
  const mode: TrackMediaMigrationMode = modeArg === 'migrate' ? 'migrate' : 'inventory';

  if (modeArg && modeArg !== 'inventory' && modeArg !== 'migrate') {
    throw new Error(`Unknown subcommand "${modeArg}". Expected "inventory" or "migrate".`);
  }

  const explicitDryRun = hasFlag(args, '--dry-run');
  const apply = hasFlag(args, '--apply');
  const requireClean = hasFlag(args, '--require-clean');
  const dryRun = mode === 'inventory' ? true : apply ? false : true;

  if (explicitDryRun && apply) {
    throw new Error('Choose either --dry-run or --apply, not both.');
  }

  if (mode === 'inventory' && apply) {
    throw new Error('--apply is only valid with the migrate subcommand.');
  }

  return {
    mode,
    dryRun,
    requireClean,
    batchSize: parsePositiveInt(parseArgValue(args, '--batch-size'), DEFAULT_BATCH_SIZE),
    previewLimit: parsePositiveInt(parseArgValue(args, '--preview-limit'), DEFAULT_PREVIEW_LIMIT),
  };
}

function printUsage(logger: Pick<typeof console, 'log'> = console): void {
  logger.log(`
🎵 PromptFM Track Media Migration CLI
------------------------------------------------
Inventory:
  jiti scripts/migrate-track-media.ts inventory [--require-clean] [--limit 200] [--preview-limit 20]

Migration:
  jiti scripts/migrate-track-media.ts migrate --dry-run [--limit 200] [--preview-limit 20]
  jiti scripts/migrate-track-media.ts migrate --apply [--limit 200] [--batch-size 100] [--preview-limit 20]

Exit codes:
  0 success
  1 failure
  2 inventory found Supabase-backed media while --require-clean was set
`);
}

async function ensureMigrationSecrets(
  deps: Required<Pick<RunTrackMediaMigrationDeps, 'resolveGcpSecretImpl'>>,
): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceKey = await deps.resolveGcpSecretImpl('promptfm-supabase-service-role-key', {
      fallbackEnvVar: 'SUPABASE_SERVICE_ROLE_KEY',
    });
    if (serviceKey) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    }
  }
}

async function ensureMigrationDatabaseUrl(
  deps: Required<Pick<RunTrackMediaMigrationDeps, 'resolveGcpSecretImpl'>>,
): Promise<TrackMediaDatabaseUrlSelection | null> {
  const existing = getTrackMediaDatabaseUrlFromEnv();
  if (existing) {
    return existing;
  }

  const dbUrl = await deps.resolveGcpSecretImpl('promptfm-database-url', {
    fallbackEnvVar: 'DATABASE_URL',
  });

  if (dbUrl) {
    process.env.DATABASE_URL = dbUrl;
    return {
      key: 'promptfm-database-url',
      value: dbUrl,
    };
  }

  return null;
}

async function fetchTrackRows(
  options: { batchSize: number },
  deps: Required<Pick<RunTrackMediaMigrationDeps, 'getAdminClient' | 'createPgClient' | 'stdout'>>,
  databaseUrl?: string | null,
): Promise<TrackMediaInventoryRow[]> {
  if (databaseUrl) {
    const client = await connectTrackMediaPostgres(databaseUrl, 'track inventory', deps);
    try {
      const rows: TrackMediaInventoryRow[] = [];
      let from = 0;
      let batchNumber = 1;

      while (true) {
        deps.stdout.log(
          `[track-media-migration] querying Postgres track batch ${batchNumber} (offset=${from}, limit=${options.batchSize})`,
        );

        let result: { rows: TrackMediaInventoryRow[]; rowCount?: number | null };

        try {
          result = (await client.query(
            `
              SELECT
                id::text AS id,
                title,
                artist_name,
                status,
                audio_url,
                cover_art_url
              FROM public.tracks
              ORDER BY id ASC
              LIMIT $1 OFFSET $2
            `,
            [options.batchSize, from],
          )) as { rows: TrackMediaInventoryRow[]; rowCount?: number | null };
        } catch (error) {
          throw new Error(
            `Failed to query Postgres track batch ${batchNumber} (offset ${from}, limit ${options.batchSize}): ${formatTrackMediaMigrationError(error)}`,
          );
        }

        const batch = result.rows ?? [];
        rows.push(...batch);
        deps.stdout.log(
          `[track-media-migration] fetched Postgres track batch ${batchNumber} (${batch.length} row(s), ${rows.length} total)`,
        );

        if (batch.length < options.batchSize) {
          deps.stdout.log(
            `[track-media-migration] completed Postgres track inventory fetch (${rows.length} row(s) total)`,
          );
          break;
        }

        from += batch.length;
        batchNumber += 1;
      }

      return rows;
    } finally {
      await closeTrackMediaPostgres(client, 'track inventory', deps);
    }
  }

  const supabase = deps.getAdminClient();
  const rows: TrackMediaInventoryRow[] = [];
  const selectColumns = 'id,title,artist_name,status,audio_url,cover_art_url';

  let from = 0;
  while (true) {
    const to = from + options.batchSize - 1;
    const { data, error } = await supabase
      .from('tracks')
      .select(selectColumns)
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to read tracks from Supabase: ${error.message}`);
    }

    const batch = (data ?? []) as TrackMediaInventoryRow[];
    rows.push(...batch);

    if (batch.length < options.batchSize) {
      break;
    }

    from += batch.length;
  }

  return rows;
}

async function inspectR2Object(
  client: S3Client,
  bucket: string,
  object: TrackMediaMigrationObject,
): Promise<'missing' | 'exists'> {
  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: object.targetKey,
      }),
    );

    const sourceMetadata = response.Metadata?.source_url;
    if (sourceMetadata && sourceMetadata !== object.sourceUrl) {
      throw new Error(
        `R2 key ${object.targetKey} already exists with source_url=${sourceMetadata}, expected ${object.sourceUrl}`,
      );
    }

    return 'exists';
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (statusCode === 404) {
      return 'missing';
    }

    const errorName = (error as { name?: string }).name;
    if (errorName === 'NotFound' || errorName === 'NoSuchKey') {
      return 'missing';
    }

    throw error;
  }
}

async function copyObjectToR2(
  object: TrackMediaMigrationObject,
  deps: Required<Pick<RunTrackMediaMigrationDeps, 'fetchImpl' | 'getR2ClientImpl' | 'getBucketNameImpl'>>,
): Promise<'copied' | 'exists'> {
  const r2Client = deps.getR2ClientImpl();
  const bucket = deps.getBucketNameImpl();

  if ((await inspectR2Object(r2Client, bucket, object)) === 'exists') {
    return 'exists';
  }

  const response = await deps.fetchImpl(object.sourceUrl, {
    method: 'GET',
    headers: {
      'user-agent': 'promptfm-track-media-migration/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${object.sourceUrl}: HTTP ${response.status}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  const detectedContentType = response.headers.get('content-type')?.split(';')[0]?.trim();
  const contentType = detectedContentType || guessContentTypeFromPath(object.sourceObjectPath);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: object.targetKey,
      Body: body,
      ContentType: contentType,
      Metadata: {
        source_url: object.sourceUrl,
        source_bucket: object.sourceBucket,
        source_object_path: object.sourceObjectPath,
      },
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return 'copied';
}

async function rewriteTrackReference(
  reference: TrackMediaMigrationReference,
  deps: Required<Pick<RunTrackMediaMigrationDeps, 'getAdminClient' | 'getPublicUrlImpl'>>,
  databaseClient?: TrackMediaPostgresClient,
): Promise<'updated' | 'conflict'> {
  const nextUrl = deps.getPublicUrlImpl(reference.targetKey);

  if (databaseClient) {
    const column = reference.field === 'audio_url' ? 'audio_url' : 'cover_art_url';
    const result = await databaseClient.query(
      `
        UPDATE public.tracks
        SET ${column} = $1
        WHERE id::text = $2
          AND ${column} = $3
        RETURNING id::text AS id
      `,
      [nextUrl, reference.trackId, reference.sourceUrl],
    );

    return (result.rowCount ?? result.rows.length) > 0 ? 'updated' : 'conflict';
  }

  const supabase = deps.getAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from('tracks')
    .select(reference.field)
    .eq('id', reference.trackId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch current ${reference.field} for track ${reference.trackId}: ${fetchError.message}`);
  }

  const currentValue = existing?.[reference.field as keyof typeof existing];
  if (currentValue !== reference.sourceUrl) {
    return 'conflict';
  }

  const { error: updateError } = await supabase
    .from('tracks')
    .update({ [reference.field]: nextUrl })
    .eq('id', reference.trackId)
    .eq(reference.field, reference.sourceUrl);

  if (updateError) {
    throw new Error(`Failed to update ${reference.field} for track ${reference.trackId}: ${updateError.message}`);
  }

  return 'updated';
}

async function executeTrackMediaMigrationPlan(
  plan: TrackMediaMigrationPlan,
  options: RunTrackMediaMigrationOptions,
  deps: Required<RunTrackMediaMigrationDeps>,
  databaseUrl?: string | null,
): Promise<TrackMediaMigrationExecutionSummary> {
  const execution = createTrackMediaMigrationExecutionSummary(plan);
  const migratedKeys = new Set<string>();

  if (options.dryRun || options.mode !== 'migrate') {
    return execution;
  }

  const databaseClient = databaseUrl
    ? await connectTrackMediaPostgres(databaseUrl, 'track media reference rewrites', deps)
    : undefined;

  try {
    for (const object of plan.objects) {
      try {
        const result = await copyObjectToR2(object, deps);
        if (result === 'exists') {
          execution.objectsAlreadyPresent += 1;
        } else {
          execution.objectsCopied += 1;
        }
        migratedKeys.add(object.targetKey);
      } catch (error) {
        execution.objectCopyFailures += 1;
        deps.stdout.error(
          `[track-media-migration] object copy failed for ${object.sourceUrl}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    for (const reference of plan.references) {
      if (!migratedKeys.has(reference.targetKey)) {
        execution.referenceFailures += 1;
        continue;
      }

      try {
        const result = await rewriteTrackReference(reference, deps, databaseClient);
        if (result === 'conflict') {
          execution.referencesSkippedConflict += 1;
        } else {
          execution.referencesUpdated += 1;
        }
      } catch (error) {
        execution.referenceFailures += 1;
        deps.stdout.error(
          `[track-media-migration] reference rewrite failed for ${reference.trackId}.${reference.field}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return execution;
  } finally {
    if (databaseClient) {
      await closeTrackMediaPostgres(databaseClient, 'track media reference rewrites', deps);
    }
  }
}

export async function runTrackMediaMigrationCLI(
  argv: string[] = process.argv.slice(2),
  deps: RunTrackMediaMigrationDeps = {},
): Promise<number> {
  loadLocalEnvFiles();

  const resolvedDeps: Required<RunTrackMediaMigrationDeps> = {
    fetchImpl: deps.fetchImpl ?? fetch,
    getAdminClient: deps.getAdminClient ?? createAdminClient,
    getR2ClientImpl: deps.getR2ClientImpl ?? getR2Client,
    getBucketNameImpl: deps.getBucketNameImpl ?? getBucketName,
    getPublicUrlImpl: deps.getPublicUrlImpl ?? getPublicUrl,
    resolveGcpSecretImpl: deps.resolveGcpSecretImpl ?? resolveGcpSecret,
    createPgClient: deps.createPgClient ?? defaultCreatePgClient,
    stdout: deps.stdout ?? console,
  };

  try {
    if (argv.includes('--help') || argv.includes('-h')) {
      printUsage(resolvedDeps.stdout);
      return TRACK_MEDIA_MIGRATION_EXIT_CODES.success;
    }

    const options = parseTrackMediaMigrationArgs(argv);
    const rowLimit = parseOptionalPositiveInt(parseArgValue(argv, '--limit'));
    let databaseUrlSelection = await ensureMigrationDatabaseUrl(resolvedDeps);
    let databaseUrl = databaseUrlSelection?.value ?? null;

    if (databaseUrlSelection) {
      if (
        getSupabasePoolerHost(databaseUrlSelection.value) &&
        canFallbackFromDatabaseSelection(databaseUrlSelection) &&
        !hasSupabaseAdminFallbackEnv()
      ) {
        await ensureBundledAppEnv(resolvedDeps);
        await ensureMigrationSecrets(resolvedDeps);
      }

      try {
        validateTrackMediaDatabaseUrlSelection(databaseUrlSelection);
      } catch (error) {
        if (!canFallbackFromDatabaseSelection(databaseUrlSelection) || !hasSupabaseAdminFallbackEnv()) {
          throw error;
        }

        resolvedDeps.stdout.warn(
          `[track-media-migration] ${formatTrackMediaMigrationError(error)} Falling back to Supabase admin API because ${databaseUrlSelection.key === 'promptfm-database-url' ? 'the resolved promptfm-database-url secret is still pooler-backed' : `${databaseUrlSelection.key} is pooler-backed`} and Supabase admin credentials are available.`,
        );
        if (databaseUrlSelection.key === 'promptfm-database-url' || databaseUrlSelection.key === 'DATABASE_URL') {
          delete process.env.DATABASE_URL;
        }
        if (databaseUrlSelection.key === 'POSTGRES_URL') {
          delete process.env.POSTGRES_URL;
        }
        databaseUrlSelection = null;
        databaseUrl = null;
      }
    }

    if (!databaseUrl) {
      await ensureBundledAppEnv(resolvedDeps);
      await ensureMigrationSecrets(resolvedDeps);
    }

    if (options.mode === 'migrate' && !options.dryRun) {
      await ensureBundledAppEnv(resolvedDeps);
    }

    if (!databaseUrl && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is required when DATABASE_URL is unavailable.');
    }
    if (!databaseUrl && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when DATABASE_URL is unavailable.');
    }

    if (options.mode === 'migrate' && !options.dryRun) {
      // Validate R2 config before any live migration.
      resolvedDeps.getBucketNameImpl();
      resolvedDeps.getPublicUrlImpl('tracks/legacy/healthcheck');
      resolvedDeps.getR2ClientImpl();
    }

    const rows = await fetchTrackRows(
      {
        batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
      },
      resolvedDeps,
      databaseUrl,
    );

    const inventoryRows = rowLimit ? rows.slice(0, rowLimit) : rows;
    const fullPlan = buildTrackMediaMigrationPlan(inventoryRows, {
      r2PublicBaseUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_URL || null,
    });
    const execution = await executeTrackMediaMigrationPlan(fullPlan, options, resolvedDeps, databaseUrl);
    const report = createTrackMediaMigrationReport(fullPlan, {
      mode: options.mode,
      dryRun: options.dryRun,
      execution,
      previewLimit: options.previewLimit,
      r2PublicBaseConfigured: Boolean(process.env.NEXT_PUBLIC_R2_PUBLIC_URL),
    });

    resolvedDeps.stdout.log(formatTrackMediaMigrationReport(report));
    resolvedDeps.stdout.log(`\nJSON report:\n${JSON.stringify(report, null, 2)}`);

    return getTrackMediaMigrationExitCode(report, {
      requireClean: options.requireClean,
    });
  } catch (error) {
    resolvedDeps.stdout.error(
      `[track-media-migration] ${formatTrackMediaMigrationError(error)}`,
    );
    return TRACK_MEDIA_MIGRATION_EXIT_CODES.failure;
  }
}

if (!process.env.VITEST) {
  runTrackMediaMigrationCLI().then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  });
}
