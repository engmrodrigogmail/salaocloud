
CREATE OR REPLACE FUNCTION public.notify_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _service_name text;
  _extra_count int := 0;
  _label text;
  _slug text;
  _when text;
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

  SELECT slug INTO _slug FROM public.establishments WHERE id = NEW.establishment_id;
  _when := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI');

  -- Dono / estabelecimento
  INSERT INTO public.notifications (
    recipient_type, recipient_id, sender_type, title, body, link, data
  ) VALUES (
    'establishment', NEW.establishment_id, 'system',
    'Novo agendamento',
    COALESCE(NEW.client_name, 'Cliente') || ' agendou ' || _label || ' para ' || _when,
    '/interno/' || COALESCE(_slug, '') || '/agenda',
    jsonb_build_object('appointment_id', NEW.id, 'category', 'new_appointment')
  );

  -- Profissional escalado
  IF NEW.professional_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_type, recipient_id, sender_type, title, body, link, data
    ) VALUES (
      'professional', NEW.professional_id, 'system',
      'Novo agendamento',
      COALESCE(NEW.client_name, 'Cliente') || ' agendou ' || _label || ' para ' || _when,
      '/interno/' || COALESCE(_slug, '') || '/agenda',
      jsonb_build_object('appointment_id', NEW.id, 'category', 'new_appointment')
    );
  END IF;

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
  _slug text;
  _when text;
  _body text;
BEGIN
  IF NEW.status = 'cancelled'::appointment_status
     AND OLD.status IS DISTINCT FROM 'cancelled'::appointment_status THEN

    SELECT name INTO _service_name FROM public.services WHERE id = NEW.service_id;
    SELECT slug INTO _slug FROM public.establishments WHERE id = NEW.establishment_id;
    _when := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI');
    _body := COALESCE(NEW.client_name, 'Cliente') || ' cancelou ' ||
             COALESCE(_service_name, 'o agendamento') || ' de ' || _when;

    -- Dono / estabelecimento
    INSERT INTO public.notifications (
      recipient_type, recipient_id, sender_type, title, body, link, data
    ) VALUES (
      'establishment', NEW.establishment_id, 'system',
      'Agendamento cancelado',
      _body,
      '/interno/' || COALESCE(_slug, '') || '/agenda',
      jsonb_build_object('appointment_id', NEW.id, 'category', 'cancelled_appointment')
    );

    -- Profissional escalado
    IF NEW.professional_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_type, recipient_id, sender_type, title, body, link, data
      ) VALUES (
        'professional', NEW.professional_id, 'system',
        'Agendamento cancelado',
        _body,
        '/interno/' || COALESCE(_slug, '') || '/agenda',
        jsonb_build_object('appointment_id', NEW.id, 'category', 'cancelled_appointment')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
