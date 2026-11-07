-- supabase/migrations/20261107_add_feature_flags.sql
-- Migration: Add feature_flags table for runtime admin kill-switches and staged rollouts

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL DEFAULT 'system',
  is_kill_switch BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by TEXT NOT NULL DEFAULT 'system',
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags(category);

-- Seed initial core feature flags and kill switches
INSERT INTO feature_flags (key, name, description, enabled, category, is_kill_switch, updated_by, notes)
VALUES
  ('maintenance_mode', 'Station Maintenance Mode', 'Puts the station in maintenance mode and alerts listeners', false, 'system', true, 'seed', 'Emergency kill-switch to pause station operations'),
  ('live_audio_stream', 'Live Audio Stream Output', 'Controls whether the live Icecast audio stream player is active', true, 'streaming', true, 'seed', 'Emergency switch to halt stream playback'),
  ('community_requests', 'Listener Song Requests', 'Allows listeners to submit song and dedication requests via Discord, Telegram, and Web', true, 'community', true, 'seed', 'Allows pausing listener request queues during peak traffic or moderation review'),
  ('ai_dj_speech', 'AI DJ Voice Synthesis', 'Enables generative speech for track intros, station IDs, weather, and news', true, 'ai_dj', true, 'seed', 'Kill switch if TTS/Gemini API experiences rate limits or outages'),
  ('sponsor_ads', 'Sponsor Audio Ads', 'Plays sponsor campaign audio spots between rotational track blocks', true, 'monetization', true, 'seed', 'Controls commercial injection into stream'),
  ('listener_chat', 'Listener Community Chat', 'Enables listener chat bridge across Discord and Telegram', true, 'community', false, 'seed', 'Community chat interaction'),
  ('community_voting', 'Song Leaderboard Voting', 'Allows listeners to upvote songs for the weekly leaderboard', true, 'community', false, 'seed', 'Voting system for leaderboard ranking'),
  ('explicit_content', 'Allow Explicit Broadcasts', 'Permits explicit lyrics on designated adult late-night channels', true, 'moderation', false, 'seed', 'Moderation toggle for explicit channel content'),
  ('x_social_broadcasts', 'X (Twitter) Now-Playing Alerts', 'Posts live on-air transitions and station drops to @promptfm_live', true, 'streaming', false, 'seed', 'Social media broadcast synchronization')
ON CONFLICT (key) DO NOTHING;

