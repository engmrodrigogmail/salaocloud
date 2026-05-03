
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS global_identity_phone text;

CREATE INDEX IF NOT EXISTS idx_clients_global_identity_phone
  ON public.clients (global_identity_phone);

UPDATE public.clients
SET global_identity_phone = regexp_replace(phone, '\D', '', 'g')
WHERE global_identity_phone IS NULL AND phone IS NOT NULL;

DROP VIEW IF EXISTS public.vw_shared_client_history;

CREATE VIEW public.vw_shared_client_history
WITH (security_invoker = true) AS
SELECT
  ti.id                          AS tab_item_id,
  lower(c.global_identity_email) AS global_identity_email,
  c.global_identity_phone        AS global_identity_phone,
  t.closed_at,
  ti.name                        AS service_name,
  s.duration_minutes,
  t.establishment_id
FROM public.tab_items ti
JOIN public.tabs t          ON t.id = ti.tab_id
JOIN public.clients c       ON c.id = t.client_id
LEFT JOIN public.services s ON s.id = ti.service_id
WHERE t.status = 'closed'
  AND ti.item_type = 'service'
  AND (c.global_identity_email IS NOT NULL OR c.global_identity_phone IS NOT NULL)
  AND c.shared_history_consent = true;

GRANT SELECT ON public.vw_shared_client_history TO authenticated;
