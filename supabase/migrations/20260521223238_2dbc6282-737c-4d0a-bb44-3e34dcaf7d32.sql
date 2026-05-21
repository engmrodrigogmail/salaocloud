
CREATE TABLE IF NOT EXISTS public.appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id),
  professional_id uuid NOT NULL REFERENCES public.professionals(id),
  position int NOT NULL DEFAULT 1,
  starts_at timestamptz NOT NULL,
  duration_minutes int NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_services_appointment
  ON public.appointment_services (appointment_id, position);
CREATE INDEX IF NOT EXISTS idx_appointment_services_prof_time
  ON public.appointment_services (professional_id, starts_at);

ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appt_services_select"
ON public.appointment_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_services.appointment_id
      AND (
        EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = a.establishment_id AND e.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.professionals p WHERE p.establishment_id = a.establishment_id AND p.user_id = auth.uid() AND p.is_active = true)
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
      )
  )
);

CREATE POLICY "appt_services_insert"
ON public.appointment_services FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_services.appointment_id
      AND (
        EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = a.establishment_id AND e.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.professionals p WHERE p.establishment_id = a.establishment_id AND p.user_id = auth.uid() AND p.is_active = true)
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
      )
  )
);

CREATE POLICY "appt_services_update"
ON public.appointment_services FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_services.appointment_id
      AND (
        EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = a.establishment_id AND e.owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
      )
  )
);

CREATE POLICY "appt_services_delete"
ON public.appointment_services FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_services.appointment_id
      AND (
        EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = a.establishment_id AND e.owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
      )
  )
);

CREATE POLICY "appt_services_public_insert"
ON public.appointment_services FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments a
    JOIN public.establishments e ON e.id = a.establishment_id
    WHERE a.id = appointment_services.appointment_id
      AND e.status = 'active'::establishment_status
  )
);

CREATE POLICY "appt_services_public_select_by_client"
ON public.appointment_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_services.appointment_id
      AND a.client_id IS NOT NULL
  )
);

CREATE TRIGGER trg_appointment_services_updated_at
BEFORE UPDATE ON public.appointment_services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.appointment_services
  (appointment_id, service_id, professional_id, position, starts_at, duration_minutes, price)
SELECT a.id, a.service_id, a.professional_id, 1, a.scheduled_at, a.duration_minutes, COALESCE(a.price, 0)
FROM public.appointments a
WHERE a.service_id IS NOT NULL
  AND a.professional_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.appointment_services s WHERE s.appointment_id = a.id);

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
