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
  upvotes_count  INTEGER     NOT NULL    DEFAULT 0
);

COMMENT ON TABLE  public.tracks                IS 'AI-generated music tracks submitted by the community.';
COMMENT ON COLUMN public.tracks.tool_used      IS 'The AI generation tool used (Suno, Udio, Stable Audio, Other).';
COMMENT ON COLUMN public.tracks.status         IS 'Moderation state: pending → approved or rejected.';
COMMENT ON COLUMN public.tracks.upvotes_count  IS 'Denormalized vote count, kept in sync by trigger.';

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

