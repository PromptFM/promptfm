// src/lib/dj/rag.ts
// PromptFM pgvector Semantic RAG & Vibe Search Engine
// Powers natural language music discovery, AI DJ set curation, and prompt-based radio airplay.

import { createAdminClient } from '../supabase/server';
import { generateEmbedding, buildTrackEmbeddingDocument, TrackMetadataForEmbedding } from '../ai/embeddings';
import { isContentAllowedForAirplay } from './roster';

export interface VibeMatchResult {
  id: string;
  title: string;
  artist_name: string;
  category?: string;
  description?: string | null;
  lyrics?: string | null;
  audio_url: string;
  tool_used: string;
  upvotes_count: number;
  family_friendly?: boolean;
  is_explicit?: boolean;
  similarity: number;
  matchMethod: 'pgvector' | 'lexical_fallback';
}

export interface FindTracksOptions {
  limit?: number;
  matchThreshold?: number;
  channelSlug?: string;
  familyFriendlyOnly?: boolean;
  allowExplicit?: boolean;
  referenceDate?: Date;
  supabaseClient?: any;
}

/**
 * Searches the PromptFM music library using semantic vector similarity (pgvector)
 * with automatic fallback to multi-field lexical relevance ranking.
 */
export async function findTracksByVibe(
  prompt: string,
  options: FindTracksOptions = {}
): Promise<VibeMatchResult[]> {
  const query = (prompt || '').trim();
  if (!query) return [];

  const limit = options.limit ?? 5;
  const matchThreshold = options.matchThreshold ?? 0.3;
  const channelSlug = options.channelSlug || 'main';
  const familyFriendlyOnly = options.familyFriendlyOnly ?? (channelSlug === 'kids');
  const now = options.referenceDate ?? new Date();

  const supabase = options.supabaseClient || createAdminClient();

  // ── 1. Vector Search via pgvector RPC ───────────────────────────────────────
  try {
    const queryVector = await generateEmbedding(query);
    const { data: rpcMatches, error } = await supabase.rpc('match_tracks_by_vibe', {
      query_embedding: queryVector,
      match_threshold: matchThreshold,
      match_count: limit * 2, // Fetch buffer to account for channel parental filters
      filter_family_friendly: familyFriendlyOnly ? true : null,
      filter_channel_slug: channelSlug,
    });

    if (!error && Array.isArray(rpcMatches) && rpcMatches.length > 0) {
      const filtered = rpcMatches
        .filter((track: any) => {
          if (familyFriendlyOnly && (!track.family_friendly || track.is_explicit)) {
            return false;
          }
          if (channelSlug === 'afterdark') {
            return true;
          }
          return isContentAllowedForAirplay(Boolean(track.is_explicit), channelSlug, now);
        })
        .slice(0, limit)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          artist_name: t.artist_name,
          category: t.category,
          description: t.description,
          lyrics: t.lyrics,
          audio_url: t.audio_url,
          tool_used: t.tool_used || 'Other',
          upvotes_count: t.upvotes_count ?? 0,
          family_friendly: Boolean(t.family_friendly),
          is_explicit: Boolean(t.is_explicit),
          similarity: parseFloat((t.similarity ?? 0.5).toFixed(4)),
          matchMethod: 'pgvector' as const,
        }));

      if (filtered.length > 0) {
        return filtered;
      }
    }
  } catch (vectorErr) {
    console.warn('[Semantic RAG] pgvector RPC note, falling back to lexical search:', vectorErr);
  }

  // ── 2. Lexical Fallback Search ──────────────────────────────────────────────
  try {
    const { data: library } = await supabase
      .from('tracks')
      .select('*')
      .eq('status', 'approved');

    if (!library || library.length === 0) {
      return [];
    }

    const queryTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    if (queryTerms.length === 0) {
      return [];
    }

    const scored = (library as any[])
      .filter((track) => {
        if (familyFriendlyOnly && (!track.family_friendly || track.is_explicit)) {
          return false;
        }
        if (channelSlug === 'afterdark') {
          return true;
        }
        return isContentAllowedForAirplay(Boolean(track.is_explicit), channelSlug, now);
      })
      .map((track) => {
        const fullText = [
          track.title,
          track.artist_name,
          track.category,
          track.description,
          track.lyrics,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        let matches = 0;
        for (const term of queryTerms) {
          if (fullText.includes(term)) {
            matches++;
          }
        }

        const similarity = matches / queryTerms.length;
        return {
          id: track.id,
          title: track.title,
          artist_name: track.artist_name,
          category: track.category,
          description: track.description,
          lyrics: track.lyrics,
          audio_url: track.audio_url,
          tool_used: track.tool_used || 'Other',
          upvotes_count: track.upvotes_count ?? 0,
          family_friendly: Boolean(track.family_friendly),
          is_explicit: Boolean(track.is_explicit),
          similarity: parseFloat(similarity.toFixed(4)),
          matchMethod: 'lexical_fallback' as const,
        };
      })
      .filter((t) => t.similarity >= matchThreshold)
      .sort((a, b) => b.similarity - a.similarity || b.upvotes_count - a.upvotes_count)
      .slice(0, limit);

    return scored;
  } catch (fallbackErr) {
    console.warn('[Semantic RAG] Lexical fallback error:', fallbackErr);
    return [];
  }
}

/**
 * Generates and saves a vector embedding for a track into the database.
 */
export async function indexTrackEmbedding(
  trackId: string,
  track: TrackMetadataForEmbedding,
  supabaseClient?: any
): Promise<{ success: boolean; embedding?: number[]; error?: string }> {
  try {
    const document = buildTrackEmbeddingDocument(track);
    const vector = await generateEmbedding(document);

    const supabase = supabaseClient || createAdminClient();
    const { error } = await supabase
      .from('tracks')
      .update({ embedding: vector })
      .eq('id', trackId);

    if (error) {
      console.warn('[Index Track] DB update note:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, embedding: vector };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
