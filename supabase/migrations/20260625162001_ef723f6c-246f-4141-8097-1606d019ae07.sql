
-- 1) platform_coupons: campos para trial e features
ALTER TABLE public.platform_coupons
  ADD COLUMN IF NOT EXISTS grants_trial_days INTEGER,
  ADD COLUMN IF NOT EXISTS feature_mode TEXT NOT NULL DEFAULT 'all'
    CHECK (feature_mode IN ('all','all_except_edu','only_listed'));

-- 2) establishments: rastreamento do trial via cupom
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS trial_coupon_id UUID REFERENCES public.platform_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trial_features_allowed TEXT NOT NULL DEFAULT 'all'
    CHECK (trial_features_allowed IN ('all','all_except_edu','only_listed'));

-- 3) edu_packages
CREATE TABLE IF NOT EXISTS public.edu_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  consultations_count INTEGER NOT NULL CHECK (consultations_count > 0),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.edu_packages TO anon, authenticated;
GRANT ALL ON public.edu_packages TO service_role;

ALTER TABLE public.edu_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active edu packages"
  ON public.edu_packages FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin manages edu packages"
  ON public.edu_packages FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER edu_packages_updated_at
  BEFORE UPDATE ON public.edu_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) edu_access_control: contagem mensal + saldo extra
ALTER TABLE public.edu_access_control
  ADD COLUMN IF NOT EXISTS consultations_used_month INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consultations_extra_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS month_reference TEXT;

-- 5) platform_settings: limite mensal do Edu
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS edu_monthly_limit_paid INTEGER NOT NULL DEFAULT 50;

-- 6) Função: estabelecimento ativo?
CREATE OR REPLACE FUNCTION public.is_establishment_active(_establishment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _e RECORD;
BEGIN
  SELECT subscription_plan, trial_ends_at, admin_trial_granted_at, stripe_subscription_id, status
    INTO _e
    FROM public.establishments
   WHERE id = _establishment_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF _e.subscription_plan = 'admin_trial'::subscription_plan THEN RETURN true; END IF;
  IF _e.subscription_plan = 'trial'::subscription_plan THEN
    RETURN _e.trial_ends_at IS NOT NULL AND _e.trial_ends_at > now();
  END IF;
  IF _e.stripe_subscription_id IS NOT NULL THEN RETURN true; END IF;
  IF _e.subscription_plan IN ('pro','basic','professional','premium') THEN
    RETURN COALESCE(_e.status::text, 'active') <> 'suspended';
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_establishment_active(UUID) TO anon, authenticated, service_role;

-- 7) Função: consumir consulta do Edu
CREATE OR REPLACE FUNCTION public.consume_edu_consultation(_establishment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ctrl RECORD;
  _est RECORD;
  _limit INTEGER;
  _current_month TEXT := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  _used INTEGER;
  _extra INTEGER;
BEGIN
  SELECT subscription_plan, trial_features_allowed
    INTO _est FROM public.establishments WHERE id = _establishment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'establishment_not_found');
  END IF;

  IF _est.subscription_plan = 'trial'::subscription_plan
     AND _est.trial_features_allowed = 'all_except_edu' THEN
    RETURN jsonb_build_object('success', false, 'error', 'edu_blocked_during_trial');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.edu_access_control
     WHERE establishment_id = _establishment_id AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'edu_not_enabled');
  END IF;

  SELECT edu_monthly_limit_paid INTO _limit FROM public.platform_settings LIMIT 1;
  _limit := COALESCE(_limit, 50);

  SELECT * INTO _ctrl FROM public.edu_access_control
   WHERE establishment_id = _establishment_id FOR UPDATE;

  -- reset mensal
  IF _ctrl.month_reference IS DISTINCT FROM _current_month THEN
    UPDATE public.edu_access_control
       SET consultations_used_month = 0,
           month_reference = _current_month,
           updated_at = now()
     WHERE id = _ctrl.id;
    _ctrl.consultations_used_month := 0;
  END IF;

  _used := COALESCE(_ctrl.consultations_used_month, 0);
  _extra := COALESCE(_ctrl.consultations_extra_balance, 0);

  IF _used < _limit THEN
    UPDATE public.edu_access_control
       SET consultations_used_month = _used + 1,
           month_reference = _current_month,
           updated_at = now()
     WHERE id = _ctrl.id;
    RETURN jsonb_build_object('success', true, 'source', 'monthly',
      'used', _used + 1, 'limit', _limit, 'extra_balance', _extra);
  ELSIF _extra > 0 THEN
    UPDATE public.edu_access_control
       SET consultations_extra_balance = _extra - 1,
           updated_at = now()
     WHERE id = _ctrl.id;
    RETURN jsonb_build_object('success', true, 'source', 'extra',
      'used', _used, 'limit', _limit, 'extra_balance', _extra - 1);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'no_balance',
    'used', _used, 'limit', _limit, 'extra_balance', _extra);
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_edu_consultation(UUID) TO authenticated, service_role;

-- 8) Cupom CLOUD7DE
INSERT INTO public.platform_coupons (
  code, name, description, discount_type, discount_value,
  applies_to, applicable_plans, applicable_features, feature_mode,
  grants_trial_days, max_redemptions, min_months,
  valid_from, valid_until, is_active
) VALUES (
  'CLOUD7DE',
  '7 dias de experiência',
  '7 dias de período de experiência com acesso a todas as funcionalidades e restrito a consultas ao Edu',
  'percentage', 100,
  'subscription', ARRAY['pro']::text[], ARRAY[]::text[], 'all_except_edu',
  7, NULL, 1,
  '2026-06-25T00:00:00-03:00'::timestamptz,
  '2026-09-25T23:59:59-03:00'::timestamptz,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  applies_to = EXCLUDED.applies_to,
  applicable_plans = EXCLUDED.applicable_plans,
  applicable_features = EXCLUDED.applicable_features,
  feature_mode = EXCLUDED.feature_mode,
  grants_trial_days = EXCLUDED.grants_trial_days,
  max_redemptions = EXCLUDED.max_redemptions,
  min_months = EXCLUDED.min_months,
  valid_from = EXCLUDED.valid_from,
  valid_until = EXCLUDED.valid_until,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 9) Pacote padrão de 10 consultas
INSERT INTO public.edu_packages (name, consultations_count, price, display_order, is_active)
SELECT '10 consultas do Edu', 10, 35.00, 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.edu_packages WHERE consultations_count = 10 AND price = 35.00);

-- 10) Garantir platform_settings tem 1 linha
INSERT INTO public.platform_settings (id) 
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);
