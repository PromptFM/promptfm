-- supabase/migrations/20261103_add_track_metadata_fields.sql
-- Migration: Add extended metadata fields to public.tracks
-- Supports automatic metadata extraction (ID3/MP4 tags, lyrics, description, cover art)

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS lyrics TEXT,
  ADD COLUMN IF NOT EXISTS cover_art_url TEXT;

COMMENT ON COLUMN public.tracks.category IS 'Station category / sound style (e.g. Synthwave & Electro, Ambient & Lo-Fi, Cyberpunk & Industrial, Chiptune & 8-Bit).';
COMMENT ON COLUMN public.tracks.description IS 'Track prompt, background notes, or AI generator description.';
COMMENT ON COLUMN public.tracks.lyrics IS 'Spoken lyrics, vocal prompts, or USLT ID3 tag contents.';
COMMENT ON COLUMN public.tracks.cover_art_url IS 'URL to embedded or uploaded cover art image, defaults to /logo-mark.png if omitted.';

