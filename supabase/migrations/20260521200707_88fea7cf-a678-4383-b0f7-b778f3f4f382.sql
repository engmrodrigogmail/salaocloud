CREATE OR REPLACE FUNCTION public.notify_new_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _service_name text;
BEGIN
  SELECT name INTO _service_name FROM public.services WHERE id = NEW.service_id;

  INSERT INTO public.notifications (
    recipient_type, recipient_id, sender_type, title, body, link, data
  ) VALUES (
    'establishment', NEW.establishment_id, 'system',
    'Novo agendamento',
    COALESCE(NEW.client_name, 'Cliente') || ' agendou ' || COALESCE(_service_name, 'um serviço') ||
      ' para ' || to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
    '/interno/' || (SELECT slug FROM public.establishments WHERE id = NEW.establishment_id) || '/agenda',
    jsonb_build_object('appointment_id', NEW.id, 'category', 'new_appointment')
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_appointment_cancelled()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      '/interno/' || (SELECT slug FROM public.establishments WHERE id = NEW.establishment_id) || '/agenda',
      jsonb_build_object('appointment_id', NEW.id, 'category', 'cancelled_appointment')
    );
  END IF;

  RETURN NEW;
END;
$function$;