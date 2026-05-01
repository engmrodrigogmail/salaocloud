-- 1) Coluna primeiro
ALTER TABLE public.establishments
  ADD COLUMN is_showcase_enabled BOOLEAN NOT NULL DEFAULT true;

-- 2) Tabela showcase
CREATE TABLE public.establishment_showcase (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  caption VARCHAR(500),
  order_index INTEGER NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_showcase_establishment ON public.establishment_showcase(establishment_id, order_index);

ALTER TABLE public.establishment_showcase ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own showcase"
  ON public.establishment_showcase
  FOR ALL
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Public reads active showcase of active establishments"
  ON public.establishment_showcase
  FOR SELECT
  USING (
    (scheduled_for IS NULL OR scheduled_for <= now())
    AND establishment_id IN (
      SELECT id FROM public.establishments
       WHERE status = 'active'::establishment_status
         AND is_showcase_enabled = true
    )
  );

CREATE POLICY "Super admins manage all showcase"
  ON public.establishment_showcase
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_showcase_updated_at
  BEFORE UPDATE ON public.establishment_showcase
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('showcase-images', 'showcase-images', true)
ON CONFLICT (id) DO NOTHING;

-- 4) Storage policies
CREATE POLICY "Public read showcase images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'showcase-images');

CREATE POLICY "Owners upload to own showcase folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'showcase-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.establishments WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners update own showcase files"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'showcase-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.establishments WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners delete own showcase files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'showcase-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.establishments WHERE owner_id = auth.uid()
    )
  );