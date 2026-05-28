CREATE OR REPLACE FUNCTION public.prevent_demo_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row jsonb;
  _est_id uuid;
  _is_demo boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _row := COALESCE(to_jsonb(NEW), to_jsonb(OLD));

  IF _row ? 'establishment_id' THEN
    _est_id := NULLIF(_row->>'establishment_id','')::uuid;
  ELSIF TG_TABLE_NAME = 'notifications' AND (_row->>'recipient_type') = 'establishment' THEN
    _est_id := NULLIF(_row->>'recipient_id','')::uuid;
  END IF;

  IF _est_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT is_demo INTO _is_demo FROM public.establishments WHERE id = _est_id;
  IF NOT COALESCE(_is_demo, false) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.training_vendor_profiles
     WHERE user_id = auth.uid()
       AND sandbox_establishment_id = _est_id
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION 'Operação bloqueada: salão de demonstração é somente leitura' USING ERRCODE = '42501';
END;
$$;

SELECT set_config('request.jwt.claim.role', 'service_role', true);

UPDATE public.notifications
SET delivered_push = true
WHERE delivered_push = false
  AND recipient_type = 'establishment'
  AND recipient_id = '741f11ed-9400-4d39-af47-418da6677303';