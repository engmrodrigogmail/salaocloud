-- 1.3 Add tab_id to coupon_usage
ALTER TABLE public.coupon_usage
  ADD COLUMN IF NOT EXISTS tab_id UUID REFERENCES public.tabs(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS coupon_usage_coupon_tab_unique
  ON public.coupon_usage (coupon_id, tab_id)
  WHERE tab_id IS NOT NULL;

-- 1.1 + 1.2 + 1.4 Recreate close_tab_atomic with cents tolerance, appointment completion, coupon usage logging
CREATE OR REPLACE FUNCTION public.close_tab_atomic(_tab_id uuid, _payments jsonb, _commissions jsonb, _flags jsonb)
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
BEGIN
  SELECT * INTO _tab FROM public.tabs WHERE id = _tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comanda não encontrada');
  END IF;
  IF _tab.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comanda não está aberta');
  END IF;

  -- Valida soma dos pagamentos (tolerância de 1 centavo)
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

  -- Insere pagamentos
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

  -- Insere comissões (calculadas no frontend)
  IF _commissions IS NOT NULL AND jsonb_array_length(_commissions) > 0 THEN
    FOR _commission IN SELECT * FROM jsonb_array_elements(_commissions) LOOP
      INSERT INTO public.professional_commissions (
        establishment_id, professional_id, tab_id, tab_item_id,
        amount, status
      ) VALUES (
        _tab.establishment_id,
        (_commission->>'professional_id')::uuid,
        _tab_id,
        NULLIF(_commission->>'tab_item_id','')::uuid,
        (_commission->>'amount')::numeric,
        COALESCE(_commission->>'status', 'pending')
      );
    END LOOP;
  END IF;

  -- Fecha comanda + grava flags granulares
  UPDATE public.tabs
     SET status = 'closed',
         closed_at = now(),
         closed_by = auth.uid(),
         commission_discount_on_manual = COALESCE((_flags->>'commission_discount_on_manual')::boolean, commission_discount_on_manual),
         commission_discount_on_coupon = COALESCE((_flags->>'commission_discount_on_coupon')::boolean, commission_discount_on_coupon),
         commission_discount_on_loyalty = COALESCE((_flags->>'commission_discount_on_loyalty')::boolean, commission_discount_on_loyalty),
         updated_at = now()
   WHERE id = _tab_id;

  -- 1.2 Atualiza appointment vinculado para completed
  IF _tab.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
       SET status = 'completed',
           updated_at = now()
     WHERE id = _tab.appointment_id
       AND status = 'in_service';
  END IF;

  -- 1.4 Registra uso de cupom (idempotente via índice único)
  IF _tab.coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_usage (coupon_id, client_id, appointment_id, tab_id)
    VALUES (_tab.coupon_id, _tab.client_id, _tab.appointment_id, _tab_id)
    ON CONFLICT (coupon_id, tab_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'tab_id', _tab_id);
END;
$function$;