-- 0003 — SECURITY S3: users may edit their own profile but NOT self-grant is_admin.
-- Prior policy had USING but no WITH CHECK, leaving is_admin self-writable.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND is_admin = (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()));
