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

export function formatPostgresSessionUrl(rawUrl: string): string {
  if (rawUrl.includes(':6543/') && rawUrl.includes('pooler.supabase.com')) {
    return rawUrl.replace(':6543/', ':5432/');
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('pooler.supabase.com') && parsed.port === '6543') {
      parsed.port = '5432';
      return parsed.toString();
    }
    return rawUrl;
  } catch {
    return rawUrl.replace(':6543/', ':5432/');
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
