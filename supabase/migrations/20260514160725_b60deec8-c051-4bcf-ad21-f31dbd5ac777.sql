CREATE OR REPLACE FUNCTION public.close_tab_atomic(
  _tab_id uuid,
  _payments jsonb,
  _commissions jsonb DEFAULT '[]'::jsonb,
  _flags jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tab RECORD;
  _sum_payments numeric := 0;
  _payment jsonb;
  _commission jsonb;
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
      installments, has_interest, interest_amount, notes
    ) VALUES (
      _tab_id,
      NULLIF(_payment->>'payment_method_id','')::uuid,
      _payment->>'payment_method_name',
      (_payment->>'amount')::numeric,
      COALESCE((_payment->>'installments')::int, 1),
      COALESCE((_payment->>'has_interest')::boolean, false),
      COALESCE((_payment->>'interest_amount')::numeric, 0),
      _payment->>'notes'
    );
  END LOOP;

  IF _commissions IS NOT NULL AND jsonb_array_length(_commissions) > 0 THEN
    FOR _commission IN SELECT * FROM jsonb_array_elements(_commissions) LOOP
      INSERT INTO public.professional_commissions (
        establishment_id, professional_id, tab_id, tab_item_id,
        commission_rule_id, reference_value, commission_amount,
        description, status
      ) VALUES (
        _tab.establishment_id,
        (_commission->>'professional_id')::uuid,
        _tab_id,
        NULLIF(_commission->>'tab_item_id','')::uuid,
        NULLIF(_commission->>'commission_rule_id','')::uuid,
        COALESCE((_commission->>'reference_value')::numeric, 0),
        COALESCE((_commission->>'commission_amount')::numeric, 0),
        _commission->>'description',
        COALESCE(_commission->>'status', 'pending')
      );
    END LOOP;
  END IF;

  UPDATE public.tabs
     SET status = 'closed',
         closed_at = now(),
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
$$;