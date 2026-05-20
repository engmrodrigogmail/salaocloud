
-- 1) Add is_retroactive flag to tabs
ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS is_retroactive boolean NOT NULL DEFAULT false;

-- 2) Update close_tab_atomic to accept optional _closed_at
CREATE OR REPLACE FUNCTION public.close_tab_atomic(
  _tab_id uuid,
  _payments jsonb,
  _commissions jsonb DEFAULT '[]'::jsonb,
  _flags jsonb DEFAULT '{}'::jsonb,
  _closed_at timestamptz DEFAULT NULL
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
  IF _tab.status <> 'open' THEN
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
        SELECT 1
        FROM public.professional_commissions pc
        WHERE pc.tab_id = _tab_id
          AND pc.tab_item_id = ti.id
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
         commission_discount_on_manual = COALESCE((_flags->>'commission_discount_on_manual')::boolean, commission_discount_on_manual),
         commission_discount_on_coupon = COALESCE((_flags->>'commission_discount_on_coupon')::boolean, commission_discount_on_coupon),
         commission_discount_on_loyalty = COALESCE((_flags->>'commission_discount_on_loyalty')::boolean, commission_discount_on_loyalty),
         updated_at = now()
   WHERE id = _tab_id;

  IF _tab.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
       SET status = 'completed',
           updated_at = now()
     WHERE id = _tab.appointment_id
       AND status = 'in_service';
  END IF;

  IF _tab.coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_usage (coupon_id, client_id, appointment_id, tab_id)
    VALUES (_tab.coupon_id, _tab.client_id, _tab.appointment_id, _tab_id)
    ON CONFLICT (coupon_id, tab_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'tab_id', _tab_id);
END;
$function$;
