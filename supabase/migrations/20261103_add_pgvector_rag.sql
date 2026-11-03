-- supabase/migrations/20261103_add_pgvector_rag.sql
-- Migration: Enable pgvector extension, add 768-dim embedding column to tracks,
-- create HNSW index for high-speed cosine distance similarity search,
-- and provide the match_tracks_by_vibe stored procedure for DJ agent semantic RAG set curation.

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to tracks table (Gemini text-embedding-004 produces 768-dim vectors)
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. Create HNSW vector index for blazing-fast approximate nearest neighbor (ANN) cosine similarity search
CREATE INDEX IF NOT EXISTS idx_tracks_embedding
  ON public.tracks
  USING hnsw (embedding vector_cosine_ops);

-- 4. Stored Procedure for Semantic Vibe RAG Search
-- Matches query embedding against approved tracks with similarity threshold and channel parental filters.
CREATE OR REPLACE FUNCTION match_tracks_by_vibe(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5,
  filter_family_friendly boolean DEFAULT NULL,
  filter_channel_slug text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  artist_name text,
  category text,
  description text,
  lyrics text,
  audio_url text,
  tool_used text,
  upvotes_count int,
  family_friendly boolean,
  is_explicit boolean,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.artist_name,
    t.category,
    t.description,
    t.lyrics,
    t.audio_url,
    t.tool_used,
    t.upvotes_count,
    COALESCE(t.family_friendly, false) AS family_friendly,
    COALESCE(t.is_explicit, false) AS is_explicit,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM public.tracks t
  WHERE t.status = 'approved'
    AND t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) >= match_threshold
    AND (
      filter_family_friendly IS NULL
      OR (filter_family_friendly = true AND t.family_friendly = true AND (t.is_explicit IS FALSE OR t.is_explicit IS NULL))
    )
  ORDER BY (1 - (t.embedding <=> query_embedding)) DESC, t.upvotes_count DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_tracks_by_vibe IS 'Performs pgvector cosine similarity search on tracks for PromptFM AI DJ agent set curation';
