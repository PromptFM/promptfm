-- supabase/migrations/20261108_route_inbound_emails_admin.sql
-- Migration: Route inbound emails to admin-only storage, prune leaked records, and tighten community_requests RLS (Issue #115)

-- 1. Create private admin-only inbound_emails table
CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id           TEXT,
  from_address        TEXT        NOT NULL,
  to_addresses        TEXT[]      NOT NULL DEFAULT '{}',
  subject             TEXT        NOT NULL,
  text_body           TEXT,
  html_body           TEXT,
  category            TEXT        NOT NULL DEFAULT 'inquiry' CHECK (category IN ('inquiry', 'contact', 'complaint', 'support', 'other')),
  status              TEXT        NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'forwarded', 'handled', 'archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_category_created
  ON public.inbound_emails (category, created_at DESC);

ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;
-- No public policies created: table is strictly private to service_role (createAdminClient).

-- 2. Prune existing accidentally ingested email rows from community_requests
DELETE FROM public.community_requests
WHERE content LIKE '[Inbound%'
   OR content LIKE '%[Inbound Resend]%'
   OR content LIKE '%[Inbound Email]%'
   OR platform_user_id LIKE '%@%';

-- 3. Tighten RLS policies on community_requests
DROP POLICY IF EXISTS "Public read and submit community requests" ON public.community_requests;
DROP POLICY IF EXISTS "Public can insert community requests" ON public.community_requests;
DROP POLICY IF EXISTS "Public can view community requests" ON public.community_requests;

CREATE POLICY "Public can insert community requests"
  ON public.community_requests FOR INSERT
  WITH CHECK (type IN ('song', 'dedication', 'weather', 'news', 'zodiac'));

CREATE POLICY "Public can view community requests"
  ON public.community_requests FOR SELECT
  USING (
    type IN ('song', 'dedication', 'weather', 'news', 'zodiac')
    AND content NOT LIKE '[Inbound%'
  );

