-- 1) Backfill: para cada appointment sem linha em appointment_services, criar uma
INSERT INTO public.appointment_services (
  appointment_id, service_id, professional_id, position, starts_at, duration_minutes, price
)
SELECT a.id, a.service_id, a.professional_id, 1, a.scheduled_at, a.duration_minutes, a.price
FROM public.appointments a
WHERE a.service_id IS NOT NULL
  AND a.professional_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.appointment_services s WHERE s.appointment_id = a.id
  );

-- 2) Trigger: ao inserir um appointment, garantir 1 item em appointment_services
CREATE OR REPLACE FUNCTION public.ensure_appointment_service_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.service_id IS NULL OR NEW.professional_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.appointment_services WHERE appointment_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.appointment_services (
    appointment_id, service_id, professional_id, position, starts_at, duration_minutes, price
  ) VALUES (
    NEW.id, NEW.service_id, NEW.professional_id, 1, NEW.scheduled_at, NEW.duration_minutes, NEW.price
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_appointment_service_row_trg ON public.appointments;
CREATE TRIGGER ensure_appointment_service_row_trg
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.ensure_appointment_service_row();

-- 3) Atualizar notify_new_appointment para listar múltiplos serviços
CREATE OR REPLACE FUNCTION public.notify_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _service_name text;
  _extra_count int := 0;
  _label text;
BEGIN
  SELECT name INTO _service_name FROM public.services WHERE id = NEW.service_id;

  SELECT GREATEST(count(*)::int - 1, 0) INTO _extra_count
  FROM public.appointment_services
  WHERE appointment_id = NEW.id;

  IF _extra_count > 0 THEN
    _label := COALESCE(_service_name, 'um serviço') || ' e mais ' || _extra_count || ' serviço' ||
              CASE WHEN _extra_count > 1 THEN 's' ELSE '' END;
  ELSE
    _label := COALESCE(_service_name, 'um serviço');
  END IF;

  INSERT INTO public.notifications (
    recipient_type, recipient_id, sender_type, title, body, link, data
  ) VALUES (
    'establishment', NEW.establishment_id, 'system',
    'Novo agendamento',
    COALESCE(NEW.client_name, 'Cliente') || ' agendou ' || _label ||
      ' para ' || to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
    '/interno/' || (SELECT slug FROM public.establishments WHERE id = NEW.establishment_id) || '/agenda',
    jsonb_build_object('appointment_id', NEW.id, 'category', 'new_appointment')
  );

  RETURN NEW;
END;
$$;