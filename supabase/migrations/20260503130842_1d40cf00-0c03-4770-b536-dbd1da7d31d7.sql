
-- Enums
CREATE TYPE public.finance_entry_type AS ENUM ('revenue', 'expense');
CREATE TYPE public.finance_entry_status AS ENUM ('pending', 'paid');
CREATE TYPE public.finance_commission_trigger AS ENUM ('on_tab_close', 'on_commission_payment');

-- Função auxiliar de autorização (dono OU gerente ativo)
CREATE OR REPLACE FUNCTION public.is_finance_authorized(_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.establishments WHERE id = _establishment_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.professionals
     WHERE establishment_id = _establishment_id
       AND user_id = auth.uid()
       AND is_active = true
       AND is_manager = true
  )
$$;

-- Tabela: finance_categories
CREATE TABLE public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.finance_entry_type NOT NULL,
  color text,
  icon text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, type, name)
);
CREATE INDEX idx_finance_categories_est ON public.finance_categories(establishment_id, type);

ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance authorized manage categories"
  ON public.finance_categories FOR ALL
  USING (public.is_finance_authorized(establishment_id))
  WITH CHECK (public.is_finance_authorized(establishment_id));
CREATE POLICY "Super admins manage finance categories"
  ON public.finance_categories FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_finance_categories_updated_at
  BEFORE UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela: finance_recurring_templates
CREATE TABLE public.finance_recurring_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.finance_categories(id) ON DELETE RESTRICT,
  type public.finance_entry_type NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text NOT NULL,
  day_of_month integer NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_recurring_est ON public.finance_recurring_templates(establishment_id, is_active);

ALTER TABLE public.finance_recurring_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance authorized manage recurring"
  ON public.finance_recurring_templates FOR ALL
  USING (public.is_finance_authorized(establishment_id))
  WITH CHECK (public.is_finance_authorized(establishment_id));
CREATE POLICY "Super admins manage finance recurring"
  ON public.finance_recurring_templates FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_finance_recurring_updated_at
  BEFORE UPDATE ON public.finance_recurring_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela: finance_entries
CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.finance_categories(id) ON DELETE RESTRICT,
  type public.finance_entry_type NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text NOT NULL,
  date date NOT NULL,
  payment_method text,
  status public.finance_entry_status NOT NULL DEFAULT 'paid',
  paid_at timestamptz,
  recurring_template_id uuid REFERENCES public.finance_recurring_templates(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_entries_est_date ON public.finance_entries(establishment_id, date DESC);
CREATE INDEX idx_finance_entries_status ON public.finance_entries(establishment_id, status);

-- Trigger: payment_method obrigatório quando status = paid
CREATE OR REPLACE FUNCTION public.validate_finance_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (NEW.payment_method IS NULL OR length(trim(NEW.payment_method)) = 0) THEN
    RAISE EXCEPTION 'payment_method é obrigatório para lançamentos pagos';
  END IF;
  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
    NEW.paid_at := now();
  END IF;
  IF NEW.status = 'pending' THEN
    NEW.paid_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_finance_entry_trg
  BEFORE INSERT OR UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_finance_entry();

CREATE TRIGGER update_finance_entries_updated_at
  BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance authorized manage entries"
  ON public.finance_entries FOR ALL
  USING (public.is_finance_authorized(establishment_id))
  WITH CHECK (public.is_finance_authorized(establishment_id));
CREATE POLICY "Super admins manage finance entries"
  ON public.finance_entries FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Tabela: finance_settings
CREATE TABLE public.finance_settings (
  establishment_id uuid PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  commission_expense_trigger public.finance_commission_trigger NOT NULL DEFAULT 'on_tab_close',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance authorized manage settings"
  ON public.finance_settings FOR ALL
  USING (public.is_finance_authorized(establishment_id))
  WITH CHECK (public.is_finance_authorized(establishment_id));
CREATE POLICY "Super admins manage finance settings"
  ON public.finance_settings FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_finance_settings_updated_at
  BEFORE UPDATE ON public.finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função de seed de categorias padrão
CREATE OR REPLACE FUNCTION public.seed_finance_categories(_establishment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.finance_categories WHERE establishment_id = _establishment_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.finance_categories (establishment_id, name, type, is_system) VALUES
    (_establishment_id, 'Fornecedores Cabelo', 'expense', true),
    (_establishment_id, 'Fornecedores Unhas', 'expense', true),
    (_establishment_id, 'Energia', 'expense', true),
    (_establishment_id, 'Internet', 'expense', true),
    (_establishment_id, 'Aluguel', 'expense', true),
    (_establishment_id, 'Contador', 'expense', true),
    (_establishment_id, 'Comissões', 'expense', true),
    (_establishment_id, 'Marketing', 'expense', true),
    (_establishment_id, 'Taxas de Maquininha', 'expense', true),
    (_establishment_id, 'Impostos', 'expense', true),
    (_establishment_id, 'Outras Despesas', 'expense', true),
    (_establishment_id, 'Sublocação', 'revenue', true),
    (_establishment_id, 'Venda de Equipamentos', 'revenue', true),
    (_establishment_id, 'Outras Receitas', 'revenue', true);

  INSERT INTO public.finance_settings (establishment_id) VALUES (_establishment_id)
  ON CONFLICT (establishment_id) DO NOTHING;
END;
$$;

-- View consolidada
CREATE OR REPLACE VIEW public.vw_finance_consolidated AS
WITH manual_entries AS (
  SELECT
    fe.id,
    fe.establishment_id,
    fe.type,
    fe.amount,
    fe.description,
    fe.date,
    fe.payment_method,
    fe.status,
    fe.category_id,
    fc.name AS category_name,
    false AS is_auto,
    'manual'::text AS source,
    NULL::uuid AS source_ref_id
  FROM public.finance_entries fe
  JOIN public.finance_categories fc ON fc.id = fe.category_id
),
tab_revenues AS (
  -- Receita de comandas fechadas, separadas por serviço/produto, com forma de pagamento dominante
  SELECT
    ti.id AS id,
    t.establishment_id,
    'revenue'::public.finance_entry_type AS type,
    ti.total_price AS amount,
    CASE WHEN ti.item_type = 'service' THEN 'Serviço: ' ELSE 'Produto: ' END || ti.name AS description,
    (t.closed_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,
    (
      SELECT tp.payment_method_name
        FROM public.tab_payments tp
       WHERE tp.tab_id = t.id
       ORDER BY tp.amount DESC
       LIMIT 1
    ) AS payment_method,
    'paid'::public.finance_entry_status AS status,
    NULL::uuid AS category_id,
    CASE WHEN ti.item_type = 'service' THEN 'Serviços (Comandas)' ELSE 'Produtos (Comandas)' END AS category_name,
    true AS is_auto,
    'tab_item'::text AS source,
    t.id AS source_ref_id
  FROM public.tab_items ti
  JOIN public.tabs t ON t.id = ti.tab_id
  WHERE t.status = 'closed'
    AND ti.item_type IN ('service', 'product')
),
commission_expenses AS (
  SELECT
    pc.id AS id,
    pc.establishment_id,
    'expense'::public.finance_entry_type AS type,
    pc.commission_amount AS amount,
    'Comissão: ' || COALESCE(pr.name, 'Profissional') AS description,
    CASE
      WHEN COALESCE((SELECT fs.commission_expense_trigger FROM public.finance_settings fs WHERE fs.establishment_id = pc.establishment_id), 'on_tab_close')
           = 'on_commission_payment'
        THEN COALESCE((pc.paid_at AT TIME ZONE 'America/Sao_Paulo')::date, (pc.created_at AT TIME ZONE 'America/Sao_Paulo')::date)
      ELSE (pc.created_at AT TIME ZONE 'America/Sao_Paulo')::date
    END AS date,
    NULL::text AS payment_method,
    CASE
      WHEN COALESCE((SELECT fs.commission_expense_trigger FROM public.finance_settings fs WHERE fs.establishment_id = pc.establishment_id), 'on_tab_close')
           = 'on_commission_payment'
        AND pc.status <> 'paid'
        THEN 'pending'::public.finance_entry_status
      ELSE 'paid'::public.finance_entry_status
    END AS status,
    NULL::uuid AS category_id,
    'Comissões'::text AS category_name,
    true AS is_auto,
    'commission'::text AS source,
    pc.id AS source_ref_id
  FROM public.professional_commissions pc
  LEFT JOIN public.professionals pr ON pr.id = pc.professional_id
  WHERE pc.commission_amount > 0
)
SELECT * FROM manual_entries
UNION ALL
SELECT * FROM tab_revenues
UNION ALL
SELECT * FROM commission_expenses;

-- Concede permissão de leitura via RLS das tabelas-base
GRANT SELECT ON public.vw_finance_consolidated TO authenticated, anon;
