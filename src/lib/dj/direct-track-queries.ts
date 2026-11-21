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

export async function fetchTrackByTitleOrLyricsDirect(query: {
  prompt?: string | null;
  lyrics?: string | null;
  channelSlug?: string | null;
  client?: MinimalPgClient;
  databaseUrl?: string;
}): Promise<DirectDbTrackRow | null> {
  const prompt = query.prompt?.trim() || null;
  const lyrics = query.lyrics?.trim() || null;

  let client = query.client;
  let ownClient = false;

  if (!client) {
    if (process.env.VITEST && !query.databaseUrl) {
      return null;
    }
    const resolvedUrl =
      (query.databaseUrl && formatPostgresSessionUrl(query.databaseUrl)) ||
      getDirectPostgresDatabaseUrl();

    if (!resolvedUrl) {
      return null;
    }

    client = await createDefaultPgClient(resolvedUrl);
    ownClient = true;
  }

  try {
    if (prompt && lyrics) {
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
            AND (title ILIKE $1 OR description ILIKE $1 OR lyrics ILIKE $2)
          ORDER BY upvotes_count DESC
          LIMIT 1
        `,
        [`%${prompt}%`, `%${lyrics}%`]
      );
      if (res.rows[0]) return res.rows[0];
    }

    if (lyrics) {
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
            AND lyrics ILIKE $1
          ORDER BY upvotes_count DESC
          LIMIT 1
        `,
        [`%${lyrics}%`]
      );
      if (res.rows[0]) return res.rows[0];
    }

    if (prompt) {
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
            AND (title ILIKE $1 OR description ILIKE $1)
          ORDER BY upvotes_count DESC
          LIMIT 1
        `,
        [`%${prompt}%`]
      );
      if (res.rows[0]) return res.rows[0];
    }

    // Fallback: top approved track
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
        LIMIT 1
      `
    );

    return res.rows[0] || null;
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

export async function fetchStationStateDirect(options: {
  channelSlug?: string | null;
  client?: MinimalPgClient;
  databaseUrl?: string;
} = {}): Promise<{
  channel_slug: string;
  airplay_item: any;
  staged_item?: any;
  started_at: string;
} | null> {
  const channelSlug = options.channelSlug || 'main';

  let client = options.client;
  let ownClient = false;

  if (!client) {
    if (process.env.VITEST && !options.databaseUrl) {
      return null;
    }
    const resolvedUrl =
      (options.databaseUrl && formatPostgresSessionUrl(options.databaseUrl)) ||
      getDirectPostgresDatabaseUrl();

    if (!resolvedUrl) {
      return null;
    }

    client = await createDefaultPgClient(resolvedUrl);
    ownClient = true;
  }

  try {
    const res = await client.query(
      `
        SELECT
          channel_slug,
          airplay_item,
          staged_item,
          started_at
        FROM public.station_state
        WHERE channel_slug = $1
        LIMIT 1
      `,
      [channelSlug]
    );

    return res.rows[0] || null;
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

export async function countPendingQueueDirect(options: {
  channelSlug?: string | null;
  client?: MinimalPgClient;
  databaseUrl?: string;
} = {}): Promise<number> {
  const channelSlug = options.channelSlug || 'main';

  let client = options.client;
  let ownClient = false;

  if (!client) {
    if (process.env.VITEST && !options.databaseUrl) {
      return 0;
    }
    const resolvedUrl =
      (options.databaseUrl && formatPostgresSessionUrl(options.databaseUrl)) ||
      getDirectPostgresDatabaseUrl();

    if (!resolvedUrl) {
      return 0;
    }

    client = await createDefaultPgClient(resolvedUrl);
    ownClient = true;
  }

  try {
    const res = await client.query(
      `
        SELECT count(*)::text as count
        FROM public.channel_queue q
        WHERE (q.channel_id IN (SELECT id FROM public.channels WHERE slug = $1) OR q.channel_id = $1)
          AND q.played_at IS NULL
      `,
      [channelSlug]
    );

    return parseInt(res.rows[0]?.count || '0', 10) || 0;
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

export interface PendingQueueItemDirect {
  queue_id: string;
  channel_id: string;
  track_id: string;
  prompt_used: string;
  requested_by: string;
  created_at: string;
  title: string;
  artist_name: string;
  audio_url: string;
  tool_used: string;
  upvotes_count: number;
  cover_art_url?: string | null;
  category?: string | null;
  is_explicit?: boolean;
  family_friendly?: boolean;
}

export async function insertChannelQueueDirect(params: {
  channelSlug?: string | null;
  trackId: string;
  promptUsed: string;
  requestedBy: string;
  priority?: boolean;
  client?: MinimalPgClient;
  databaseUrl?: string;
}): Promise<any> {
  const channelSlug = params.channelSlug || 'main';

  let client = params.client;
  let ownClient = false;

  if (!client) {
    if (process.env.VITEST && !params.databaseUrl) {
      throw new Error('Database client or URL must be provided in test environment');
    }
    const resolvedUrl =
      (params.databaseUrl && formatPostgresSessionUrl(params.databaseUrl)) ||
      getDirectPostgresDatabaseUrl();

    if (!resolvedUrl) {
      throw new Error('DATABASE_URL is required to perform direct channel_queue insert');
    }

    client = await createDefaultPgClient(resolvedUrl);
    ownClient = true;
  }

  try {
    const res = await client.query(
      `
        INSERT INTO public.channel_queue (
          channel_id,
          track_id,
          prompt_used,
          requested_by
        ) VALUES (
          COALESCE(
            (SELECT id FROM public.channels WHERE slug = $1 LIMIT 1),
            (SELECT id FROM public.channels WHERE id::text = $1 LIMIT 1),
            $1
          ),
          $2, $3, $4
        )
        RETURNING
          id::text as id,
          channel_id::text as channel_id,
          track_id::text as track_id,
          prompt_used,
          requested_by,
          created_at
      `,
      [channelSlug, params.trackId, params.promptUsed, params.requestedBy]
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

export async function fetchPendingChannelQueueDirect(params: {
  channelSlug?: string | null;
  limit?: number;
  client?: MinimalPgClient;
  databaseUrl?: string;
} = {}): Promise<PendingQueueItemDirect[]> {
  const channelSlug = params.channelSlug || 'main';
  const limit = params.limit ?? 10;

  let client = params.client;
  let ownClient = false;

  if (!client) {
    if (process.env.VITEST && !params.databaseUrl) {
      return [];
    }
    const resolvedUrl =
      (params.databaseUrl && formatPostgresSessionUrl(params.databaseUrl)) ||
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
          q.id::text as queue_id,
          q.channel_id::text as channel_id,
          q.track_id::text as track_id,
          q.prompt_used,
          q.requested_by,
          q.created_at::text as created_at,
          t.title,
          t.artist_name,
          t.audio_url,
          t.tool_used,
          COALESCE(t.upvotes_count, 0) as upvotes_count,
          t.cover_art_url,
          t.category,
          COALESCE(t.is_explicit, false) as is_explicit,
          COALESCE(t.family_friendly, true) as family_friendly
        FROM public.channel_queue q
        JOIN public.tracks t ON t.id = q.track_id
        WHERE (q.channel_id IN (SELECT id FROM public.channels WHERE slug = $1) OR q.channel_id::text = $1)
          AND q.played_at IS NULL
        ORDER BY q.created_at ASC
        LIMIT $2
      `,
      [channelSlug, limit]
    );

    return (res.rows || []) as PendingQueueItemDirect[];
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

export async function markChannelQueueItemPlayedDirect(params: {
  queueId: string;
  client?: MinimalPgClient;
  databaseUrl?: string;
}): Promise<boolean> {
  let client = params.client;
  let ownClient = false;

  if (!client) {
    if (process.env.VITEST && !params.databaseUrl) {
      return false;
    }
    const resolvedUrl =
      (params.databaseUrl && formatPostgresSessionUrl(params.databaseUrl)) ||
      getDirectPostgresDatabaseUrl();

    if (!resolvedUrl) {
      return false;
    }

    client = await createDefaultPgClient(resolvedUrl);
    ownClient = true;
  }

  try {
    await client.query(
      `
        UPDATE public.channel_queue
        SET played_at = NOW()
        WHERE id::text = $1
      `,
      [params.queueId]
    );
    return true;
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

export async function insertCommunityRequestDirect(params: {
  platform: string;
  platformUserId: string;
  platformUserName: string;
  platformMessageId?: string | null;
  type: string;
  content: string;
  target?: string | null;
  batchId?: string | null;
  status: string;
  estimatedAirTime?: string | null;
  lyrics?: string | null;
  client?: MinimalPgClient;
  databaseUrl?: string;
}): Promise<any> {
  let client = params.client;
  let ownClient = false;

  if (!client) {
    if (process.env.VITEST && !params.databaseUrl) {
      throw new Error('Database client or URL must be provided in test environment');
    }
    const resolvedUrl =
      (params.databaseUrl && formatPostgresSessionUrl(params.databaseUrl)) ||
      getDirectPostgresDatabaseUrl();

    if (!resolvedUrl) {
      throw new Error('DATABASE_URL is required to perform direct community_requests insert');
    }

    client = await createDefaultPgClient(resolvedUrl);
    ownClient = true;
  }

  try {
    try {
      const res = await client.query(
        `
          INSERT INTO public.community_requests (
            platform,
            platform_user_id,
            platform_user_name,
            platform_message_id,
            type,
            content,
            target,
            batch_id,
            status,
            estimated_air_time,
            lyrics
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING
            id::text as id,
            platform,
            platform_user_id,
            platform_user_name,
            platform_message_id,
            type,
            content,
            target,
            batch_id,
            status,
            estimated_air_time,
            lyrics,
            created_at
        `,
        [
          params.platform,
          params.platformUserId,
          params.platformUserName,
          params.platformMessageId || null,
          params.type,
          params.content,
          params.target || null,
          params.batchId || null,
          params.status,
          params.estimatedAirTime || null,
          params.lyrics || null,
        ]
      );
      return res.rows[0];
    } catch {
      // Fallback if lyrics column does not exist in schema yet
      const fallbackRes = await client.query(
        `
          INSERT INTO public.community_requests (
            platform,
            platform_user_id,
            platform_user_name,
            platform_message_id,
            type,
            content,
            target,
            batch_id,
            status,
            estimated_air_time
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING
            id::text as id,
            platform,
            platform_user_id,
            platform_user_name,
            platform_message_id,
            type,
            content,
            target,
            batch_id,
            status,
            estimated_air_time,
            created_at
        `,
        [
          params.platform,
          params.platformUserId,
          params.platformUserName,
          params.platformMessageId || null,
          params.type,
          params.content,
          params.target || null,
          params.batchId || null,
          params.status,
          params.estimatedAirTime || null,
        ]
      );
      return fallbackRes.rows[0];
    }
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

export async function incrementTrackUpvotesDirect(
  trackId: string,
  options: {
    client?: MinimalPgClient;
    databaseUrl?: string;
  } = {}
): Promise<{ id: string; title: string; upvotes_count: number } | null> {
  if (!trackId || typeof trackId !== 'string' || !trackId.trim()) {
    return null;
  }

  const trimmedId = trackId.trim();
  let client = options.client;
  let ownClient = false;

  if (!client) {
    if (process.env.VITEST && !options.databaseUrl) {
      return null;
    }
    const resolvedUrl =
      (options.databaseUrl && formatPostgresSessionUrl(options.databaseUrl)) ||
      getDirectPostgresDatabaseUrl();

    if (!resolvedUrl) {
      return null;
    }

    client = await createDefaultPgClient(resolvedUrl);
    ownClient = true;
  }

  try {
    const res = await client.query(
      `
        UPDATE public.tracks
        SET upvotes_count = COALESCE(upvotes_count, 0) + 1
        WHERE id::text = $1
        RETURNING
          id::text as id,
          title,
          COALESCE(upvotes_count, 0) as upvotes_count
      `,
      [trimmedId]
    );

    const row = res.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      title: String(row.title),
      upvotes_count: Number(row.upvotes_count),
    };
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
