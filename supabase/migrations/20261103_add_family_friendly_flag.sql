-- supabase/migrations/20261103_add_family_friendly_flag.sql
-- Migration: Add family_friendly, is_explicit, and scan_flags to public.tracks

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS is_explicit BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS family_friendly BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scan_flags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.tracks.is_explicit IS 'True if profanity or 18+ adult themes are detected.';
COMMENT ON COLUMN public.tracks.family_friendly IS 'True if content is clean, uplifting, and safe for Kids & Family channel.';
COMMENT ON COLUMN public.tracks.scan_flags IS 'Array of detected content tags from automated lyric/metadata analysis.';

