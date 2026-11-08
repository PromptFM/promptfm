-- supabase/migrations/20261107_add_request_lifecycle_statuses.sql
-- PromptFM: Expands community_requests status check constraint to support the full listener request lifecycle:
-- accepted -> queued -> airing_soon -> playing -> played (aired) -> rejected (declined)

ALTER TABLE public.community_requests 
  DROP CONSTRAINT IF EXISTS community_requests_status_check;

ALTER TABLE public.community_requests
  ADD CONSTRAINT community_requests_status_check
  CHECK (status IN (
    'pending',
    'accepted',
    'scheduled',
    'queued',
    'airing_soon',
    'playing',
    'aired',
    'played',
    'rejected'
  ));
