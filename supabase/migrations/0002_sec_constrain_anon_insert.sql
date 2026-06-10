-- 0002 — SECURITY S2: a client INSERT can never create a servable row.
-- Replace unconstrained insert policies with one pinning status to pending_review.
-- NOTE: WITH CHECK sees the NEW row BEFORE column defaults, so status may be NULL
-- when omitted (the live generate-mcq fallback omits it) -> allow NULL or pending.
DROP POLICY IF EXISTS "allow_anon_insert" ON public.mcqs;
DROP POLICY IF EXISTS "Anyone can insert MCQs (defaults to pending_review)" ON public.mcqs;
CREATE POLICY "Client inserts are pending_review only" ON public.mcqs FOR INSERT TO public
  WITH CHECK ((status IS NULL OR status = 'pending_review') AND (cueing_flag IS NULL OR cueing_flag = true));
