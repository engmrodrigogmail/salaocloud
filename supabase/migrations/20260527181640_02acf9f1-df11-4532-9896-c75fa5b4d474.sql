CREATE OR REPLACE FUNCTION public.auto_mark_no_shows()
 RETURNS TABLE(marked_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND COALESCE(e.is_demo, false) = false
      AND a.status IN ('pending'::appointment_status, 'confirmed'::appointment_status)
      AND a.scheduled_at + (COALESCE(e.no_show_tolerance_minutes, 30) || ' minutes')::interval < now()
    RETURNING a.id
  )
  SELECT count(*)::integer INTO _count FROM updated;

  RETURN QUERY SELECT _count;
END;
$function$;