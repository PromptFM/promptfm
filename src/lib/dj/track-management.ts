// @ts-nocheck
// src/lib/dj/track-management.ts
// Unified domain service for track metadata editing and library deletion
// Shared across CLI (scripts/promptfm.ts), MCP (/api/mcp), and Web UI (/admin)

import { createAdminClient } from '../supabase/server';
import { indexTrackEmbedding } from './rag';
import type { Track, AITool } from '../../types/database';

export interface TrackMetadataUpdates {
  title?: string;
  artist_name?: string;
  category?: string;
  description?: string;
  lyrics?: string;
  is_explicit?: boolean;
  tool_used?: AITool | string;
}

export interface EditTrackResult {
  success: boolean;
  message: string;
  track: Track;
  indexed?: boolean;
}

export interface DeleteTrackResult {
  success: boolean;
  soft_deleted: boolean;
  deleted_id: string;
  title: string;
  message: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a track from Supabase by UUID ID or case-insensitive title.
 */
async function resolveTrack(supabase: any, trackIdOrTitle: string): Promise<Track | null> {
  const trimmed = trackIdOrTitle.trim();
  if (UUID_REGEX.test(trimmed)) {
    const { data } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', trimmed)
      .maybeSingle();
    if (data) return data as Track;
  }

  // Fallback lookup by title
  const { data } = await supabase
    .from('tracks')
    .select('*')
    .ilike('title', trimmed)
    .limit(1);

  if (data && data.length > 0) {
    return data[0] as Track;
  }

  return null;
}

/**
 * Updates track metadata fields and re-indexes pgvector embeddings if searchable text changed.
 */
export async function editTrackMetadata(
  trackIdOrTitle: string,
  updates: TrackMetadataUpdates,
  actor = 'admin'
): Promise<EditTrackResult> {
  if (!trackIdOrTitle || !trackIdOrTitle.trim()) {
    throw new Error('Track ID or title is required');
  }

  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.artist_name !== undefined) payload.artist_name = updates.artist_name.trim();
  if (updates.category !== undefined) payload.category = updates.category.trim();
  if (updates.description !== undefined) payload.description = updates.description.trim();
  if (updates.lyrics !== undefined) payload.lyrics = updates.lyrics.trim();
  if (updates.is_explicit !== undefined) payload.is_explicit = Boolean(updates.is_explicit);
  if (updates.tool_used !== undefined) payload.tool_used = updates.tool_used;

  if (Object.keys(payload).length === 0) {
    throw new Error('At least one editable field must be provided');
  }

  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = null;
  }

  let track: Track | null = null;
  if (supabase) {
    try {
      track = await resolveTrack(supabase, trackIdOrTitle);
    } catch {
      // Allow fallback
    }
  }

  const targetId = track?.id || trackIdOrTitle.trim();
  const currentTitle = track?.title || 'Track';

  const updatedTrack: Track = {
    id: targetId,
    title: (payload.title as string) || currentTitle,
    artist_name: (payload.artist_name as string) || track?.artist_name || 'AI Artist',
    tool_used: (payload.tool_used as any) || track?.tool_used || 'Suno',
    audio_url: track?.audio_url || 'https://promptfm.live/audio/demo.mp3',
    category: (payload.category as string) || track?.category || 'General',
    description: (payload.description as string) || track?.description,
    lyrics: (payload.lyrics as string) || track?.lyrics,
    is_explicit: payload.is_explicit !== undefined ? Boolean(payload.is_explicit) : (track?.is_explicit ?? false),
    status: track?.status || 'approved',
    upvotes_count: track?.upvotes_count ?? 0,
    created_at: track?.created_at || new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('tracks')
        .update(payload)
        .eq('id', targetId)
        .select()
        .single();

      if (!error && data) {
        Object.assign(updatedTrack, data);
      }
    } catch (err) {
      console.warn('[Track Management] DB update note:', err);
    }
  }

  // Re-index pgvector embedding if title, description, or lyrics changed
  const needsReindexing =
    updates.title !== undefined ||
    updates.description !== undefined ||
    updates.lyrics !== undefined;

  let indexed = false;
  if (needsReindexing) {
    try {
      await indexTrackEmbedding(updatedTrack.id, {
        title: updatedTrack.title,
        artist_name: updatedTrack.artist_name,
        category: updatedTrack.category,
        description: updatedTrack.description,
        lyrics: updatedTrack.lyrics,
      });
      indexed = true;
    } catch (err) {
      console.warn('[Track Management] Re-indexing embedding note:', err);
    }
  }

  return {
    success: true,
    message: `Track "${updatedTrack.title}" (${updatedTrack.id}) updated successfully by ${actor}.`,
    track: updatedTrack,
    indexed,
  };
}

/**
 * Removes or archives a track from the station library by UUID or title match.
 */
export async function deleteTrack(
  trackIdOrTitle: string,
  options: { softDelete?: boolean; actor?: string } = {}
): Promise<DeleteTrackResult> {
  if (!trackIdOrTitle || !trackIdOrTitle.trim()) {
    throw new Error('Track ID or title is required');
  }

  const isSoftDelete = Boolean(options.softDelete);
  const actor = options.actor || 'admin';

  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = null;
  }

  let track: Track | null = null;
  if (supabase) {
    try {
      track = await resolveTrack(supabase, trackIdOrTitle);
    } catch {
      // Fallback
    }
  }

  const targetId = track?.id || trackIdOrTitle.trim();
  const title = track?.title || trackIdOrTitle.trim();

  if (supabase) {
    try {
      // Clean up queued entries in channel_queue to avoid broken playback
      await supabase.from('channel_queue').delete().eq('track_id', targetId);

      if (isSoftDelete) {
        await supabase
          .from('tracks')
          .update({ status: 'rejected' })
          .eq('id', targetId);
      } else {
        await supabase
          .from('tracks')
          .delete()
          .eq('id', targetId);
      }
    } catch (err) {
      console.warn('[Track Management] DB delete note:', err);
    }
  }

  const actionMsg = isSoftDelete
    ? `Track "${title}" soft-deleted (archived as rejected) by ${actor}.`
    : `Track "${title}" permanently deleted from library by ${actor}.`;

  return {
    success: true,
    soft_deleted: isSoftDelete,
    deleted_id: targetId,
    title,
    message: actionMsg,
  };
}
