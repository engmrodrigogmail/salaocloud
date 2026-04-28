-- Trigger function: when a tab is created/updated with appointment_id and status open => set appointment to in_service
CREATE OR REPLACE FUNCTION public.sync_appointment_status_from_tab()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT or UPDATE that sets/keeps appointment_id with status='open' -> in_service
  IF TG_OP = 'INSERT' THEN
    IF NEW.appointment_id IS NOT NULL AND NEW.status = 'open' THEN
      UPDATE public.appointments
      SET status = 'in_service', updated_at = now()
      WHERE id = NEW.appointment_id
        AND status NOT IN ('cancelled', 'completed');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Tab transitioned to closed => mark appointment completed
    IF NEW.appointment_id IS NOT NULL
       AND NEW.status = 'closed'
       AND COALESCE(OLD.status, '') <> 'closed' THEN
      UPDATE public.appointments
      SET status = 'completed', updated_at = now()
      WHERE id = NEW.appointment_id
        AND status <> 'cancelled';
    -- Tab cancelled => revert appointment to confirmed (only if it was in_service)
    ELSIF NEW.appointment_id IS NOT NULL
       AND NEW.status = 'cancelled'
       AND COALESCE(OLD.status, '') <> 'cancelled' THEN
      UPDATE public.appointments
      SET status = 'confirmed', updated_at = now()
      WHERE id = NEW.appointment_id
        AND status = 'in_service';
    -- Tab reopened (closed->open) with appointment_id
    ELSIF NEW.appointment_id IS NOT NULL
       AND NEW.status = 'open'
       AND COALESCE(OLD.status, '') <> 'open' THEN
      UPDATE public.appointments
      SET status = 'in_service', updated_at = now()
      WHERE id = NEW.appointment_id
        AND status NOT IN ('cancelled');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_status_from_tab ON public.tabs;
CREATE TRIGGER trg_sync_appointment_status_from_tab
AFTER INSERT OR UPDATE ON public.tabs
FOR EACH ROW
EXECUTE FUNCTION public.sync_appointment_status_from_tab();
