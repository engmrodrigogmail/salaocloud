CREATE OR REPLACE FUNCTION public.recalculate_tab_commissions(_tab_id uuid, _created_at timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tab RECORD;
  _item RECORD;
  _coupon_target text := 'total';
  _coupon_service_ids uuid[] := '{}'::uuid[];
  _coupon_product_ids uuid[] := '{}'::uuid[];
  _total_discount numeric := 0;
  _reduces_by_type boolean := false;
  _eligible_base numeric := 0;
  _full_price numeric := 0;
  _reference_value numeric := 0;
  _commission_amount numeric := 0;
  _commission_type text := NULL;
  _commission_value numeric := 0;
  _description text := NULL;
  _rule_id uuid := NULL;
  _rule_name text := NULL;
  _in_scope boolean := true;
  _inserted integer := 0;
  _bucket RECORD;
  _diff numeric;
  _target_id uuid;
  _waterfall_remaining numeric := 0;
  _waterfall_take numeric := 0;
  _use_waterfall boolean := false;
  _waterfall_amounts jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO _tab FROM public.tabs WHERE id = _tab_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.professional_commissions
    WHERE tab_id = _tab_id AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'paid_commission_exists' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.professional_commissions
  WHERE tab_id = _tab_id AND status <> 'paid';

  _total_discount := COALESCE(_tab.discount_amount, 0);
  _reduces_by_type := CASE
    WHEN _total_discount <= 0 THEN false
    WHEN _tab.discount_type = 'manual' THEN COALESCE(_tab.commission_discount_on_manual, false)
    WHEN _tab.discount_type = 'coupon' THEN COALESCE(_tab.commission_discount_on_coupon, false)
    WHEN _tab.discount_type = 'loyalty' THEN COALESCE(_tab.commission_discount_on_loyalty, false)
    ELSE COALESCE(_tab.commission_discount_on_manual, false)
      OR COALESCE(_tab.commission_discount_on_coupon, false)
      OR COALESCE(_tab.commission_discount_on_loyalty, false)
  END;

  IF _tab.discount_type = 'coupon' AND _tab.coupon_id IS NOT NULL THEN
    SELECT
      COALESCE(discount_target, 'total'),
      COALESCE(applicable_service_ids, '{}'::uuid[]),
      COALESCE(applicable_product_ids, '{}'::uuid[])
    INTO _coupon_target, _coupon_service_ids, _coupon_product_ids
    FROM public.discount_coupons
    WHERE id = _tab.coupon_id;
  END IF;

  -- Decide if we use waterfall (manual discount, no per-item ids, no per-item amounts)
  _use_waterfall := _reduces_by_type
    AND _total_discount > 0
    AND _tab.discount_type = 'manual'
    AND (_tab.manual_discount_item_amounts IS NULL OR jsonb_typeof(_tab.manual_discount_item_amounts) <> 'object')
    AND (_tab.manual_discount_item_ids IS NULL OR cardinality(_tab.manual_discount_item_ids) = 0);

  -- Build waterfall map: subtract discount starting from highest-priced item until exhausted
  IF _use_waterfall THEN
    _waterfall_remaining := _total_discount;
    FOR _item IN
      SELECT ti.id, ti.total_price
      FROM public.tab_items ti
      WHERE ti.tab_id = _tab_id
        AND ti.professional_id IS NOT NULL
        AND ti.item_type IN ('service', 'product')
      ORDER BY ti.total_price DESC, ti.created_at ASC, ti.id
    LOOP
      EXIT WHEN _waterfall_remaining <= 0;
      _waterfall_take := LEAST(_waterfall_remaining, COALESCE(_item.total_price, 0));
      IF _waterfall_take > 0 THEN
        _waterfall_amounts := _waterfall_amounts || jsonb_build_object(_item.id::text, _waterfall_take);
        _waterfall_remaining := _waterfall_remaining - _waterfall_take;
      END IF;
    END LOOP;
  END IF;

  SELECT COALESCE(sum(ti.total_price), 0) INTO _eligible_base
  FROM public.tab_items ti
  WHERE ti.tab_id = _tab_id
    AND (
      NOT _reduces_by_type
      OR _tab.discount_type IS DISTINCT FROM 'manual'
      OR _tab.manual_discount_item_amounts IS NOT NULL
      OR _tab.manual_discount_item_ids IS NULL
      OR cardinality(_tab.manual_discount_item_ids) = 0
      OR ti.id = ANY(_tab.manual_discount_item_ids)
    )
    AND (
      _tab.discount_type IS DISTINCT FROM 'coupon'
      OR _coupon_target = 'total'
      OR (_coupon_target = 'services'
          AND ti.service_id IS NOT NULL
          AND (cardinality(_coupon_service_ids) = 0 OR ti.service_id = ANY(_coupon_service_ids)))
      OR (_coupon_target = 'products'
          AND ti.product_id IS NOT NULL
          AND (cardinality(_coupon_product_ids) = 0 OR ti.product_id = ANY(_coupon_product_ids)))
    );

  CREATE TEMP TABLE IF NOT EXISTS _stage_comm (
    id uuid PRIMARY KEY,
    professional_id uuid,
    rule_key uuid,
    raw_amount numeric
  ) ON COMMIT DROP;
  DELETE FROM _stage_comm WHERE true;

  FOR _item IN
    SELECT ti.id, ti.name, ti.service_id, ti.product_id, ti.professional_id, ti.total_price
    FROM public.tab_items ti
    WHERE ti.tab_id = _tab_id
      AND ti.professional_id IS NOT NULL
      AND ti.item_type IN ('service', 'product')
    ORDER BY ti.created_at, ti.id
  LOOP
    _full_price := COALESCE(_item.total_price, 0);
    _reference_value := _full_price;
    _commission_amount := 0;
    _commission_type := NULL;
    _commission_value := 0;
    _description := NULL;
    _rule_id := NULL;
    _rule_name := NULL;
    _in_scope := true;

    IF _reduces_by_type AND _total_discount > 0 THEN
      IF _use_waterfall THEN
        -- Apply waterfall: subtract only the share assigned to this item (0 if not touched)
        _reference_value := GREATEST(0, _full_price - COALESCE((_waterfall_amounts ->> _item.id::text)::numeric, 0));
      ELSIF _tab.discount_type = 'manual'
         AND _tab.manual_discount_item_amounts IS NOT NULL
         AND jsonb_typeof(_tab.manual_discount_item_amounts) = 'object' THEN
        IF _tab.manual_discount_item_amounts ? _item.id::text THEN
          _reference_value := GREATEST(0, _full_price - COALESCE((_tab.manual_discount_item_amounts ->> _item.id::text)::numeric, 0));
        END IF;
      ELSE
        IF _tab.discount_type = 'manual'
           AND _tab.manual_discount_item_ids IS NOT NULL
           AND cardinality(_tab.manual_discount_item_ids) > 0 THEN
          _in_scope := _item.id = ANY(_tab.manual_discount_item_ids);
        ELSIF _tab.discount_type = 'coupon' THEN
          _in_scope := _coupon_target = 'total'
            OR (_coupon_target = 'services'
                AND _item.service_id IS NOT NULL
                AND (cardinality(_coupon_service_ids) = 0 OR _item.service_id = ANY(_coupon_service_ids)))
            OR (_coupon_target = 'products'
                AND _item.product_id IS NOT NULL
                AND (cardinality(_coupon_product_ids) = 0 OR _item.product_id = ANY(_coupon_product_ids)));
        END IF;

        IF _in_scope AND _eligible_base > 0 THEN
          _reference_value := GREATEST(0, _full_price * (1 - LEAST(_total_discount, _eligible_base) / _eligible_base));
        END IF;
      END IF;
    END IF;

    _reference_value := round(_reference_value, 2);

    IF _item.service_id IS NOT NULL THEN
      SELECT ps.commission_type, ps.commission_value
      INTO _commission_type, _commission_value
      FROM public.professional_services ps
      WHERE ps.professional_id = _item.professional_id
        AND ps.service_id = _item.service_id
        AND ps.commission_value > 0
      LIMIT 1;

      IF FOUND THEN
        _commission_amount := CASE _commission_type
          WHEN 'fixed' THEN _commission_value
          ELSE (_reference_value * _commission_value) / 100
        END;
        _description := concat(_item.name, ' (comissão específica)');
      END IF;
    END IF;

    IF COALESCE(_commission_amount, 0) <= 0 THEN
      SELECT cr.id, cr.name, cr.commission_type, cr.commission_value
      INTO _rule_id, _rule_name, _commission_type, _commission_value
      FROM public.commission_rules cr
      WHERE cr.establishment_id = _tab.establishment_id
        AND cr.is_active = true
        AND cr.is_challenge = false
        AND (
          (_item.service_id IS NOT NULL AND cr.applies_to IN ('specific_services', 'specific_mixed') AND _item.service_id = ANY(cr.applicable_service_ids))
          OR (_item.product_id IS NOT NULL AND cr.applies_to IN ('specific_products', 'specific_mixed') AND _item.product_id = ANY(cr.applicable_product_ids))
          OR (_item.service_id IS NOT NULL AND cr.applies_to IN ('own_services', 'all_services'))
          OR (_item.product_id IS NOT NULL AND cr.applies_to = 'products')
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

      IF _rule_id IS NOT NULL THEN
        _commission_amount := CASE _commission_type
          WHEN 'fixed' THEN _commission_value
          ELSE (_reference_value * _commission_value) / 100
        END;
        _description := concat(_item.name, ' (', _rule_name, ')');
      END IF;
    END IF;

    IF COALESCE(_commission_amount, 0) > 0 THEN
      INSERT INTO public.professional_commissions (
        establishment_id, professional_id, tab_id, tab_item_id,
        commission_rule_id, reference_value, commission_amount,
        description, status, created_at
      ) VALUES (
        _tab.establishment_id,
        _item.professional_id,
        _tab_id,
        _item.id,
        _rule_id,
        _reference_value,
        round(_commission_amount, 2),
        CASE WHEN _reference_value <> round(_full_price, 2)
          THEN concat(_description, ' — base após desconto')
          ELSE _description
        END,
        'pending',
        _created_at
      ) RETURNING id INTO _target_id;

      INSERT INTO _stage_comm(id, professional_id, rule_key, raw_amount)
      VALUES (
        _target_id,
        _item.professional_id,
        COALESCE(_rule_id, '00000000-0000-0000-0000-000000000000'::uuid),
        _commission_amount
      );

      _inserted := _inserted + 1;
    END IF;
  END LOOP;

  FOR _bucket IN
    SELECT
      s.professional_id,
      s.rule_key,
      round(sum(s.raw_amount), 2) AS target_sum,
      sum(round(s.raw_amount, 2)) AS current_sum
    FROM _stage_comm s
    GROUP BY s.professional_id, s.rule_key
  LOOP
    _diff := _bucket.target_sum - _bucket.current_sum;
    IF _diff <> 0 THEN
      SELECT s.id INTO _target_id
      FROM _stage_comm s
      WHERE s.professional_id = _bucket.professional_id
        AND s.rule_key = _bucket.rule_key
      ORDER BY s.raw_amount DESC, s.id
      LIMIT 1;

      IF _target_id IS NOT NULL THEN
        UPDATE public.professional_commissions
        SET commission_amount = commission_amount + _diff
        WHERE id = _target_id
          AND commission_amount + _diff > 0;
      END IF;
    END IF;
  END LOOP;

  RETURN _inserted;
END;
$function$;