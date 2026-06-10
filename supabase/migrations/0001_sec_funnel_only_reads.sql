-- 0001 — SECURITY S1: funnel-only reads. Clients read mcqs ONLY via serve_next_mcq.
-- serve_next_mcq -> SECURITY DEFINER (fixed search_path) so it reads after client
-- SELECT is removed; drop the blanket anon SELECT (USING true) that exposed every
-- row incl. correct_answer; restrict any direct table read to admins.
CREATE OR REPLACE FUNCTION public.serve_next_mcq(p_exam_level text, p_topic text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, exam_level text, blueprint_tag text, stem text, choices jsonb, correct_answer text, explanation text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT m.id, m.exam_level, m.blueprint_tag, m.stem, m.choices, m.correct_answer, m.explanation
  FROM public.mcqs m
  WHERE m.status = 'approved' AND (m.cueing_flag IS NOT TRUE) AND m.exam_level = p_exam_level
    AND (p_topic IS NULL OR p_topic LIKE 'Random%' OR m.blueprint_tag = p_topic)
    AND (p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_responses ur WHERE ur.user_id = p_user_id AND ur.mcq_id = m.id))
  ORDER BY RANDOM() LIMIT 1;
END;
$function$;
DROP POLICY IF EXISTS "allow_anon_select" ON public.mcqs;
DROP POLICY IF EXISTS "Read approved, own-answered, or all-if-admin" ON public.mcqs;
CREATE POLICY "Admins can read mcqs directly" ON public.mcqs FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
