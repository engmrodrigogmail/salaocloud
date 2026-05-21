-- 1) Permissão por profissional para fechar comanda
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS can_close_tabs boolean NOT NULL DEFAULT true;

-- 2) Colunas para o estado "congelada / aguardando fechamento"
ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_by uuid;

-- 3) Atualiza close_tab_atomic: aceita comandas 'open' OU 'awaiting_closure'
CREATE OR REPLACE FUNCTION public.close_tab_atomic(
  _tab_id uuid,
  _payments jsonb,
  _commissions jsonb DEFAULT '[]'::jsonb,
  _flags jsonb DEFAULT '{}'::jsonb,
  _closed_at timestamp with time zone DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tab RECORD;
  _sum_payments numeric := 0;
  _payment jsonb;
  _commission jsonb;
  _fallback_item RECORD;
  _fallback_rule_id uuid := NULL;
  _fallback_rule_name text := NULL;
  _fallback_rule_type text := NULL;
  _fallback_rule_value numeric := 0;
  _reference_value numeric := 0;
  _commission_amount numeric := 0;
  _description text;
  _ts timestamptz := COALESCE(_closed_at, now());
BEGIN
  SELECT * INTO _tab FROM public.tabs WHERE id = _tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comanda não encontrada');
  END IF;
  IF _tab.status NOT IN ('open','awaiting_closure') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comanda não está aberta');
  END IF;

  FOR _payment IN SELECT * FROM jsonb_array_elements(_payments) LOOP
    _sum_payments := _sum_payments + COALESCE((_payment->>'amount')::numeric, 0);
  END LOOP;

  IF abs(_sum_payments - _tab.total) > 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Soma dos pagamentos diverge do total da comanda',
      'sum_payments', _sum_payments,
      'total', _tab.total
    );
  END IF;

  FOR _payment IN SELECT * FROM jsonb_array_elements(_payments) LOOP
    INSERT INTO public.tab_payments (
      tab_id, payment_method_id, payment_method_name, amount,
      installments, has_interest, interest_amount, notes, created_at
    ) VALUES (
      _tab_id,
      NULLIF(_payment->>'payment_method_id','')::uuid,
      _payment->>'payment_method_name',
      (_payment->>'amount')::numeric,
      COALESCE((_payment->>'installments')::int, 1),
      COALESCE((_payment->>'has_interest')::boolean, false),
      COALESCE((_payment->>'interest_amount')::numeric, 0),
      _payment->>'notes',
      _ts
    );
  END LOOP;

  IF _commissions IS NOT NULL AND jsonb_array_length(_commissions) > 0 THEN
    FOR _commission IN SELECT * FROM jsonb_array_elements(_commissions) LOOP
      INSERT INTO public.professional_commissions (
        establishment_id, professional_id, tab_id, tab_item_id,
        commission_rule_id, reference_value, commission_amount,
        description, status, created_at
      ) VALUES (
        _tab.establishment_id,
        (_commission->>'professional_id')::uuid,
        _tab_id,
        NULLIF(_commission->>'tab_item_id','')::uuid,
        NULLIF(_commission->>'commission_rule_id','')::uuid,
        COALESCE((_commission->>'reference_value')::numeric, 0),
        COALESCE((_commission->>'commission_amount')::numeric, 0),
        _commission->>'description',
        COALESCE(_commission->>'status', 'pending'),
        _ts
      );
    END LOOP;
  END IF;

  FOR _fallback_item IN
    SELECT ti.id, ti.name, ti.service_id, ti.product_id, ti.professional_id, ti.total_price
    FROM public.tab_items ti
    WHERE ti.tab_id = _tab_id
      AND ti.professional_id IS NOT NULL
      AND ti.item_type IN ('service', 'product')
      AND NOT EXISTS (
        SELECT 1 FROM public.professional_commissions pc
        WHERE pc.tab_id = _tab_id AND pc.tab_item_id = ti.id
      )
  LOOP
    _reference_value := COALESCE(_fallback_item.total_price, 0);
    _commission_amount := 0;
    _description := NULL;
    _fallback_rule_id := NULL;
    _fallback_rule_name := NULL;
    _fallback_rule_type := NULL;
    _fallback_rule_value := 0;

    IF _fallback_item.service_id IS NOT NULL THEN
      SELECT
        CASE ps.commission_type
          WHEN 'fixed' THEN ps.commission_value
          ELSE (_reference_value * ps.commission_value) / 100
        END,
        concat(_fallback_item.name, ' (comissão específica)')
      INTO _commission_amount, _description
      FROM public.professional_services ps
      WHERE ps.professional_id = _fallback_item.professional_id
        AND ps.service_id = _fallback_item.service_id
        AND ps.commission_value > 0
      LIMIT 1;
    END IF;

    IF COALESCE(_commission_amount, 0) <= 0 THEN
      SELECT cr.id, cr.name, cr.commission_type, cr.commission_value
      INTO _fallback_rule_id, _fallback_rule_name, _fallback_rule_type, _fallback_rule_value
      FROM public.commission_rules cr
      WHERE cr.establishment_id = _tab.establishment_id
        AND cr.is_active = true
        AND cr.is_challenge = false
        AND (
          (_fallback_item.service_id IS NOT NULL AND cr.applies_to IN ('specific_services', 'specific_mixed') AND _fallback_item.service_id = ANY(cr.applicable_service_ids))
          OR (_fallback_item.product_id IS NOT NULL AND cr.applies_to IN ('specific_products', 'specific_mixed') AND _fallback_item.product_id = ANY(cr.applicable_product_ids))
          OR (_fallback_item.service_id IS NOT NULL AND cr.applies_to IN ('own_services', 'all_services'))
          OR (_fallback_item.product_id IS NOT NULL AND cr.applies_to = 'products')
        )
      ORDER BY
        CASE
          WHEN cr.applies_to IN ('specific_services', 'specific_products', 'specific_mixed') THEN 1
          WHEN cr.applies_to = 'own_services' THEN 2
          WHEN cr.applies_to = 'all_services' THEN 3
          WHEN cr.applies_to = 'products' THEN 4
          ELSE 9
        END,
        cr.created_at ASC
      LIMIT 1;

      IF _fallback_rule_id IS NOT NULL THEN
        _commission_amount := CASE _fallback_rule_type
          WHEN 'fixed' THEN _fallback_rule_value
          ELSE (_reference_value * _fallback_rule_value) / 100
        END;
        _description := concat(_fallback_item.name, ' (', _fallback_rule_name, ')');
      END IF;
    END IF;

    IF COALESCE(_commission_amount, 0) > 0 THEN
      INSERT INTO public.professional_commissions (
        establishment_id, professional_id, tab_id, tab_item_id,
        commission_rule_id, reference_value, commission_amount,
        description, status, created_at
      ) VALUES (
        _tab.establishment_id,
        _fallback_item.professional_id,
        _tab_id,
        _fallback_item.id,
        _fallback_rule_id,
        _reference_value,
        round(_commission_amount, 2),
        _description,
        'pending',
        _ts
      );
    END IF;
  END LOOP;

  UPDATE public.tabs
     SET status = 'closed',
         closed_at = _ts,
         closed_by = auth.uid(),
         frozen_at = NULL,
         frozen_by = NULL,
         commission_discount_on_manual = COALESCE((_flags->>'commission_discount_on_manual')::boolean, commission_discount_on_manual),
         commission_discount_on_coupon = COALESCE((_flags->>'commission_discount_on_coupon')::boolean, commission_discount_on_coupon),
         commission_discount_on_loyalty = COALESCE((_flags->>'commission_discount_on_loyalty')::boolean, commission_discount_on_loyalty),
         updated_at = now()
   WHERE id = _tab_id;

  IF _tab.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
       SET status = 'completed', updated_at = now()
     WHERE id = _tab.appointment_id AND status = 'in_service';
  END IF;

  IF _tab.coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_usage (coupon_id, client_id, appointment_id, tab_id)
    VALUES (_tab.coupon_id, _tab.client_id, _tab.appointment_id, _tab_id)
    ON CONFLICT (coupon_id, tab_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'tab_id', _tab_id);
END;
$function$;

-- 4) Congelar comanda (profissional sem permissão de fechar)
CREATE OR REPLACE FUNCTION public.freeze_tab(_tab_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tab RECORD;
  _est RECORD;
  _actor_name text;
  _prof RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO _tab FROM public.tabs WHERE id = _tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comanda não encontrada');
  END IF;
  IF _tab.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas comandas abertas podem ser congeladas');
  END IF;

  SELECT id, owner_id, slug, name INTO _est FROM public.establishments WHERE id = _tab.establishment_id;

  SELECT id, name INTO _prof
    FROM public.professionals
   WHERE establishment_id = _est.id AND user_id = auth.uid()
   LIMIT 1;
  _actor_name := COALESCE(_prof.name, 'Profissional');

  UPDATE public.tabs
     SET status = 'awaiting_closure',
         frozen_at = now(),
         frozen_by = auth.uid(),
         updated_at = now()
   WHERE id = _tab_id;

  -- Notificar dono
  INSERT INTO public.notifications (
    recipient_type, recipient_id, sender_type, title, body, link, data
  ) VALUES (
    'establishment', _est.id, 'system',
    'Comanda aguardando fechamento',
    _actor_name || ' encerrou o atendimento de ' || _tab.client_name ||
      ' e a comanda está aguardando fechamento e recebimento.',
    '/interno/' || _est.slug || '/comandas',
    jsonb_build_object('category','tab_awaiting_closure','tab_id', _tab_id)
  );

  -- Notificar gerentes + profissionais habilitados (exceto quem congelou)
  INSERT INTO public.notifications (
    recipient_type, recipient_id, sender_type, title, body, link, data
  )
  SELECT 'professional', p.id, 'system',
         'Comanda aguardando fechamento',
         _actor_name || ' encerrou o atendimento de ' || _tab.client_name ||
           ' e a comanda está aguardando fechamento e recebimento.',
         '/interno/' || _est.slug || '/comandas',
         jsonb_build_object('category','tab_awaiting_closure','tab_id', _tab_id)
    FROM public.professionals p
   WHERE p.establishment_id = _est.id
     AND p.is_active = true
     AND (p.is_manager = true OR p.can_close_tabs = true)
     AND (p.user_id IS NULL OR p.user_id <> auth.uid());

  RETURN jsonb_build_object('success', true, 'tab_id', _tab_id);
END;
$function$;

-- 5) Reabrir comanda congelada (volta para 'open')
CREATE OR REPLACE FUNCTION public.unfreeze_tab(_tab_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tab RECORD;
  _est RECORD;
  _is_owner boolean := false;
  _is_manager boolean := false;
  _is_freezer boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO _tab FROM public.tabs WHERE id = _tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comanda não encontrada');
  END IF;
  IF _tab.status <> 'awaiting_closure' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comanda não está aguardando fechamento');
  END IF;

  SELECT id, owner_id, slug INTO _est FROM public.establishments WHERE id = _tab.establishment_id;
  _is_owner := (_est.owner_id = auth.uid());
  _is_freezer := (_tab.frozen_by = auth.uid());
  IF NOT _is_owner THEN
    SELECT EXISTS (
      SELECT 1 FROM public.professionals
       WHERE establishment_id = _est.id
         AND user_id = auth.uid()
         AND is_active = true
         AND is_manager = true
    ) INTO _is_manager;
  END IF;

  IF NOT (_is_owner OR _is_manager OR _is_freezer) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE public.tabs
     SET status = 'open',
         frozen_at = NULL,
         frozen_by = NULL,
         updated_at = now()
   WHERE id = _tab_id;

  RETURN jsonb_build_object('success', true, 'tab_id', _tab_id);
END;
$function$;