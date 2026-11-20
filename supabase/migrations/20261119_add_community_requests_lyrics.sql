-- PromptFM: Adds optional lyrics excerpt column to community_requests for enhanced song matching (Issue #97)
ALTER TABLE public.community_requests ADD COLUMN IF NOT EXISTS lyrics TEXT;
