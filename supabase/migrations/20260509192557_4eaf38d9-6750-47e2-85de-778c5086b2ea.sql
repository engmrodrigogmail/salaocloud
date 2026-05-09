
-- ============================================================
-- SISTEMA DE AVALIAÇÕES — FASE 1
-- ============================================================

-- 1) Configurações por salão
CREATE TABLE public.review_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,

  -- Visibilidade / habilitação
  reviews_enabled boolean NOT NULL DEFAULT false,
  show_professional_ratings boolean NOT NULL DEFAULT true,
  show_comments_on_dashboard boolean NOT NULL DEFAULT true,
  show_numeric_rating boolean NOT NULL DEFAULT true,
  google_business_url text,

  -- Recompensa
  reward_enabled boolean NOT NULL DEFAULT false,
  reward_discount_type text NOT NULL DEFAULT 'percentage' CHECK (reward_discount_type IN ('percentage','fixed')),
  reward_discount_value numeric NOT NULL DEFAULT 0 CHECK (reward_discount_value >= 0),
  reward_target text NOT NULL DEFAULT 'total' CHECK (reward_target IN ('total','service','product')),
  reward_target_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  reward_target_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  reward_deduct_from_commission boolean NOT NULL DEFAULT false,
  reward_description text,
  reward_coupon_validity_days integer NOT NULL DEFAULT 30 CHECK (reward_coupon_validity_days > 0),

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage review_settings"
  ON public.review_settings FOR ALL
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Professionals view review_settings"
  ON public.review_settings FOR SELECT
  USING (establishment_id = public.get_professional_establishment_id(auth.uid()));

CREATE POLICY "Super admin all review_settings"
  ON public.review_settings FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Acesso público apenas para campos seguros (precisamos dos settings para a tela do cliente)
-- Faremos via RPC na Fase 2; por enquanto, sem policy pública.

CREATE TRIGGER trg_review_settings_updated_at
  BEFORE UPDATE ON public.review_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) Avaliação por comanda
CREATE TABLE public.tab_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  tab_id uuid NOT NULL UNIQUE REFERENCES public.tabs(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,

  -- Status do ciclo de avaliação
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','expired')),

  -- Cliente -> Salão
  salon_rating smallint CHECK (salon_rating BETWEEN 0 AND 5),
  salon_comment text CHECK (salon_comment IS NULL OR length(salon_comment) <= 500),
  client_submitted_at timestamp with time zone,

  -- Salão -> Cliente
  client_rating smallint CHECK (client_rating BETWEEN 0 AND 5),
  client_comment text CHECK (client_comment IS NULL OR length(client_comment) <= 500),
  salon_submitted_at timestamp with time zone,
  salon_submitted_by uuid,

  -- Recompensa gerada
  reward_coupon_id uuid REFERENCES public.discount_coupons(id) ON DELETE SET NULL,

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_tab_reviews_establishment ON public.tab_reviews(establishment_id, created_at DESC);
CREATE INDEX idx_tab_reviews_client ON public.tab_reviews(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_tab_reviews_pending ON public.tab_reviews(establishment_id) WHERE status = 'pending';

ALTER TABLE public.tab_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage tab_reviews"
  ON public.tab_reviews FOR ALL
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Professionals view tab_reviews"
  ON public.tab_reviews FOR SELECT
  USING (establishment_id = public.get_professional_establishment_id(auth.uid()));

CREATE POLICY "Super admin all tab_reviews"
  ON public.tab_reviews FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_tab_reviews_updated_at
  BEFORE UPDATE ON public.tab_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3) Avaliação por profissional dentro da comanda
CREATE TABLE public.tab_review_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_review_id uuid NOT NULL REFERENCES public.tab_reviews(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  rating smallint CHECK (rating BETWEEN 0 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 500),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (tab_review_id, professional_id)
);

CREATE INDEX idx_tab_review_prof_professional ON public.tab_review_professionals(professional_id);

ALTER TABLE public.tab_review_professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage tab_review_professionals"
  ON public.tab_review_professionals FOR ALL
  USING (tab_review_id IN (
    SELECT id FROM public.tab_reviews
    WHERE establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid())
  ));

CREATE POLICY "Professionals view tab_review_professionals"
  ON public.tab_review_professionals FOR SELECT
  USING (tab_review_id IN (
    SELECT id FROM public.tab_reviews
    WHERE establishment_id = public.get_professional_establishment_id(auth.uid())
  ));

CREATE POLICY "Super admin all tab_review_professionals"
  ON public.tab_review_professionals FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_tab_review_professionals_updated_at
  BEFORE UPDATE ON public.tab_review_professionals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4) Trigger: ao fechar uma comanda, criar avaliação pendente automaticamente
CREATE OR REPLACE FUNCTION public.create_review_on_tab_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _settings RECORD;
  _review_id uuid;
  _slug text;
  _est_name text;
  _msg_title text;
  _msg_body text;
BEGIN
  -- Apenas quando passa para "closed"
  IF NEW.status <> 'closed' OR OLD.status = 'closed' THEN
    RETURN NEW;
  END IF;

  -- Sem cliente vinculado, não há quem avaliar
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verifica configurações
  SELECT * INTO _settings FROM public.review_settings
   WHERE establishment_id = NEW.establishment_id;

  IF NOT FOUND OR NOT _settings.reviews_enabled THEN
    RETURN NEW;
  END IF;

  -- Idempotência: se já existir, não recria
  IF EXISTS (SELECT 1 FROM public.tab_reviews WHERE tab_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tab_reviews (establishment_id, tab_id, client_id, status)
  VALUES (NEW.establishment_id, NEW.id, NEW.client_id, 'pending')
  RETURNING id INTO _review_id;

  -- Pré-popular profissionais que atenderam (distintos)
  INSERT INTO public.tab_review_professionals (tab_review_id, professional_id)
  SELECT _review_id, ti.professional_id
    FROM public.tab_items ti
   WHERE ti.tab_id = NEW.id
     AND ti.professional_id IS NOT NULL
   GROUP BY ti.professional_id;

  -- Notificação ao cliente
  SELECT slug, name INTO _slug, _est_name FROM public.establishments WHERE id = NEW.establishment_id;

  IF _settings.reward_enabled AND COALESCE(_settings.reward_description, '') <> '' THEN
    _msg_title := 'Temos um presente para você 🎁';
    _msg_body := 'Preencha nossa avaliação de satisfação e ganhe ' || _settings.reward_description || '.';
  ELSE
    _msg_title := 'Como foi sua experiência?';
    _msg_body := 'Ficaremos felizes de saber como foi sua experiência conosco em ' || COALESCE(_est_name, 'nosso salão') || ' 😉';
  END IF;

  INSERT INTO public.notifications (
    recipient_type, recipient_id, sender_type, sender_id,
    title, body, link, data
  ) VALUES (
    'client', NEW.client_id,
    'establishment', NEW.establishment_id,
    _msg_title, _msg_body,
    '/' || COALESCE(_slug, '') || '/avaliar/' || _review_id::text,
    jsonb_build_object('category', 'review_request', 'tab_review_id', _review_id, 'tab_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_review_on_tab_close
  AFTER UPDATE OF status ON public.tabs
  FOR EACH ROW
  WHEN (NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed')
  EXECUTE FUNCTION public.create_review_on_tab_close();


-- 5) Inicializa settings (desabilitado) para todos os estabelecimentos existentes
INSERT INTO public.review_settings (establishment_id)
SELECT id FROM public.establishments
ON CONFLICT (establishment_id) DO NOTHING;

-- 6) Trigger para criar settings padrão em novos estabelecimentos
CREATE OR REPLACE FUNCTION public.create_default_review_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.review_settings (establishment_id)
  VALUES (NEW.id)
  ON CONFLICT (establishment_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_review_settings
  AFTER INSERT ON public.establishments
  FOR EACH ROW EXECUTE FUNCTION public.create_default_review_settings();
