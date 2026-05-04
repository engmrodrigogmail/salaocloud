-- Simplificar políticas do bucket temp-analysis (segurança real é na Edge Function)
DROP POLICY IF EXISTS "Dono faz upload de fotos do Edu" ON storage.objects;
DROP POLICY IF EXISTS "Dono ve fotos do Edu" ON storage.objects;
DROP POLICY IF EXISTS "Dono deleta fotos do Edu" ON storage.objects;

CREATE POLICY "Dono faz upload de fotos do Edu"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'temp-analysis'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Dono ve fotos do Edu"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'temp-analysis'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Dono deleta fotos do Edu"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'temp-analysis'
    AND auth.role() = 'authenticated'
  );