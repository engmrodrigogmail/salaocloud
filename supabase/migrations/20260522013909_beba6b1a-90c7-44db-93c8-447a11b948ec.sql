CREATE OR REPLACE FUNCTION public.update_appointment_services(_appointment_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _appt RECORD;
  _items jsonb := COALESCE(_payload->'items','[]'::jsonb);
  _item jsonb;
  _starts_at timestamptz;
  _dur int;
  _prof uuid;
  _first_start timestamptz := NULL;
  _last_end timestamptz := NULL;
  _total_price numeric := 0;
  _first_service uuid := NULL;
  _first_prof uuid := NULL;
  _conflict_id uuid;
  _notes text := _payload->>'notes';
BEGIN
  SELECT * INTO _appt FROM public.appointments WHERE id = _appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  -- Bloquear edição se comanda fechada
  IF EXISTS (
    SELECT 1 FROM public.tabs WHERE appointment_id = _appointment_id AND status = 'closed'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comanda já está fechada — não é possível editar');
  END IF;

  IF jsonb_array_length(_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum serviço informado');
  END IF;

  -- Validação de conflitos (ignorando o próprio agendamento)
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _starts_at := (_item->>'starts_at')::timestamptz;
    _dur := (_item->>'duration_minutes')::int;
    _prof := (_item->>'professional_id')::uuid;

    SELECT a.id INTO _conflict_id
    FROM public.appointments a
    WHERE a.professional_id = _prof
      AND a.id <> _appointment_id
      AND a.status NOT IN ('cancelled'::appointment_status,'no_show'::appointment_status)
      AND a.scheduled_at < _starts_at + (_dur || ' minutes')::interval
      AND a.scheduled_at + (a.duration_minutes || ' minutes')::interval > _starts_at
    LIMIT 1;
    IF _conflict_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Conflito de horário com outro agendamento do profissional');
    END IF;

    -- conflitos com appointment_services de OUTROS agendamentos
    IF EXISTS (
      SELECT 1 FROM public.appointment_services s
      JOIN public.appointments a ON a.id = s.appointment_id
      WHERE s.professional_id = _prof
        AND s.appointment_id <> _appointment_id
        AND a.status NOT IN ('cancelled'::appointment_status,'no_show'::appointment_status)
        AND s.starts_at < _starts_at + (_dur || ' minutes')::interval
        AND s.starts_at + (s.duration_minutes || ' minutes')::interval > _starts_at
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Conflito com outro serviço do profissional');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.professional_blocked_times b
      WHERE b.professional_id = _prof
        AND b.start_time < _starts_at + (_dur || ' minutes')::interval
        AND b.end_time > _starts_at
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Horário bloqueado para o profissional');
    END IF;
  END LOOP;

  -- Calcular capa
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _starts_at := (_item->>'starts_at')::timestamptz;
    _dur := (_item->>'duration_minutes')::int;
    IF _first_start IS NULL OR _starts_at < _first_start THEN
      _first_start := _starts_at;
      _first_service := (_item->>'service_id')::uuid;
      _first_prof := (_item->>'professional_id')::uuid;
    END IF;
    IF _last_end IS NULL OR _starts_at + (_dur || ' minutes')::interval > _last_end THEN
      _last_end := _starts_at + (_dur || ' minutes')::interval;
    END IF;
    _total_price := _total_price + COALESCE((_item->>'price')::numeric, 0);
  END LOOP;

  -- Substituir lista
  DELETE FROM public.appointment_services WHERE appointment_id = _appointment_id;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.appointment_services (
      appointment_id, service_id, professional_id, position,
      starts_at, duration_minutes, price
    ) VALUES (
      _appointment_id,
      (_item->>'service_id')::uuid,
      (_item->>'professional_id')::uuid,
      COALESCE((_item->>'position')::int, 1),
      (_item->>'starts_at')::timestamptz,
      (_item->>'duration_minutes')::int,
      COALESCE((_item->>'price')::numeric, 0)
    );
  END LOOP;

  -- Atualizar capa
  UPDATE public.appointments
     SET service_id = _first_service,
         professional_id = _first_prof,
         scheduled_at = _first_start,
         duration_minutes = (EXTRACT(EPOCH FROM (_last_end - _first_start))::int) / 60,
         price = _total_price,
         notes = COALESCE(_notes, notes),
         updated_at = now()
   WHERE id = _appointment_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', _appointment_id);
END;
$function$;