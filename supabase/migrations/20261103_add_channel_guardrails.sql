-- supabase/migrations/20261103_add_channel_guardrails.sql
-- Migration: Add channel guardrail parameters, 18+ age gate disclaimers, and 24/7 explicit channel

ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS is_family_safe BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS min_age INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_age_gate BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allow_explicit_24_7 BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS age_gate_disclaimer TEXT DEFAULT '';

-- Seed or update official channels with automated guardrails
INSERT INTO public.channels (
  slug,
  name,
  description,
  is_family_safe,
  min_age,
  requires_age_gate,
  allow_explicit_24_7,
  age_gate_disclaimer
)
VALUES
  (
    'afterdark',
    'After Dark (18+ Explicit)',
    '24/7 uncensored AI music, explicit lyrics, dark electronic, and raw underground bass.',
    false,
    18,
    true,
    true,
    'LEGAL AGE CONFIRMATION & CONSENT: This channel broadcasts uncensored audio containing adult language, profanity, mature themes, and adult content 24 hours a day. By proceeding, you certify under penalty of law that you are at least 18 years of age (or the legal age of majority in your jurisdiction), understand the adult nature of the programming, and affirmatively consent to receiving explicit broadcast content. If you are under 18, please select a Family Safe channel.'
  )
ON CONFLICT (slug) DO UPDATE SET
  is_family_safe = EXCLUDED.is_family_safe,
  min_age = EXCLUDED.min_age,
  requires_age_gate = EXCLUDED.requires_age_gate,
  allow_explicit_24_7 = EXCLUDED.allow_explicit_24_7,
  age_gate_disclaimer = EXCLUDED.age_gate_disclaimer;

COMMENT ON COLUMN public.channels.requires_age_gate IS 'When true, client player must verify user age or require legal consent before playback';
COMMENT ON COLUMN public.channels.allow_explicit_24_7 IS 'When true, channel permits explicit tracks all day long without watershed restriction';

