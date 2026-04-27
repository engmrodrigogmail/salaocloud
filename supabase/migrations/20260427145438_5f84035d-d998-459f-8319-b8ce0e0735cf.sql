CREATE OR REPLACE FUNCTION public.get_client_appointments(_client_id uuid, _email text DEFAULT NULL, _phone text DEFAULT NULL)
 RETURNS TABLE(id uuid, establishment_id uuid, service_id uuid, professional_id uuid, client_id uuid, scheduled_at timestamp with time zone, duration_minutes integer, price numeric, status text, client_name text, client_phone text, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, service_name text, professional_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _normalized_email text := lower(trim(coalesce(_email, '')));
  _normalized_phone text := regexp_replace(coalesce(_phone, ''), '[^0-9]', '', 'g');
  _owns boolean;
BEGIN
  IF _client_id IS NULL THEN
    RETURN;
  END IF;

  IF _normalized_email = '' AND _normalized_phone = '' THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id
      AND (
        (_normalized_email <> '' AND (
          lower(coalesce(c.global_identity_email, '')) = _normalized_email
          OR lower(coalesce(c.email, '')) = _normalized_email
        ))
        OR
        (_normalized_phone <> '' AND regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = _normalized_phone)
      )
  ) INTO _owns;

  IF NOT _owns THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.establishment_id,
    a.service_id,
    a.professional_id,
    a.client_id,
    a.scheduled_at,
    a.duration_minutes,
    a.price,
    a.status::text,
    a.client_name,
    a.client_phone,
    a.notes,
    a.created_at,
    a.updated_at,
    s.name AS service_name,
    p.name AS professional_name
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.professionals p ON p.id = a.professional_id
  WHERE a.client_id = _client_id
  ORDER BY a.scheduled_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_client_appointments(uuid, text, text) TO anon, authenticated;