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
    AND COALESCE(t.is_deleted, false) = false
    AND ti.item_type IN ('service', 'product')
),
commission_pending AS (
  SELECT
    pc.id AS id,
    pc.establishment_id,
    'expense'::public.finance_entry_type AS type,
    pc.commission_amount AS amount,
    'Comissão: ' || COALESCE(pr.name, 'Profissional') AS description,
    (pc.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,
    NULL::text AS payment_method,
    'pending'::public.finance_entry_status AS status,
    NULL::uuid AS category_id,
    'Comissões'::text AS category_name,
    true AS is_auto,
    'commission'::text AS source,
    pc.id AS source_ref_id
  FROM public.professional_commissions pc
  LEFT JOIN public.professionals pr ON pr.id = pc.professional_id
  LEFT JOIN public.tabs t ON t.id = pc.tab_id
  WHERE pc.commission_amount > 0
    AND pc.status <> 'paid'
    AND (pc.tab_id IS NULL OR COALESCE(t.is_deleted, false) = false)
    AND COALESCE((SELECT fs.commission_expense_trigger FROM public.finance_settings fs WHERE fs.establishment_id = pc.establishment_id), 'on_tab_close')
        = 'on_commission_payment'
),
commission_paid_grouped AS (
  SELECT
    md5(
      pc.establishment_id::text || ':' ||
      pc.professional_id::text || ':' ||
      COALESCE((pc.paid_at AT TIME ZONE 'America/Sao_Paulo')::date, (pc.created_at AT TIME ZONE 'America/Sao_Paulo')::date)::text
    )::uuid AS id,
    pc.establishment_id,
    'expense'::public.finance_entry_type AS type,
    SUM(pc.commission_amount) AS amount,
    'Comissões ' || COALESCE(pr.name, 'Profissional') ||
      CASE WHEN COUNT(*) > 1 THEN ' (' || COUNT(*) || ' comissões)' ELSE '' END AS description,
    COALESCE((pc.paid_at AT TIME ZONE 'America/Sao_Paulo')::date, (pc.created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS date,
    NULL::text AS payment_method,
    'paid'::public.finance_entry_status AS status,
    NULL::uuid AS category_id,
    'Comissões'::text AS category_name,
    true AS is_auto,
    'commission_group'::text AS source,
    pc.professional_id AS source_ref_id
  FROM public.professional_commissions pc
  LEFT JOIN public.professionals pr ON pr.id = pc.professional_id
  LEFT JOIN public.tabs t ON t.id = pc.tab_id
  WHERE pc.commission_amount > 0
    AND pc.status = 'paid'
    AND (pc.tab_id IS NULL OR COALESCE(t.is_deleted, false) = false)
  GROUP BY
    pc.establishment_id,
    pc.professional_id,
    pr.name,
    COALESCE((pc.paid_at AT TIME ZONE 'America/Sao_Paulo')::date, (pc.created_at AT TIME ZONE 'America/Sao_Paulo')::date)
),
commission_on_close AS (
  SELECT
    pc.id AS id,
    pc.establishment_id,
    'expense'::public.finance_entry_type AS type,
    pc.commission_amount AS amount,
    'Comissão: ' || COALESCE(pr.name, 'Profissional') AS description,
    (pc.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,
    NULL::text AS payment_method,
    'paid'::public.finance_entry_status AS status,
    NULL::uuid AS category_id,
    'Comissões'::text AS category_name,
    true AS is_auto,
    'commission'::text AS source,
    pc.id AS source_ref_id
  FROM public.professional_commissions pc
  LEFT JOIN public.professionals pr ON pr.id = pc.professional_id
  LEFT JOIN public.tabs t ON t.id = pc.tab_id
  WHERE pc.commission_amount > 0
    AND (pc.tab_id IS NULL OR COALESCE(t.is_deleted, false) = false)
    AND COALESCE((SELECT fs.commission_expense_trigger FROM public.finance_settings fs WHERE fs.establishment_id = pc.establishment_id), 'on_tab_close')
        = 'on_tab_close'
)
SELECT * FROM manual_entries
UNION ALL SELECT * FROM tab_revenues
UNION ALL SELECT * FROM commission_pending
UNION ALL SELECT * FROM commission_paid_grouped
UNION ALL SELECT * FROM commission_on_close;

GRANT SELECT ON public.vw_finance_consolidated TO authenticated, anon;