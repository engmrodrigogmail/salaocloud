-- 1) Drop recursive policy
DROP POLICY IF EXISTS "Professionals can update status of own appointments" ON public.appointments;

-- 2) Recreate simpler, non-recursive UPDATE policy for professionals
CREATE POLICY "Professionals can update own appointments"
ON public.appointments
FOR UPDATE
USING (professional_id = public.get_user_professional_id(auth.uid()))
WITH CHECK (professional_id = public.get_user_professional_id(auth.uid()));

-- 3) Trigger BEFORE UPDATE: locks sensitive columns for professionals (non-owners, non-super-admins)
CREATE OR REPLACE FUNCTION public.lock_appointment_columns_for_professionals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_owner boolean;
  _is_super boolean;
BEGIN
  -- Owner of the establishment may change anything
  SELECT EXISTS (
    SELECT 1 FROM public.establishments e
    WHERE e.id = NEW.establishment_id AND e.owner_id = auth.uid()
  ) INTO _is_owner;

  IF _is_owner THEN
    RETURN NEW;
  END IF;

  -- Super admin may change anything
  SELECT public.has_role(auth.uid(), 'super_admin'::app_role) INTO _is_super;
  IF _is_super THEN
    RETURN NEW;
  END IF;

  -- Otherwise (professional), lock sensitive columns
  IF NEW.establishment_id IS DISTINCT FROM OLD.establishment_id
     OR NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.professional_id IS DISTINCT FROM OLD.professional_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
  THEN
    RAISE EXCEPTION 'Profissional não pode alterar dados sensíveis do agendamento';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_appointment_columns_for_professionals ON public.appointments;
CREATE TRIGGER trg_lock_appointment_columns_for_professionals
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.lock_appointment_columns_for_professionals();

-- 4) Cleanup: remove orphan empty tabs created in the last 7 days that were never used
DELETE FROM public.tabs t
WHERE t.status = 'open'
  AND t.opened_at > now() - interval '7 days'
  AND NOT EXISTS (SELECT 1 FROM public.tab_items ti WHERE ti.tab_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM public.tab_payments tp WHERE tp.tab_id = t.id);
