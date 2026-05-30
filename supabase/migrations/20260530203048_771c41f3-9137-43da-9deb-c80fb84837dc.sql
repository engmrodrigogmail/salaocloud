
-- RPC SECURITY DEFINER para criar comanda, contornando a policy RESTRICTIVE
-- de SELECT em public.tabs (que bloqueia o RETURNING do INSERT direto).
-- A função valida manualmente se o chamador é dono do salão, super_admin
-- ou profissional ativo do estabelecimento antes de inserir.

CREATE OR REPLACE FUNCTION public.create_tab_secure(_payload jsonb)
RETURNS public.tabs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _est_id uuid := NULLIF(_payload->>'establishment_id','')::uuid;
  _row public.tabs;
  _is_owner boolean := false;
  _is_prof boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF _est_id IS NULL THEN
    RAISE EXCEPTION 'establishment_id_required' USING ERRCODE = '22023';
  END IF;

  -- Autorização: dono, super_admin ou profissional ativo do estabelecimento
  SELECT EXISTS (
    SELECT 1 FROM public.establishments WHERE id = _est_id AND owner_id = _uid
  ) INTO _is_owner;

  IF NOT _is_owner AND NOT public.has_role(_uid, 'super_admin'::app_role) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.professionals
       WHERE establishment_id = _est_id
         AND user_id = _uid
         AND is_active = true
    ) INTO _is_prof;
    IF NOT _is_prof THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.tabs (
    establishment_id,
    client_id,
    appointment_id,
    professional_id,
    client_name,
    notes,
    status,
    subtotal,
    total,
    is_retroactive,
    opened_at,
    created_at,
    updated_at,
    created_by
  ) VALUES (
    _est_id,
    NULLIF(_payload->>'client_id','')::uuid,
    NULLIF(_payload->>'appointment_id','')::uuid,
    NULLIF(_payload->>'professional_id','')::uuid,
    _payload->>'client_name',
    _payload->>'notes',
    'open',
    0,
    0,
    COALESCE((_payload->>'is_retroactive')::boolean, false),
    COALESCE(NULLIF(_payload->>'opened_at','')::timestamptz, now()),
    COALESCE(NULLIF(_payload->>'opened_at','')::timestamptz, now()),
    COALESCE(NULLIF(_payload->>'opened_at','')::timestamptz, now()),
    _uid
  )
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tab_secure(jsonb) TO authenticated;
