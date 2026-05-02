
-- 1. edu_access_control
CREATE TABLE public.edu_access_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edu_access_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin gerencia edu_access_control"
  ON public.edu_access_control FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Dono lê próprio status edu"
  ON public.edu_access_control FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = edu_access_control.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

CREATE TRIGGER trg_edu_access_updated
  BEFORE UPDATE ON public.edu_access_control
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: estabelecimento tem Edu ativo?
CREATE OR REPLACE FUNCTION public.has_edu_access(_establishment_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.edu_access_control
    WHERE establishment_id = _establishment_id AND is_active = true
  )
$$;

-- 2. client_hair_profiles
CREATE TABLE public.client_hair_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_diagnosis jsonb,
  hair_type varchar(20),
  porosity_level varchar(20),
  damage_level varchar(20),
  identified_issues jsonb DEFAULT '[]'::jsonb,
  technical_explanation text,
  confidence_score numeric(5,2),
  is_validated boolean NOT NULL DEFAULT false,
  professional_correction text,
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  photos_purged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chp_establishment ON public.client_hair_profiles(establishment_id);
CREATE INDEX idx_chp_client ON public.client_hair_profiles(client_id);
CREATE INDEX idx_chp_validated ON public.client_hair_profiles(establishment_id, is_validated);

ALTER TABLE public.client_hair_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono lê perfis capilares (Edu ativo)"
  ON public.client_hair_profiles FOR SELECT
  USING (
    public.has_edu_access(establishment_id) AND
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = client_hair_profiles.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Dono cria perfis capilares (Edu ativo)"
  ON public.client_hair_profiles FOR INSERT
  WITH CHECK (
    public.has_edu_access(establishment_id) AND
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = client_hair_profiles.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Dono atualiza perfis capilares (Edu ativo)"
  ON public.client_hair_profiles FOR UPDATE
  USING (
    public.has_edu_access(establishment_id) AND
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = client_hair_profiles.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Dono apaga perfis capilares (Edu ativo)"
  ON public.client_hair_profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = client_hair_profiles.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Super admin lê todos perfis capilares"
  ON public.client_hair_profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_chp_updated
  BEFORE UPDATE ON public.client_hair_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. salon_learning_patterns
CREATE TABLE public.salon_learning_patterns (
  establishment_id uuid PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  hair_type_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  common_damage_patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_accuracy numeric(5,2) DEFAULT 0,
  total_analyses integer NOT NULL DEFAULT 0,
  total_validated integer NOT NULL DEFAULT 0,
  total_corrected integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salon_learning_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono lê padrões do próprio salão"
  ON public.salon_learning_patterns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = salon_learning_patterns.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Super admin lê todos padrões"
  ON public.salon_learning_patterns FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Service role faz updates (via edge function)
CREATE POLICY "Service role gerencia padrões"
  ON public.salon_learning_patterns FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. Storage bucket temp-analysis (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('temp-analysis', 'temp-analysis', false)
ON CONFLICT (id) DO NOTHING;

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

CREATE POLICY "Service role acessa fotos do Edu"
  ON storage.objects FOR ALL
  USING (bucket_id = 'temp-analysis' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'temp-analysis' AND auth.role() = 'service_role');
