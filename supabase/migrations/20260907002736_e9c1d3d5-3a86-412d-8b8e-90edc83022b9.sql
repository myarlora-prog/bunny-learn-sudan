CREATE POLICY "books admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'curriculum-books' AND public.is_admin());
CREATE POLICY "books admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'curriculum-books' AND public.is_admin());
CREATE POLICY "books admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'curriculum-books' AND public.is_admin()) WITH CHECK (bucket_id = 'curriculum-books' AND public.is_admin());
CREATE POLICY "books admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'curriculum-books' AND public.is_admin());