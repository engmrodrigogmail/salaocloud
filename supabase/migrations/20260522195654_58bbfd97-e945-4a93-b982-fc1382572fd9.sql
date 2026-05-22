CREATE OR REPLACE FUNCTION public.create_appointment_with_services(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _est_id uuid := (_payload->>'establishment_id')::uuid;
  _client_id uuid := NULLIF(_payload->>'client_id','')::uuid;
  _client_name text := _payload->>'client_name';
  _client_phone text := _payload->>'client_phone';
  _client_email text := _payload->>'client_email';
  _notes text := _payload->>'notes';
  _status text := COALESCE(_payload->>'status','confirmed');
  _items jsonb := COALESCE(_payload->'items','[]'::jsonb);
  _allow_overlap boolean := COALESCE((_payload->>'allow_overlap')::boolean, false);
  _item jsonb;
  _appt_id uuid;
  _first_start timestamptz := NULL;
  _last_end timestamptz := NULL;
  _total_price numeric := 0;
  _first_service uuid := NULL;
  _first_prof uuid := NULL;
  _starts_at timestamptz;
  _dur int;
  _price numeric;
  _prof uuid;
  _conflict_id uuid;
BEGIN
  IF jsonb_array_length(_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum serviço informado');
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _starts_at := (_item->>'starts_at')::timestamptz;
    _dur := (_item->>'duration_minutes')::int;
    _prof := (_item->>'professional_id')::uuid;

    IF NOT _allow_overlap THEN
      SELECT a.id INTO _conflict_id
      FROM public.appointments a
      WHERE a.professional_id = _prof
        AND a.status NOT IN ('cancelled'::appointment_status,'no_show'::appointment_status)
        AND a.scheduled_at < _starts_at + (_dur || ' minutes')::interval
        AND a.scheduled_at + (a.duration_minutes || ' minutes')::interval > _starts_at
      LIMIT 1;
      IF _conflict_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Conflito de horário com outro agendamento do profissional', 'conflict_appointment_id', _conflict_id);
      END IF;
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

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _starts_at := (_item->>'starts_at')::timestamptz;
    _dur := (_item->>'duration_minutes')::int;
    _price := COALESCE((_item->>'price')::numeric, 0);
    IF _first_start IS NULL OR _starts_at < _first_start THEN
      _first_start := _starts_at;
      _first_service := (_item->>'service_id')::uuid;
      _first_prof := (_item->>'professional_id')::uuid;
    END IF;
    IF _last_end IS NULL OR _starts_at + (_dur || ' minutes')::interval > _last_end THEN
      _last_end := _starts_at + (_dur || ' minutes')::interval;
    END IF;
    _total_price := _total_price + _price;
  END LOOP;

  INSERT INTO public.appointments (
    establishment_id, service_id, professional_id, client_id,
    client_name, client_phone, client_email,
    scheduled_at, duration_minutes, price, notes, status
  ) VALUES (
    _est_id, _first_service, _first_prof, _client_id,
    _client_name, _client_phone, _client_email,
    _first_start,
    (EXTRACT(EPOCH FROM (_last_end - _first_start))::int) / 60,
    _total_price, _notes, _status::appointment_status
  ) RETURNING id INTO _appt_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.appointment_services (
      appointment_id, service_id, professional_id, position,
      starts_at, duration_minutes, price
    ) VALUES (
      _appt_id,
      (_item->>'service_id')::uuid,
      (_item->>'professional_id')::uuid,
      COALESCE((_item->>'position')::int, 1),
      (_item->>'starts_at')::timestamptz,
      (_item->>'duration_minutes')::int,
      COALESCE((_item->>'price')::numeric, 0)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'appointment_id', _appt_id);
END;
$$;