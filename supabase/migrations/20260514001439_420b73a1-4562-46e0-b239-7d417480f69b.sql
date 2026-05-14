-- Função genérica que bloqueia escritas em estabelecimentos demo
CREATE OR REPLACE FUNCTION public.prevent_demo_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _est_id uuid;
  _is_demo boolean;
BEGIN
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  _est_id := COALESCE(NEW.establishment_id, OLD.establishment_id);
  IF _est_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT is_demo INTO _is_demo FROM public.establishments WHERE id = _est_id;
  IF COALESCE(_is_demo, false) THEN
    RAISE EXCEPTION 'Operação bloqueada: salão de demonstração é somente leitura' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Variante para tabelas filhas que referenciam tabs (tab_items, tab_payments)
CREATE OR REPLACE FUNCTION public.prevent_demo_writes_via_tab()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tab_id uuid;
  _est_id uuid;
  _is_demo boolean;
BEGIN
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  _tab_id := COALESCE(NEW.tab_id, OLD.tab_id);
  IF _tab_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT establishment_id INTO _est_id FROM public.tabs WHERE id = _tab_id;
  IF _est_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT is_demo INTO _is_demo FROM public.establishments WHERE id = _est_id;
  IF COALESCE(_is_demo, false) THEN
    RAISE EXCEPTION 'Operação bloqueada: salão de demonstração é somente leitura' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplica triggers nas tabelas com establishment_id
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'appointments','services','professionals','clients','products',
    'tabs','professional_commissions','finance_entries','discount_coupons',
    'service_categories','product_categories','professional_blocked_times',
    'tab_reviews','notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_prevent_demo_writes ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_prevent_demo_writes BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_demo_writes()', t);
    END IF;
  END LOOP;
END $$;

-- Triggers via tab para tab_items e tab_payments
DROP TRIGGER IF EXISTS trg_prevent_demo_writes ON public.tab_items;
CREATE TRIGGER trg_prevent_demo_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.tab_items
  FOR EACH ROW EXECUTE FUNCTION public.prevent_demo_writes_via_tab();

DROP TRIGGER IF EXISTS trg_prevent_demo_writes ON public.tab_payments;
CREATE TRIGGER trg_prevent_demo_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.tab_payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_demo_writes_via_tab();