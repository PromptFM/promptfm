-- ============================================================
-- PromptFM Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ----------------------------------------------------------------
-- 1. TRACKS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL    DEFAULT now(),
  title          TEXT        NOT NULL,
  artist_name    TEXT        NOT NULL,
  user_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  audio_url      TEXT        NOT NULL,
  tool_used      TEXT        NOT NULL    CHECK (tool_used IN ('Suno', 'Udio', 'Stable Audio', 'Other')),
  status         TEXT        NOT NULL    DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
  upvotes_count  INTEGER     NOT NULL    DEFAULT 0,
  category       TEXT,
  description    TEXT,
  lyrics         TEXT,
  cover_art_url  TEXT,
  is_explicit    BOOLEAN     NOT NULL    DEFAULT false,
  rejection_reason TEXT
);

COMMENT ON TABLE  public.tracks                IS 'AI-generated music tracks submitted by the community.';
COMMENT ON COLUMN public.tracks.tool_used      IS 'The AI generation tool used (Suno, Udio, Stable Audio, Other).';
COMMENT ON COLUMN public.tracks.status         IS 'Moderation state: pending → approved or rejected.';
COMMENT ON COLUMN public.tracks.upvotes_count  IS 'Denormalized vote count, kept in sync by trigger.';
COMMENT ON COLUMN public.tracks.category       IS 'Station category / sound style (e.g. Synthwave & Electro, Ambient & Lo-Fi, etc.).';
COMMENT ON COLUMN public.tracks.description    IS 'Track prompt, background notes, or AI generator description.';
COMMENT ON COLUMN public.tracks.lyrics         IS 'Spoken lyrics, vocal prompts, or USLT ID3 tag contents.';
COMMENT ON COLUMN public.tracks.cover_art_url  IS 'URL to embedded or uploaded cover art image, defaults to /logo-mark.png.';
COMMENT ON COLUMN public.tracks.is_explicit    IS 'Parental control flag: true for 18+ explicit tracks.';
COMMENT ON COLUMN public.tracks.rejection_reason IS 'Explanation if declined by station moderation.';

-- ----------------------------------------------------------------
-- 2. VOTES TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL    REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id   UUID        NOT NULL    REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL    DEFAULT now(),

  -- Prevents duplicate votes from the same user on the same track
  CONSTRAINT votes_user_track_unique UNIQUE (user_id, track_id)
);

COMMENT ON TABLE public.votes IS 'One record per (user, track) pair — enforced unique vote.';

-- ----------------------------------------------------------------
-- 3. INDEXES
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tracks_status_upvotes
  ON public.tracks (status, upvotes_count DESC);

CREATE INDEX IF NOT EXISTS idx_tracks_user_id
  ON public.tracks (user_id);

CREATE INDEX IF NOT EXISTS idx_votes_track_id
  ON public.votes (track_id);

CREATE INDEX IF NOT EXISTS idx_votes_user_id
  ON public.votes (user_id);

-- ----------------------------------------------------------------
-- 4. TRIGGER — keep upvotes_count in sync
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_vote_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.tracks
    SET    upvotes_count = upvotes_count + 1
    WHERE  id = NEW.track_id;
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.tracks
    SET    upvotes_count = GREATEST(upvotes_count - 1, 0)
    WHERE  id = OLD.track_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Drop & recreate so this script is idempotent
DROP TRIGGER IF EXISTS on_vote_change ON public.votes;

CREATE TRIGGER on_vote_change
  AFTER INSERT OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_vote_change();

-- ----------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ----------------------------------------------------------------

-- Tracks RLS
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can read approved tracks
CREATE POLICY "Public can view approved tracks"
  ON public.tracks
  FOR SELECT
  USING (status = 'approved');

-- Authenticated users can insert their own tracks
CREATE POLICY "Authenticated users can submit tracks"
  ON public.tracks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update only their own tracks (e.g. title edits — not status)
CREATE POLICY "Users can update their own tracks"
  ON public.tracks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Votes RLS
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read vote counts (used for display)
CREATE POLICY "Public can view votes"
  ON public.votes
  FOR SELECT
  USING (true);

-- Authenticated users can cast a vote
CREATE POLICY "Authenticated users can vote"
  ON public.votes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete (un-vote) only their own votes
CREATE POLICY "Users can delete their own votes"
  ON public.votes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 6. CHANNELS (Public & Private Stations)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channels (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT        NOT NULL UNIQUE, -- e.g. 'main', 'kids', 'cyberpunk', 'private-room'
  name         TEXT        NOT NULL,
  description  TEXT,
  is_private   BOOLEAN     NOT NULL DEFAULT false,
  invite_token TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default theme channels
INSERT INTO public.channels (slug, name, description, is_private)
VALUES 
  ('main', 'PromptFM Main Stage', 'Community top-voted AI hits', false),
  ('cyberpunk', 'Cyberpunk & Synth', 'High energy dark synthwave and electro', false),
  ('kids', 'Kids & Family', 'Gentle, playful, child-friendly AI melodies', false)
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------
-- 7. CHANNEL QUEUE (Prompt-Driven Song Requests)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_queue (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID        NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  track_id     UUID        NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  prompt_used  TEXT,       -- e.g. "play something cyberpunk with female vocals"
  requested_by TEXT        DEFAULT 'Anonymous Listener',
  played_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------
-- 8. LIVE CHAT ROOMS (Powered by Supabase Realtime)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID        NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_name  TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for Chat & Channels
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view public channels"
  ON public.channels FOR SELECT
  USING (is_private = false OR invite_token IS NOT NULL);

CREATE POLICY "Public can view channel queues"
  ON public.channel_queue FOR SELECT
  USING (true);

CREATE POLICY "Public can request songs to queue"
  ON public.channel_queue FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can read and send chat messages"
  ON public.chat_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable Supabase Realtime publication on chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- ----------------------------------------------------------------
-- 9. COMMUNITY REQUESTS & INTERSTITIAL BATCH SLOTS
-- Handles Discord/Telegram listener requests, dedications, weather, and zodiac
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform            TEXT        NOT NULL CHECK (platform IN ('discord', 'telegram', 'web')),
  platform_user_id    TEXT        NOT NULL,
  platform_user_name  TEXT        NOT NULL,
  platform_message_id TEXT,       -- Used to add checkmark reactions or reply in chat
  type                TEXT        NOT NULL CHECK (type IN ('song', 'dedication', 'weather', 'news', 'zodiac')),
  content             TEXT        NOT NULL, -- Prompt, message, or request details
  target              TEXT,       -- Dedicated person (for dedications) or City (for weather) or Zodiac sign
  batch_id            TEXT,       -- e.g. "batch-15:30"
  status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'aired', 'rejected')),
  rejection_reason    TEXT,       -- Explanation sent back to Discord / Telegram if rejected
  is_explicit         BOOLEAN     NOT NULL DEFAULT false,
  estimated_air_time  TIMESTAMPTZ,
  aired_at            TIMESTAMPTZ,
  audio_url           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_requests_status_type
  ON public.community_requests (status, type, created_at ASC);

ALTER TABLE public.community_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read and submit community requests"
  ON public.community_requests FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 10. CONTENT REPORTS TABLE
-- Handles community reports across Web, Discord, Telegram, and MCP
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_reports (
  id                  TEXT        PRIMARY KEY,
  target_type         TEXT        NOT NULL CHECK (target_type IN ('track', 'broadcast', 'request', 'user')),
  target_id           TEXT        NOT NULL, -- track UUID, request ID, or content description
  reason              TEXT        NOT NULL CHECK (reason IN ('copyright_dmca', 'hate_harassment', 'religious_ethical', 'unlabeled_18_plus', 'spam_abuse', 'other')),
  details             TEXT,
  reporter_platform   TEXT        NOT NULL CHECK (reporter_platform IN ('web', 'discord', 'telegram', 'mcp', 'api')),
  reporter_id         TEXT,       -- User UUID, platform ID, or IP hash
  status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by         TEXT,       -- Admin identifier or actor who resolved the report
  resolved_at         TIMESTAMPTZ, -- Timestamp when resolution occurred
  notes               TEXT        -- Moderation explanation or resolution notes
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status
  ON public.content_reports (status, created_at DESC);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can submit content reports"
  ON public.content_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view own or pending reports"
  ON public.content_reports FOR SELECT USING (true);

-- ----------------------------------------------------------------
-- 11. SAFE MIGRATION PATCH (For existing databases)
-- ----------------------------------------------------------------
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS is_explicit BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Synthwave & Electro';
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS lyrics TEXT;
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS cover_art_url TEXT;

ALTER TABLE public.community_requests ADD COLUMN IF NOT EXISTS is_explicit BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.community_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS notes TEXT;

-- ----------------------------------------------------------------
-- 12. STATION STATE (Persistent Airplay across serverless lambdas)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.station_state (
  channel_slug TEXT PRIMARY KEY DEFAULT 'main',
  airplay_item JSONB NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.station_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read station state" ON public.station_state FOR SELECT USING (true);
CREATE POLICY "Admin write station state" ON public.station_state FOR ALL USING (true) WITH CHECK (true);





