DROP POLICY IF EXISTS "Public reads active showcase of active establishments" ON public.establishment_showcase;

CREATE POLICY "Public reads enabled establishment showcase"
  ON public.establishment_showcase
  FOR SELECT
  TO public
  USING (
    (scheduled_for IS NULL OR scheduled_for <= now())
    AND EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_id
        AND e.is_showcase_enabled = true
    )
  );