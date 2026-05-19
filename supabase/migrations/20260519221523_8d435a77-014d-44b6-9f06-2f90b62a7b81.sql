ALTER TABLE public.tabs ADD COLUMN IF NOT EXISTS manual_discount_item_ids uuid[];

CREATE OR REPLACE VIEW public.vw_finance_consolidated AS
WITH manual_entries AS (
  SELECT fe.id, fe.establishment_id, fe.type, fe.amount, fe.description, fe.date,
         fe.payment_method, fe.status, fe.category_id, fc.name AS category_name,
         false AS is_auto, 'manual'::text AS source, NULL::uuid AS source_ref_id
  FROM public.finance_entries fe
  JOIN public.finance_categories fc ON fc.id = fe.category_id
),
tab_item_eligibility AS (
  SELECT ti.id AS item_id, ti.tab_id, ti.total_price,
    CASE
      WHEN COALESCE(t.discount_amount, 0) <= 0 THEN true
      -- Coupon: respect coupon target
      WHEN t.coupon_id IS NOT NULL THEN
        CASE
          WHEN dc.discount_target = 'total' OR dc.discount_target IS NULL THEN true
          WHEN dc.discount_target = 'services' AND ti.service_id IS NOT NULL
               AND (cardinality(COALESCE(dc.applicable_service_ids, ARRAY[]::uuid[])) = 0
                    OR ti.service_id = ANY(dc.applicable_service_ids)) THEN true
          WHEN dc.discount_target = 'products' AND ti.product_id IS NOT NULL
               AND (cardinality(COALESCE(dc.applicable_product_ids, ARRAY[]::uuid[])) = 0
                    OR ti.product_id = ANY(dc.applicable_product_ids)) THEN true
          ELSE false
        END
      -- Manual: respect selected items list (NULL/empty = all)
      WHEN t.discount_type = 'manual' THEN
        CASE
          WHEN t.manual_discount_item_ids IS NULL
               OR cardinality(t.manual_discount_item_ids) = 0 THEN true
          WHEN ti.id = ANY(t.manual_discount_item_ids) THEN true
          ELSE false
        END
      -- Loyalty/other discounts: whole tab
      ELSE true
    END AS eligible
  FROM public.tab_items ti
  JOIN public.tabs t ON t.id = ti.tab_id
  LEFT JOIN public.discount_coupons dc ON dc.id = t.coupon_id
  WHERE t.status = 'closed' AND COALESCE(t.is_deleted, false) = false
    AND ti.item_type IN ('service', 'product')
),
tab_eligible_totals AS (
  SELECT tab_id, SUM(total_price) FILTER (WHERE eligible) AS eligible_total
  FROM tab_item_eligibility GROUP BY tab_id
),
tab_revenues AS (
  SELECT ti.id, t.establishment_id, 'revenue'::finance_entry_type AS type,
    round(
      CASE
        WHEN COALESCE(t.discount_amount, 0) <= 0 THEN ti.total_price
        WHEN NOT te.eligible THEN ti.total_price
        WHEN COALESCE(tet.eligible_total, 0) <= 0 THEN ti.total_price
        ELSE ti.total_price - LEAST(t.discount_amount, tet.eligible_total) * ti.total_price / tet.eligible_total
      END, 2) AS amount,
    CASE WHEN ti.item_type = 'service' THEN 'Serviço: ' ELSE 'Produto: ' END || ti.name AS description,
    (t.closed_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,
    (SELECT tp.payment_method_name FROM public.tab_payments tp
       WHERE tp.tab_id = t.id ORDER BY tp.amount DESC LIMIT 1) AS payment_method,
    'paid'::finance_entry_status AS status,
    NULL::uuid AS category_id,
    CASE WHEN ti.item_type = 'service' THEN 'Serviços (Comandas)' ELSE 'Produtos (Comandas)' END AS category_name,
    true AS is_auto, 'tab_item'::text AS source, t.id AS source_ref_id
  FROM public.tab_items ti
  JOIN public.tabs t ON t.id = ti.tab_id
  JOIN tab_item_eligibility te ON te.item_id = ti.id
  LEFT JOIN tab_eligible_totals tet ON tet.tab_id = ti.tab_id
  WHERE t.status = 'closed' AND COALESCE(t.is_deleted, false) = false
    AND ti.item_type IN ('service', 'product')
),
commission_pending AS (
  SELECT pc.id, pc.establishment_id, 'expense'::finance_entry_type AS type,
    pc.commission_amount AS amount,
    'Comissão: ' || COALESCE(pr.name, 'Profissional') AS description,
    (pc.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,
    NULL::text AS payment_method, 'pending'::finance_entry_status AS status,
    NULL::uuid AS category_id, 'Comissões'::text AS category_name,
    true AS is_auto, 'commission'::text AS source, pc.id AS source_ref_id
  FROM public.professional_commissions pc
  LEFT JOIN public.professionals pr ON pr.id = pc.professional_id
  WHERE pc.status = 'pending'
),
commission_paid AS (
  SELECT pc.id, pc.establishment_id, 'expense'::finance_entry_type AS type,
    pc.commission_amount AS amount,
    'Comissão paga: ' || COALESCE(pr.name, 'Profissional') AS description,
    (COALESCE(pc.paid_at, pc.updated_at) AT TIME ZONE 'America/Sao_Paulo')::date AS date,
    NULL::text AS payment_method, 'paid'::finance_entry_status AS status,
    NULL::uuid AS category_id, 'Comissões'::text AS category_name,
    true AS is_auto, 'commission'::text AS source, pc.id AS source_ref_id
  FROM public.professional_commissions pc
  LEFT JOIN public.professionals pr ON pr.id = pc.professional_id
  WHERE pc.status = 'paid'
)
SELECT * FROM manual_entries
UNION ALL SELECT * FROM tab_revenues
UNION ALL SELECT * FROM commission_pending
UNION ALL SELECT * FROM commission_paid;