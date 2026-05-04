-- 1. Storage policies (temp-analysis)
DROP POLICY IF EXISTS "Dono faz upload de fotos do Edu" ON storage.objects;
DROP POLICY IF EXISTS "Dono lê fotos do Edu" ON storage.objects;
DROP POLICY IF EXISTS "Dono apaga fotos do Edu" ON storage.objects;

CREATE POLICY "Dono faz upload de fotos do Edu"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'temp-analysis'
    AND EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id::text = (storage.foldername(name))[1]
        AND e.owner_id = auth.uid()
        AND public.has_edu_access(e.id)
    )
  );

CREATE POLICY "Dono lê fotos do Edu"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'temp-analysis'
    AND EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id::text = (storage.foldername(name))[1]
        AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Dono apaga fotos do Edu"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'temp-analysis'
    AND EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id::text = (storage.foldername(name))[1]
        AND e.owner_id = auth.uid()
    )
  );

-- 2. client_hair_profiles policy for service role
DROP POLICY IF EXISTS "Service role gerencia perfis capilares" ON public.client_hair_profiles;

CREATE POLICY "Service role gerencia perfis capilares"
  ON public.client_hair_profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');