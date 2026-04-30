
-- ============================================================
-- BLOCO 1: Schema para descontos granulares e auditoria
-- ============================================================

-- 1.1 Políticas padrão de comissão por tipo de desconto
DO $$ BEGIN
  CREATE TYPE public.commission_discount_policy AS ENUM ('always','never','ask');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS commission_discount_policy_manual public.commission_discount_policy NOT NULL DEFAULT 'ask',
  ADD COLUMN IF NOT EXISTS commission_discount_policy_coupon public.commission_discount_policy NOT NULL DEFAULT 'ask',
  ADD COLUMN IF NOT EXISTS commission_discount_policy_loyalty public.commission_discount_policy NOT NULL DEFAULT 'ask';

-- 1.2 Flags granulares na tabela tabs (DROP imediato + populando a partir da antiga)
ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS commission_discount_on_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_discount_on_coupon boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_discount_on_loyalty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_authorized_by uuid;

-- Popular novas flags a partir da antiga (apenas onde fizer sentido pelo discount_type)
UPDATE public.tabs
   SET commission_discount_on_manual = COALESCE(discount_reduces_commission, false)
 WHERE discount_type = 'manual';
UPDATE public.tabs
   SET commission_discount_on_coupon = COALESCE(discount_reduces_commission, false)
 WHERE discount_type = 'coupon';
UPDATE public.tabs
   SET commission_discount_on_loyalty = COALESCE(discount_reduces_commission, false)
 WHERE discount_type = 'loyalty';

-- Atualizar a RPC apply_coupon_to_tab para usar a nova flag granular ANTES do DROP
CREATE OR REPLACE FUNCTION public.apply_coupon_to_tab(_tab_id uuid, _coupon_code text, _reduces_commission boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tab RECORD;
  _coupon RECORD;
  _discount_amount numeric := 0;
  _eligible_subtotal numeric := 0;
BEGIN
  SELECT * INTO _tab FROM public.tabs WHERE id = _tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comanda não encontrada');
  END IF;

  IF _tab.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comanda não está aberta');
  END IF;

  IF _tab.coupon_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Já existe cupom aplicado a esta comanda');
  END IF;

  SELECT * INTO _coupon FROM public.discount_coupons
   WHERE establishment_id = _tab.establishment_id
     AND upper(code) = upper(_coupon_code)
     AND is_active = true
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cupom inválido');
  END IF;

  IF _coupon.valid_from > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cupom ainda não está válido');
  END IF;

  IF _coupon.valid_until IS NOT NULL AND _coupon.valid_until < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cupom expirado');
  END IF;

  IF _coupon.max_uses IS NOT NULL AND _coupon.current_uses >= _coupon.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cupom atingiu o limite de usos');
  END IF;

  IF _coupon.min_purchase_value IS NOT NULL AND _tab.subtotal < _coupon.min_purchase_value THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor mínimo não atingido');
  END IF;

  IF _coupon.discount_target = 'total' THEN
    _eligible_subtotal := _tab.subtotal;
  ELSIF _coupon.discount_target = 'services' THEN
    SELECT COALESCE(SUM(total_price), 0) INTO _eligible_subtotal
      FROM public.tab_items
     WHERE tab_id = _tab_id AND service_id IS NOT NULL
       AND (cardinality(_coupon.applicable_service_ids) = 0
            OR service_id = ANY(_coupon.applicable_service_ids));
  ELSIF _coupon.discount_target = 'products' THEN
    SELECT COALESCE(SUM(total_price), 0) INTO _eligible_subtotal
      FROM public.tab_items
     WHERE tab_id = _tab_id AND product_id IS NOT NULL
       AND (cardinality(_coupon.applicable_product_ids) = 0
            OR product_id = ANY(_coupon.applicable_product_ids));
  ELSE
    _eligible_subtotal := _tab.subtotal;
  END IF;

  -- Bloco 4.6: cupom incompatível
  IF _eligible_subtotal <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum item elegível para este cupom');
  END IF;

  IF _coupon.discount_type = 'percentage' THEN
    _discount_amount := round((_eligible_subtotal * _coupon.discount_value / 100)::numeric, 2);
  ELSE
    _discount_amount := LEAST(_coupon.discount_value, _eligible_subtotal);
  END IF;

  IF _discount_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cupom não gera desconto nesta comanda');
  END IF;

  UPDATE public.tabs
     SET coupon_id = _coupon.id,
         discount_amount = COALESCE(discount_amount, 0) + _discount_amount,
         discount_type = COALESCE(discount_type, 'coupon'),
         commission_discount_on_coupon = _reduces_commission,
         total = subtotal - (COALESCE(discount_amount, 0) + _discount_amount),
         updated_at = now()
   WHERE id = _tab_id;

  UPDATE public.discount_coupons
     SET current_uses = current_uses + 1
   WHERE id = _coupon.id;

  RETURN jsonb_build_object(
    'success', true,
    'coupon_id', _coupon.id,
    'discount_amount', _discount_amount,
    'reduces_commission', _reduces_commission
  );
END;
$function$;

-- Agora podemos remover a coluna antiga
ALTER TABLE public.tabs DROP COLUMN IF EXISTS discount_reduces_commission;

-- 1.3 ON DELETE CASCADE em tab_items -> tabs (não havia FK declarada)
DO $$ BEGIN
  ALTER TABLE public.tab_items
    ADD CONSTRAINT tab_items_tab_id_fkey
    FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- BLOCO 4.4: previous_status para undo de abertura de comanda
-- ============================================================
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS previous_status public.appointment_status;

-- ============================================================
-- BLOCO 2.2: RPC enxuta closeTabAtomic
-- Apenas valida pagamentos == total, insere payments + commissions,
-- fecha comanda. Cálculo de comissão segue no frontend.
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_tab_atomic(
  _tab_id uuid,
  _payments jsonb,
  _commissions jsonb,
  _flags jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Valida soma dos pagamentos
  FOR _payment IN SELECT * FROM jsonb_array_elements(_payments) LOOP
    _sum_payments := _sum_payments + COALESCE((_payment->>'amount')::numeric, 0);
  END LOOP;

  IF round(_sum_payments::numeric, 2) <> round(_tab.total::numeric, 2) THEN
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

  RETURN jsonb_build_object('success', true, 'tab_id', _tab_id);
END;
$$;
