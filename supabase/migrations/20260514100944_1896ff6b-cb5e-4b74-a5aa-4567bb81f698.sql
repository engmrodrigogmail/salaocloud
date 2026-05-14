-- 1. Columns on vendor profile
ALTER TABLE public.training_vendor_profiles
  ADD COLUMN IF NOT EXISTS sandbox_establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sandbox_created_at timestamptz;

-- 2. Block 'establishment' role for demo establishments
CREATE OR REPLACE FUNCTION public.assign_establishment_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_demo, false) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.owner_id, 'establishment'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Hide demo establishments from owner access targets
CREATE OR REPLACE FUNCTION public.get_user_access_targets_full(_user_id uuid, _email text DEFAULT NULL::text)
 RETURNS TABLE(kind text, establishment_id uuid, establishment_name text, establishment_slug text, establishment_logo_url text, is_manager boolean, must_change_password boolean, client_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'owner'::text, e.id, e.name, e.slug, e.logo_url,
         false, false, NULL::uuid
    FROM public.establishments e
   WHERE _user_id IS NOT NULL
     AND e.owner_id = _user_id
     AND COALESCE(e.is_demo, false) = false

  UNION ALL

  SELECT 'professional'::text, e.id, e.name, e.slug, e.logo_url,
         p.is_manager, COALESCE(p.must_change_password, false), NULL::uuid
    FROM public.professionals p
    JOIN public.establishments e ON e.id = p.establishment_id
   WHERE _user_id IS NOT NULL
     AND p.user_id = _user_id
     AND p.is_active = true

  UNION ALL

  SELECT 'client'::text, e.id, e.name, e.slug, e.logo_url,
         false, false, c.id
    FROM public.clients c
    JOIN public.establishments e ON e.id = c.establishment_id
   WHERE _email IS NOT NULL
     AND lower(trim(_email)) <> ''
     AND e.status = 'active'::establishment_status
     AND COALESCE(e.is_demo, false) = false
     AND (
       lower(coalesce(c.global_identity_email, '')) = lower(trim(_email))
       OR lower(coalesce(c.email, '')) = lower(trim(_email))
     );
$function$;

-- 4. Allow trainee to write only on own sandbox
CREATE OR REPLACE FUNCTION public.prevent_demo_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row jsonb;
  _est_id uuid;
  _is_demo boolean;
BEGIN
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _row := COALESCE(to_jsonb(NEW), to_jsonb(OLD));

  IF _row ? 'establishment_id' THEN
    _est_id := NULLIF(_row->>'establishment_id','')::uuid;
  ELSIF TG_TABLE_NAME = 'notifications' AND (_row->>'recipient_type') = 'establishment' THEN
    _est_id := NULLIF(_row->>'recipient_id','')::uuid;
  END IF;

  IF _est_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT is_demo INTO _is_demo FROM public.establishments WHERE id = _est_id;
  IF NOT COALESCE(_is_demo, false) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Demo: allow trainee on own sandbox
  IF EXISTS (
    SELECT 1 FROM public.training_vendor_profiles
     WHERE user_id = auth.uid()
       AND sandbox_establishment_id = _est_id
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION 'Operação bloqueada: salão de demonstração é somente leitura' USING ERRCODE = '42501';
END;
$$;

-- 5. Provision sandbox
CREATE OR REPLACE FUNCTION public.provision_training_sandbox()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _existing uuid;
  _existing_slug text;
  _master uuid;
  _new_id uuid;
  _slug text;
  _short text;
  _shift interval;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(_user, 'sales_trainee'::app_role) OR public.has_role(_user, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Ensure profile row exists (super_admin testing might not have one)
  INSERT INTO public.training_vendor_profiles (user_id, must_change_password)
    VALUES (_user, false)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT sandbox_establishment_id INTO _existing
    FROM public.training_vendor_profiles WHERE user_id = _user;

  IF _existing IS NOT NULL THEN
    SELECT slug INTO _existing_slug FROM public.establishments WHERE id = _existing;
    IF _existing_slug IS NOT NULL THEN
      RETURN jsonb_build_object('establishment_id', _existing, 'slug', _existing_slug, 'created', false);
    ELSE
      -- dangling reference; clear
      UPDATE public.training_vendor_profiles
         SET sandbox_establishment_id = NULL, sandbox_created_at = NULL
       WHERE user_id = _user;
    END IF;
  END IF;

  SELECT id INTO _master FROM public.establishments WHERE slug = 'demo-treinamento';
  IF _master IS NULL THEN
    RAISE EXCEPTION 'master_demo_not_found';
  END IF;

  _short := substring(replace(_user::text, '-', '') from 1 for 8);
  _slug := 'treino-' || _short || '-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4);

  INSERT INTO public.establishments (
    owner_id, name, slug, description, working_hours,
    status, subscription_plan, is_demo
  )
  SELECT _user, name || ' (treino)', _slug, description, working_hours,
         'active'::establishment_status, subscription_plan, true
    FROM public.establishments WHERE id = _master
  RETURNING id INTO _new_id;

  -- mapping tables
  CREATE TEMP TABLE IF NOT EXISTS _prof_map (old_id uuid, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _svc_map  (old_id uuid, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _cli_map  (old_id uuid, new_id uuid) ON COMMIT DROP;
  TRUNCATE _prof_map; TRUNCATE _svc_map; TRUNCATE _cli_map;

  -- Professionals
  INSERT INTO _prof_map (old_id, new_id)
    SELECT id, gen_random_uuid() FROM public.professionals WHERE establishment_id = _master;
  INSERT INTO public.professionals (
    id, establishment_id, name, email, phone, avatar_url, specialties,
    working_hours, is_active, is_manager
  )
  SELECT m.new_id, _new_id, p.name, p.email, p.phone, p.avatar_url, p.specialties,
         p.working_hours, p.is_active, p.is_manager
    FROM public.professionals p JOIN _prof_map m ON m.old_id = p.id
   WHERE p.establishment_id = _master;

  -- Services
  INSERT INTO _svc_map (old_id, new_id)
    SELECT id, gen_random_uuid() FROM public.services WHERE establishment_id = _master;
  INSERT INTO public.services (
    id, establishment_id, name, description, duration_minutes, price, is_active
  )
  SELECT m.new_id, _new_id, s.name, s.description, s.duration_minutes, s.price, s.is_active
    FROM public.services s JOIN _svc_map m ON m.old_id = s.id;

  -- Clients
  INSERT INTO _cli_map (old_id, new_id)
    SELECT id, gen_random_uuid() FROM public.clients WHERE establishment_id = _master;
  INSERT INTO public.clients (
    id, establishment_id, name, email, phone, notes
  )
  SELECT m.new_id, _new_id, c.name, c.email, c.phone, c.notes
    FROM public.clients c JOIN _cli_map m ON m.old_id = c.id;

  -- Appointments — shift dates so the earliest one becomes today
  SELECT date_trunc('day', now()) - date_trunc('day', min(scheduled_at))
    INTO _shift
    FROM public.appointments WHERE establishment_id = _master;
  IF _shift IS NULL THEN _shift := interval '0'; END IF;

  INSERT INTO public.appointments (
    establishment_id, professional_id, service_id, client_id,
    client_name, client_phone, client_email,
    scheduled_at, duration_minutes, price, status, notes
  )
  SELECT _new_id,
         pm.new_id,
         sm.new_id,
         cm.new_id,
         a.client_name, a.client_phone, a.client_email,
         a.scheduled_at + _shift,
         a.duration_minutes, a.price, a.status, a.notes
    FROM public.appointments a
    LEFT JOIN _prof_map pm ON pm.old_id = a.professional_id
    LEFT JOIN _svc_map  sm ON sm.old_id = a.service_id
    LEFT JOIN _cli_map  cm ON cm.old_id = a.client_id
   WHERE a.establishment_id = _master
     AND pm.new_id IS NOT NULL
     AND sm.new_id IS NOT NULL;

  UPDATE public.training_vendor_profiles
     SET sandbox_establishment_id = _new_id,
         sandbox_created_at = now()
   WHERE user_id = _user;

  RETURN jsonb_build_object('establishment_id', _new_id, 'slug', _slug, 'created', true);
END;
$$;

-- 6. Reset
CREATE OR REPLACE FUNCTION public.reset_training_sandbox()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _existing uuid;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT sandbox_establishment_id INTO _existing
    FROM public.training_vendor_profiles WHERE user_id = _user;

  IF _existing IS NOT NULL THEN
    DELETE FROM public.establishments
     WHERE id = _existing
       AND is_demo = true
       AND slug LIKE 'treino-%';
    UPDATE public.training_vendor_profiles
       SET sandbox_establishment_id = NULL, sandbox_created_at = NULL
     WHERE user_id = _user;
  END IF;

  RETURN public.provision_training_sandbox();
END;
$$;

-- 7. TTL purge (30 days)
CREATE OR REPLACE FUNCTION public.purge_expired_training_sandboxes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer;
BEGIN
  WITH d AS (
    DELETE FROM public.establishments
     WHERE is_demo = true
       AND slug LIKE 'treino-%'
       AND created_at < now() - interval '30 days'
    RETURNING id
  ) SELECT count(*) INTO _n FROM d;
  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_training_sandbox() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_training_sandbox() TO authenticated;