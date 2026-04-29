-- FASE 2: configurações por estabelecimento
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS no_show_tolerance_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS no_show_auto_detect boolean NOT NULL DEFAULT true;

-- FASE 1: função para marcar no-shows automaticamente
CREATE OR REPLACE FUNCTION public.auto_mark_no_shows()
RETURNS TABLE(marked_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
BEGIN
  WITH updated AS (
    UPDATE public.appointments a
    SET status = 'no_show'::appointment_status,
        updated_at = now()
    FROM public.establishments e
    WHERE a.establishment_id = e.id
      AND e.no_show_auto_detect = true
      AND a.status IN ('pending'::appointment_status, 'confirmed'::appointment_status)
      AND a.scheduled_at + (COALESCE(e.no_show_tolerance_minutes, 30) || ' minutes')::interval < now()
    RETURNING a.id
  )
  SELECT count(*)::integer INTO _count FROM updated;

  RETURN QUERY SELECT _count;
END;
$$;

-- FASE 3: view de estatísticas de no-show por cliente
CREATE OR REPLACE VIEW public.client_no_show_stats AS
SELECT
  c.id AS client_id,
  c.establishment_id,
  c.name AS client_name,
  c.phone AS client_phone,
  COUNT(a.id) FILTER (WHERE a.status = 'no_show'::appointment_status) AS no_show_count,
  COUNT(a.id) FILTER (WHERE a.status IN ('completed'::appointment_status,'no_show'::appointment_status,'cancelled'::appointment_status)) AS total_finalized,
  MAX(a.scheduled_at) FILTER (WHERE a.status = 'no_show'::appointment_status) AS last_no_show_at,
  CASE
    WHEN COUNT(a.id) FILTER (WHERE a.status IN ('completed'::appointment_status,'no_show'::appointment_status,'cancelled'::appointment_status)) = 0 THEN 0
    ELSE ROUND(
      (COUNT(a.id) FILTER (WHERE a.status = 'no_show'::appointment_status)::numeric /
       COUNT(a.id) FILTER (WHERE a.status IN ('completed'::appointment_status,'no_show'::appointment_status,'cancelled'::appointment_status))::numeric) * 100,
      2
    )
  END AS no_show_rate_percent
FROM public.clients c
LEFT JOIN public.appointments a ON a.client_id = c.id
GROUP BY c.id, c.establishment_id, c.name, c.phone;