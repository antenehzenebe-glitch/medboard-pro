-- 0004 — SECURITY S4 + S6: add cueing gate + fixed search_path to fetch_unseen_mcqs;
-- revoke gratuitous write/DDL grants from anon/authenticated on mcqs + user_responses.
CREATE OR REPLACE FUNCTION public.fetch_unseen_mcqs(p_exam_level text, p_specialty_group text DEFAULT NULL::text, p_limit integer DEFAULT 20)
 RETURNS SETOF mcqs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT m.* FROM mcqs m
  WHERE m.status = 'approved' AND (m.cueing_flag IS NOT TRUE) AND m.exam_level = p_exam_level
    AND (p_specialty_group IS NULL OR m.specialty_group = p_specialty_group)
    AND NOT EXISTS (SELECT 1 FROM user_responses ur WHERE ur.user_id = auth.uid() AND ur.mcq_id = m.id)
  ORDER BY random() LIMIT p_limit;
END;
$function$;
REVOKE TRUNCATE, DELETE, UPDATE, REFERENCES, TRIGGER ON public.mcqs FROM anon;
REVOKE TRUNCATE, DELETE, UPDATE, REFERENCES, TRIGGER ON public.mcqs FROM authenticated;
REVOKE TRUNCATE, DELETE, UPDATE, REFERENCES, TRIGGER ON public.user_responses FROM anon;
REVOKE TRUNCATE, DELETE, REFERENCES, TRIGGER ON public.user_responses FROM authenticated;
