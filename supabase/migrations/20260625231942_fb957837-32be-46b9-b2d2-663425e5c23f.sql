
ALTER TABLE public.platform_coupons
  ADD COLUMN IF NOT EXISTS trial_edu_quota INTEGER;

COMMENT ON COLUMN public.platform_coupons.trial_edu_quota IS
  'Limite total de consultas Edu permitidas durante todo o período de trial concedido por este cupom. NULL = usa o limite mensal padrão do plano.';

CREATE OR REPLACE FUNCTION public.consume_edu_consultation(_establishment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ctrl RECORD;
  _est RECORD;
  _limit INTEGER;
  _current_month TEXT := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  _used INTEGER;
  _extra INTEGER;
  _trial_quota INTEGER;
BEGIN
  SELECT subscription_plan, trial_features_allowed, trial_coupon_id
    INTO _est FROM public.establishments WHERE id = _establishment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'establishment_not_found');
  END IF;

  -- Bloqueio total de Edu em trial restrito
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

  SELECT * INTO _ctrl FROM public.edu_access_control
   WHERE establishment_id = _establishment_id FOR UPDATE;

  -- Caso especial: trial com cota específica de Edu
  IF _est.subscription_plan = 'trial'::subscription_plan AND _est.trial_coupon_id IS NOT NULL THEN
    SELECT trial_edu_quota INTO _trial_quota
      FROM public.platform_coupons WHERE id = _est.trial_coupon_id;

    IF _trial_quota IS NOT NULL THEN
      _used := COALESCE(_ctrl.consultations_used_month, 0);
      IF _used >= _trial_quota THEN
        RETURN jsonb_build_object('success', false, 'error', 'trial_quota_exhausted',
          'used', _used, 'limit', _trial_quota);
      END IF;
      UPDATE public.edu_access_control
         SET consultations_used_month = _used + 1,
             month_reference = 'trial',
             updated_at = now()
       WHERE id = _ctrl.id;
      RETURN jsonb_build_object('success', true, 'source', 'trial',
        'used', _used + 1, 'limit', _trial_quota);
    END IF;
  END IF;

  SELECT edu_monthly_limit_paid INTO _limit FROM public.platform_settings LIMIT 1;
  _limit := COALESCE(_limit, 50);

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
$function$;

-- Atualiza CLOUD7DE conforme nova regra: trial libera tudo, com 3 consultas Edu
UPDATE public.platform_coupons
   SET feature_mode = 'all',
       trial_edu_quota = 3,
       description = '7 dias de período de experiência com acesso a todas as funcionalidades, limitado a 3 consultas ao Edu durante o período',
       updated_at = now()
 WHERE code = 'CLOUD7DE';

-- Limpa bandeira de trial restrito em estabelecimentos que já resgataram CLOUD7DE (caso existam)
UPDATE public.establishments e
   SET trial_features_allowed = 'all'
  FROM public.platform_coupons pc
 WHERE e.trial_coupon_id = pc.id
   AND pc.code = 'CLOUD7DE'
   AND e.trial_features_allowed = 'all_except_edu';
