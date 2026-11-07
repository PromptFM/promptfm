-- supabase/migrations/20261107_add_channel_is_active.sql
-- Migration: Add is_active column for channel enable/disable controls and temporary main-stage-only mode (Issue #69)

ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.channels.is_active IS 'Whether the radio channel is active for airplay, public discovery, and listener stream playback';

-- Disable all secondary channels by default until multi-channel behavior is defined (Issue #69)
UPDATE public.channels
SET is_active = (slug = 'main');
