
DROP POLICY IF EXISTS "Professionals can update own password flag" ON public.professionals;

CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  UPDATE public.professionals
     SET must_change_password = false,
         updated_at = now()
   WHERE user_id = auth.uid();
  RETURN jsonb_build_object('success', true);
END;
$$;
