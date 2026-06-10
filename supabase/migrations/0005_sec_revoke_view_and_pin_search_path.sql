-- 0005 — SECURITY (advisor ERROR + WARN): v_approved_mcqs is a SECURITY DEFINER
-- view that bypassed RLS and exposed all approved rows (incl. correct_answer) to
-- anon. Revoke client access (keep for admin/service). Pin search_path on the two
-- trigger/auth functions flagged by the linter.
REVOKE ALL ON public.v_approved_mcqs FROM anon;
REVOKE ALL ON public.v_approved_mcqs FROM authenticated;
ALTER FUNCTION public.update_mcqs_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
