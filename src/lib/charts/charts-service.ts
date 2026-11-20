// src/lib/charts/charts-service.ts
// Unified charts service providing top approved tracks with Supabase PostgREST and direct PostgreSQL pooler failover.

import { createAdminClient } from '../supabase/server';
import { fetchApprovedTracksDirect, type MinimalPgClient } from '../dj/direct-track-queries';
import type { Track } from '../../types/database';

export async function fetchTopApprovedTracks(options: {
  limit?: number;
  client?: MinimalPgClient;
  databaseUrl?: string;
} = {}): Promise<Track[]> {
  const limit = typeof options.limit === 'number' && options.limit > 0 ? options.limit : 20;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .eq('status', 'approved')
      .order('upvotes_count', { ascending: false })
      .limit(limit);

    if (!error && data && data.length > 0) {
      return data as Track[];
    }
  } catch {
    // Fail over to direct PostgreSQL
  }

  try {
    const directRows = await fetchApprovedTracksDirect({
      limit,
      client: options.client,
      databaseUrl: options.databaseUrl,
    });

    return directRows.map((row) => ({
      id: row.id,
      created_at: new Date().toISOString(),
      title: row.title,
      artist_name: row.artist_name,
      user_id: null,
      audio_url: row.audio_url,
      tool_used: (row.tool_used as Track['tool_used']) || 'Suno',
      status: 'approved',
      upvotes_count: row.upvotes_count,
      category: row.category || undefined,
      description: row.description,
      lyrics: row.lyrics,
      cover_art_url: row.cover_art_url,
      is_explicit: Boolean(row.is_explicit),
      family_friendly: row.family_friendly !== false,
    })) as Track[];
  } catch {
    return [];
  }
}
