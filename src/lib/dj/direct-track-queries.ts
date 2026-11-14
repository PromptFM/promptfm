// src/lib/dj/direct-track-queries.ts
// Direct PostgreSQL query module for track rotation, providing zero-downtime
// failover when the Supabase REST/HTTP gateway is blocked or restricted.

import type { Client as PgClientType } from 'pg';

export interface DirectDbTrackRow {
  id: string;
  title: string;
  artist_name: string;
  audio_url: string;
  tool_used: string;
  upvotes_count: number;
  cover_art_url?: string | null;
  category?: string | null;
  description?: string | null;
  lyrics?: string | null;
  is_explicit?: boolean | null;
  family_friendly?: boolean | null;
  duration_hint_seconds?: number | null;
}

export interface MinimalPgClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  end: () => Promise<void>;
}

const SUPABASE_POOLER_HOST_REGEX = /^(?:[a-z0-9-]+\.)*pooler\.supabase\.com$/i;

export function isSupabasePoolerHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') {
    return false;
  }
  return SUPABASE_POOLER_HOST_REGEX.test(hostname.trim());
}

export function formatPostgresSessionUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return rawUrl;
  }

  try {
    const urlToParse = rawUrl.includes('://') ? rawUrl : `postgres://${rawUrl}`;
    const parsed = new URL(urlToParse);

    if (isSupabasePoolerHost(parsed.hostname) && parsed.port === '6543') {
      parsed.port = '5432';
      if (!rawUrl.includes('://')) {
        return parsed.toString().replace(/^postgres:\/\//, '');
      }
      return parsed.toString();
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

export function getDirectPostgresDatabaseUrl(
  env: Record<string, string | undefined> = process.env
): string | null {
  const candidate =
    env.DATABASE_URL ||
    env.POSTGRES_URL_NON_POOLING ||
    env.POSTGRES_URL ||
    env.SUPABASE_DB_URL;

  if (!candidate || !candidate.trim()) {
    return null;
  }

  return formatPostgresSessionUrl(candidate.trim());
}

async function createDefaultPgClient(connectionString: string): Promise<MinimalPgClient> {
  const { Client } = await import('pg');
  const parsed = new URL(connectionString);
  parsed.searchParams.delete('ssl');
  parsed.searchParams.set('sslmode', 'no-verify');

  const client = new Client({
    connectionString: parsed.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    query_timeout: 10000,
  });

  await client.connect();
  return client;
}

export async function fetchApprovedTracksDirect(options: {
  limit?: number;
  databaseUrl?: string;
  client?: MinimalPgClient;
} = {}): Promise<DirectDbTrackRow[]> {
  const dbUrl = options.databaseUrl || getDirectPostgresDatabaseUrl();
  let client = options.client;
  let ownClient = false;

  if (!client) {
    if (!dbUrl || (process.env.VITEST && !options.databaseUrl)) {
      return [];
    }
    client = await createDefaultPgClient(dbUrl);
    ownClient = true;
  }

  try {
    const limit = options.limit ?? 200;
    const res = await client.query(
      `
        SELECT
          id::text as id,
          title,
          artist_name,
          audio_url,
          tool_used,
          COALESCE(upvotes_count, 0) as upvotes_count,
          cover_art_url,
          category,
          description,
          lyrics,
          COALESCE(is_explicit, false) as is_explicit,
          COALESCE(family_friendly, true) as family_friendly
        FROM public.tracks
        WHERE status = 'approved'
        ORDER BY upvotes_count DESC
        LIMIT $1
      `,
      [limit]
    );

    return res.rows as DirectDbTrackRow[];
  } finally {
    if (ownClient && client) {
      try {
        await client.end();
      } catch {
        // Non-blocking cleanup
      }
    }
  }
}

export async function fetchTrackByIdOrTitleDirect(query: {
  id?: string | null;
  title?: string | null;
  databaseUrl?: string;
  client?: MinimalPgClient;
}): Promise<DirectDbTrackRow | null> {
  const dbUrl = query.databaseUrl || getDirectPostgresDatabaseUrl();
  let client = query.client;
  let ownClient = false;

  if (!client) {
    if (!dbUrl || (process.env.VITEST && !query.databaseUrl)) {
      return null;
    }
    client = await createDefaultPgClient(dbUrl);
    ownClient = true;
  }

  try {
    if (query.id) {
      const res = await client.query(
        `
          SELECT
            id::text as id,
            title,
            artist_name,
            audio_url,
            tool_used,
            COALESCE(upvotes_count, 0) as upvotes_count,
            cover_art_url,
            category,
            description,
            lyrics,
            COALESCE(is_explicit, false) as is_explicit,
            COALESCE(family_friendly, true) as family_friendly
          FROM public.tracks
          WHERE id::text = $1
          LIMIT 1
        `,
        [query.id]
      );
      return (res.rows[0] as DirectDbTrackRow) || null;
    }

    if (query.title) {
      const res = await client.query(
        `
          SELECT
            id::text as id,
            title,
            artist_name,
            audio_url,
            tool_used,
            COALESCE(upvotes_count, 0) as upvotes_count,
            cover_art_url,
            category,
            description,
            lyrics,
            COALESCE(is_explicit, false) as is_explicit,
            COALESCE(family_friendly, true) as family_friendly
          FROM public.tracks
          WHERE LOWER(title) = LOWER($1)
          LIMIT 1
        `,
        [query.title.trim()]
      );
      return (res.rows[0] as DirectDbTrackRow) || null;
    }

    return null;
  } finally {
    if (ownClient && client) {
      try {
        await client.end();
      } catch {
        // Non-blocking cleanup
      }
    }
  }
}

export interface InsertTrackInput {
  title: string;
  artist_name: string;
  audio_url: string;
  category?: string | null;
  tool_used?: string | null;
  description?: string | null;
  lyrics?: string | null;
  cover_art_url?: string | null;
  status?: string;
  upvotes_count?: number;
  family_friendly?: boolean;
  is_explicit?: boolean;
  channel_exclusions?: string[];
}

export async function insertTrackDirect(
  input: InsertTrackInput,
  options: {
    client?: MinimalPgClient;
    databaseUrl?: string;
  } = {}
): Promise<DirectDbTrackRow & { status: string; created_at?: string }> {
  if (!input.title || !input.title.trim()) {
    throw new Error('Track title is required');
  }
  if (!input.artist_name || !input.artist_name.trim()) {
    throw new Error('Artist name is required');
  }
  if (!input.audio_url || !input.audio_url.trim()) {
    throw new Error('Audio URL is required');
  }

  const title = input.title.trim();
  const artistName = input.artist_name.trim();
  const audioUrl = input.audio_url.trim();
  const category = input.category?.trim() || 'General';
  const toolUsed = input.tool_used?.trim() || 'Suno';
  const description = input.description?.trim() || null;
  const lyrics = input.lyrics?.trim() || null;
  const coverArtUrl = input.cover_art_url?.trim() || null;
  const status = input.status || 'approved';
  const upvotesCount = typeof input.upvotes_count === 'number' ? input.upvotes_count : 25;
  const familyFriendly = input.family_friendly !== false;
  const isExplicit = Boolean(input.is_explicit);
  const channelExclusions = Array.isArray(input.channel_exclusions) ? input.channel_exclusions : [];

  let client = options.client;
  let ownClient = false;

  if (!client) {
    if (process.env.VITEST && !options.databaseUrl) {
      throw new Error('Database client or URL must be provided in test environment');
    }
    const resolvedUrl =
      (options.databaseUrl && formatPostgresSessionUrl(options.databaseUrl)) ||
      getDirectPostgresDatabaseUrl();

    if (!resolvedUrl) {
      throw new Error('DATABASE_URL is required to perform direct PostgreSQL insert');
    }

    client = await createDefaultPgClient(resolvedUrl);
    ownClient = true;
  }

  try {
    const res = await client.query(
      `
        INSERT INTO public.tracks (
          title,
          artist_name,
          audio_url,
          category,
          tool_used,
          description,
          lyrics,
          cover_art_url,
          status,
          upvotes_count,
          family_friendly,
          is_explicit,
          channel_exclusions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING
          id::text as id,
          title,
          artist_name,
          audio_url,
          tool_used,
          COALESCE(upvotes_count, 0) as upvotes_count,
          cover_art_url,
          category,
          description,
          lyrics,
          COALESCE(is_explicit, false) as is_explicit,
          COALESCE(family_friendly, true) as family_friendly,
          status,
          created_at
      `,
      [
        title,
        artistName,
        audioUrl,
        category,
        toolUsed,
        description,
        lyrics,
        coverArtUrl,
        status,
        upvotesCount,
        familyFriendly,
        isExplicit,
        channelExclusions,
      ]
    );

    return res.rows[0];
  } finally {
    if (ownClient && client) {
      try {
        await client.end();
      } catch {
        // Non-blocking cleanup
      }
    }
  }
}

export async function listAllTracksDirect(
  options: {
    limit?: number;
    client?: MinimalPgClient;
    databaseUrl?: string;
  } = {}
): Promise<DirectDbTrackRow[]> {
  const limit = options.limit || 200;

  let client = options.client;
  let ownClient = false;

  if (!client) {
    if (process.env.VITEST && !options.databaseUrl) {
      return [];
    }
    const resolvedUrl =
      (options.databaseUrl && formatPostgresSessionUrl(options.databaseUrl)) ||
      getDirectPostgresDatabaseUrl();

    if (!resolvedUrl) {
      return [];
    }

    client = await createDefaultPgClient(resolvedUrl);
    ownClient = true;
  }

  try {
    const res = await client.query(
      `
        SELECT
          id::text as id,
          title,
          artist_name,
          audio_url,
          tool_used,
          COALESCE(upvotes_count, 0) as upvotes_count,
          cover_art_url,
          category,
          description,
          lyrics,
          COALESCE(is_explicit, false) as is_explicit,
          COALESCE(family_friendly, true) as family_friendly,
          status,
          created_at
        FROM public.tracks
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [limit]
    );

    return (res.rows as DirectDbTrackRow[]) || [];
  } finally {
    if (ownClient && client) {
      try {
        await client.end();
      } catch {
        // Non-blocking cleanup
      }
    }
  }
}
