
-- 1. Add new columns to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS global_identity_email text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS shared_history_consent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_clients_global_identity_email
  ON public.clients (global_identity_email);

-- Backfill: use existing email when present
UPDATE public.clients
SET global_identity_email = lower(email)
WHERE global_identity_email IS NULL AND email IS NOT NULL;

-- 2. Create shared history view (no financial data, no establishment name)
CREATE OR REPLACE VIEW public.vw_shared_client_history
WITH (security_invoker = true) AS
SELECT
  ti.id                AS tab_item_id,
  lower(c.global_identity_email) AS global_identity_email,
  t.closed_at,
  ti.name              AS service_name,
  s.duration_minutes,
  t.establishment_id
FROM public.tab_items ti
JOIN public.tabs t          ON t.id = ti.tab_id
JOIN public.clients c       ON c.id = t.client_id
LEFT JOIN public.services s ON s.id = ti.service_id
WHERE t.status = 'closed'
  AND ti.item_type = 'service'
  AND c.global_identity_email IS NOT NULL
  AND c.shared_history_consent = true;

GRANT SELECT ON public.vw_shared_client_history TO authenticated;
