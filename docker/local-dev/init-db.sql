-- ============================================================
-- PromptFM Local Developer Seed Database (PostgreSQL + pgvector)
-- Initializes local tables, indexes, and test channels
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. TRACKS TABLE
CREATE TABLE IF NOT EXISTS public.tracks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL    DEFAULT now(),
  title          TEXT        NOT NULL,
  artist_name    TEXT        NOT NULL,
  user_id        UUID,
  audio_url      TEXT        NOT NULL,
  tool_used      TEXT        NOT NULL    CHECK (tool_used IN ('Suno', 'Udio', 'Stable Audio', 'Other')),
  status         TEXT        NOT NULL    DEFAULT 'approved'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
  upvotes_count  INTEGER     NOT NULL    DEFAULT 0,
  category       TEXT,
  description    TEXT,
  lyrics         TEXT,
  cover_art_url  TEXT,
  is_explicit    BOOLEAN     NOT NULL    DEFAULT false,
  is_family_friendly BOOLEAN NOT NULL   DEFAULT true,
  embedding      vector(1536),
  rejection_reason TEXT
);

-- 2. VOTES TABLE
CREATE TABLE IF NOT EXISTS public.votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL,
  track_id   UUID        NOT NULL    REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL    DEFAULT now(),
  CONSTRAINT votes_user_track_unique UNIQUE (user_id, track_id)
);

-- 3. CHANNELS TABLE
CREATE TABLE IF NOT EXISTS public.channels (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  genre        TEXT NOT NULL,
  owner_dj     TEXT NOT NULL,
  frequency_label TEXT NOT NULL,
  theme_color  TEXT NOT NULL DEFAULT 'emerald',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  is_family_friendly BOOLEAN NOT NULL DEFAULT false,
  is_watershed_only BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CHANNEL TRACKS ROTATION MAP
CREATE TABLE IF NOT EXISTS public.channel_tracks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  track_id   UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT channel_track_unique UNIQUE (channel_id, track_id)
);

-- 5. SEED INITIAL CHANNELS
INSERT INTO public.channels (id, name, description, genre, owner_dj, frequency_label, theme_color, is_active, is_family_friendly, is_watershed_only)
VALUES
  ('main', 'PromptFM Main Stage', '24/7 autonomous top-charting AI music across all genres with live neural DJ commentary.', 'Multi-Genre AI', 'DJ Neon', '101.5 FM', 'emerald', true, false, false),
  ('chillout', 'Lofi & Ambient Sanctuary', 'Generative neural soundscapes, downtempo study beats, and peaceful sleep frequencies.', 'Lofi Ambient', 'DJ Luna', '94.2 FM', 'blue', true, true, false),
  ('cyberpunk', 'Neon Alley Darkwave', 'Heavy synthwave, industrial EBM, cyberpunk techno, and dystopian digital anthems.', 'Cyberpunk Synth', 'DJ Cipher', '108.0 FM', 'fuchsia', true, false, false),
  ('retro', 'Arcade 80s Synthwave', 'Nostalgic 1980s dreamwave, outrun arpeggios, and vintage chiptune melodies.', '80s Outrun', 'DJ Pixel', '88.8 FM', 'amber', true, true, false),
  ('kids', 'Tiny Prompt Nursery', 'COPPA-compliant, educational, wholesome musical stories and fun lullabies for children.', 'Nursery & Fun', 'DJ Vance', '91.1 FM', 'pink', true, true, false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 6. SEED MOCK TEST TRACKS
INSERT INTO public.tracks (id, title, artist_name, audio_url, tool_used, status, upvotes_count, category, description, is_explicit, is_family_friendly)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Neon Horizons (Local Synth)', 'CyberBot', 'http://localhost:9000/promptfm-audio/track-1.mp3', 'Suno', 'approved', 42, 'Synthwave & Electro', 'High energy cyberpunk retro drive', false, true),
  ('22222222-2222-2222-2222-222222222222', 'Midnight Caffeine Lo-Fi', 'Luna Dreamer', 'http://localhost:9000/promptfm-audio/track-2.mp3', 'Udio', 'approved', 35, 'Ambient & Lo-Fi', 'Relaxing late night coding beats', false, true),
  ('33333333-3333-3333-3333-333333333333', 'Binary Sunrise', 'AlgoRhythm', 'http://localhost:9000/promptfm-audio/track-3.mp3', 'Stable Audio', 'approved', 19, 'Dance & Club', 'Uplifting progressive house anthem', false, true)
ON CONFLICT (id) DO NOTHING;

-- 7. MAP SEED TRACKS TO CHANNELS
INSERT INTO public.channel_tracks (channel_id, track_id)
VALUES
  ('main', '11111111-1111-1111-1111-111111111111'),
  ('cyberpunk', '11111111-1111-1111-1111-111111111111'),
  ('main', '22222222-2222-2222-2222-222222222222'),
  ('chillout', '22222222-2222-2222-2222-222222222222'),
  ('main', '33333333-3333-3333-3333-333333333333')
ON CONFLICT (channel_id, track_id) DO NOTHING;
