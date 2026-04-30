-- ============================================================
-- FASE B — Desconto manual + override + cupom atômico
-- ============================================================

-- 1. tabs: campos de controle de desconto e vínculos
ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS discount_reduces_commission boolean,
  ADD COLUMN IF NOT EXISTS coupon_id uuid,
  ADD COLUMN IF NOT EXISTS loyalty_redemption_id uuid,
  ADD COLUMN IF NOT EXISTS manager_pin_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_professional_id uuid;

COMMENT ON COLUMN public.tabs.discount_reduces_commission IS 'NULL = ainda não decidido. true/false = decisão registrada na hora de aplicar o desconto.';

-- 2. tab_items: campos de override de preço
ALTER TABLE public.tab_items
  ADD COLUMN IF NOT EXISTS original_unit_price numeric,
  ADD COLUMN IF NOT EXISTS price_override_by uuid,
  ADD COLUMN IF NOT EXISTS price_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_override_reason text;

-- 3. professional_commissions: campos de override de comissão
ALTER TABLE public.professional_commissions
  ADD COLUMN IF NOT EXISTS original_commission_amount numeric,
  ADD COLUMN IF NOT EXISTS override_by uuid,
  ADD COLUMN IF NOT EXISTS override_at timestamptz,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS discount_applied numeric NOT NULL DEFAULT 0;

-- 4. RPC atômico para aplicar cupom em comanda
CREATE OR REPLACE FUNCTION public.apply_coupon_to_tab(
  _tab_id uuid,
  _coupon_code text,
  _reduces_commission boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tab RECORD;
  _coupon RECORD;
  _discount_amount numeric := 0;
  _eligible_subtotal numeric := 0;
BEGIN
  -- Lock the tab row to prevent races
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

  -- Lock the coupon and validate
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

  -- Calcula o subtotal elegível conforme escopo do cupom
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

  -- Calcula o valor do desconto
  IF _coupon.discount_type = 'percentage' THEN
    _discount_amount := round((_eligible_subtotal * _coupon.discount_value / 100)::numeric, 2);
  ELSE
    _discount_amount := LEAST(_coupon.discount_value, _eligible_subtotal);
  END IF;

  -- Atualiza a comanda
  UPDATE public.tabs
     SET coupon_id = _coupon.id,
         discount_amount = COALESCE(discount_amount, 0) + _discount_amount,
         discount_type = COALESCE(discount_type, 'coupon'),
         discount_reduces_commission = _reduces_commission,
         total = subtotal - (COALESCE(discount_amount, 0) + _discount_amount),
         updated_at = now()
   WHERE id = _tab_id;

  -- Incrementa uso do cupom
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
$$;