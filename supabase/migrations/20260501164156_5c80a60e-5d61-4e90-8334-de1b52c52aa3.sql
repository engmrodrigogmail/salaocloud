-- Coluna delivered_push (idempotente)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivered_push BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_notif_pending_push ON public.notifications(created_at) WHERE delivered_push = false;

-- ============ TRIGGER: novo agendamento -> notifica estabelecimento ============
CREATE OR REPLACE FUNCTION public.notify_new_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _service_name text;
BEGIN
  -- Apenas para inserts vindos do site/portal cliente (sem usuário do estabelecimento)
  -- Pegamos o nome do serviço para exibir
  SELECT name INTO _service_name FROM public.services WHERE id = NEW.service_id;

  INSERT INTO public.notifications (
    recipient_type, recipient_id, sender_type, title, body, link, data
  ) VALUES (
    'establishment', NEW.establishment_id, 'system',
    'Novo agendamento',
    COALESCE(NEW.client_name, 'Cliente') || ' agendou ' || COALESCE(_service_name, 'um serviço') ||
      ' para ' || to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
    '/portal/' || (SELECT slug FROM public.establishments WHERE id = NEW.establishment_id) || '/agenda',
    jsonb_build_object('appointment_id', NEW.id, 'category', 'new_appointment')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_appointment ON public.appointments;
CREATE TRIGGER trg_notify_new_appointment
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_appointment();

-- ============ TRIGGER: cancelamento -> notifica estabelecimento ============
CREATE OR REPLACE FUNCTION public.notify_appointment_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _service_name text;
BEGIN
  IF NEW.status = 'cancelled'::appointment_status
     AND OLD.status IS DISTINCT FROM 'cancelled'::appointment_status THEN

    SELECT name INTO _service_name FROM public.services WHERE id = NEW.service_id;

    INSERT INTO public.notifications (
      recipient_type, recipient_id, sender_type, title, body, link, data
    ) VALUES (
      'establishment', NEW.establishment_id, 'system',
      'Agendamento cancelado',
      COALESCE(NEW.client_name, 'Cliente') || ' cancelou ' || COALESCE(_service_name, 'o agendamento') ||
        ' de ' || to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      '/portal/' || (SELECT slug FROM public.establishments WHERE id = NEW.establishment_id) || '/agenda',
      jsonb_build_object('appointment_id', NEW.id, 'category', 'cancelled_appointment')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_appointment_cancelled ON public.appointments;
CREATE TRIGGER trg_notify_appointment_cancelled
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_cancelled();