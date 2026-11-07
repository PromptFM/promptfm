-- supabase/migrations/20261106_add_content_reports_audit_metadata.sql
-- Migration: Add audit and actor metadata columns to public.content_reports
-- Ensures accountability for moderation decisions (actioned/dismissed) and guards against unattributed changes.

ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS resolved_by TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.content_reports.resolved_by IS 'Admin user ID, email, or actor name who actioned or dismissed the report.';
COMMENT ON COLUMN public.content_reports.resolved_at IS 'Timestamp when the moderation action was taken.';
COMMENT ON COLUMN public.content_reports.notes IS 'Moderator explanation, takedown notice reference, or resolution notes.';
