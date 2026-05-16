-- ════════════════════════════════════════════════════════════════════════════
-- MedBoard Pro — Priority 1 Schema Migration
-- Adds anti-cueing tracking columns to the mcqs table.
-- Run this in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.mcqs
  ADD COLUMN IF NOT EXISTS cueing_flag       BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cueing_notes      TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cueing_checked_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.mcqs.cueing_flag IS
  'NULL = not yet checked. FALSE = passed anti-cueing validator. TRUE = flagged for human review.';

-- Partial index — only NULL and TRUE rows (items needing attention) are indexed.
CREATE INDEX IF NOT EXISTS idx_mcqs_cueing_flag
  ON public.mcqs (cueing_flag)
  WHERE cueing_flag IS NOT FALSE;
