-- training_vendor_profiles
CREATE TABLE IF NOT EXISTS public.training_vendor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  cpf text,
  phone text,
  city text,
  uf text,
  must_change_password boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_vendor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor reads own profile" ON public.training_vendor_profiles FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "vendor updates own profile" ON public.training_vendor_profiles FOR UPDATE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super_admin manages vendor profiles" ON public.training_vendor_profiles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_training_vendor_profiles_updated_at
  BEFORE UPDATE ON public.training_vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- training_modules
CREATE TABLE IF NOT EXISTS public.training_modules (
  id integer PRIMARY KEY,
  title text NOT NULL,
  profile text NOT NULL CHECK (profile IN ('admin','professional','receptionist','client')),
  view text NOT NULL CHECK (view IN ('portal','interno','cliente')),
  iframe_path text,
  screenshot_url text,
  display_order integer NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainees read modules" ON public.training_modules FOR SELECT
  USING (
    is_active = true AND (
      public.has_role(auth.uid(), 'sales_trainee') OR public.has_role(auth.uid(), 'super_admin')
    )
  );
CREATE POLICY "super_admin manages modules" ON public.training_modules FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_training_modules_updated_at
  BEFORE UPDATE ON public.training_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- training_user_progress
CREATE TABLE IF NOT EXISTS public.training_user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id integer NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  checklist_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_training_progress_user ON public.training_user_progress(user_id);
ALTER TABLE public.training_user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor reads own progress" ON public.training_user_progress FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "vendor inserts own progress" ON public.training_user_progress FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "vendor updates own progress" ON public.training_user_progress FOR UPDATE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_training_progress_updated_at
  BEFORE UPDATE ON public.training_user_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- training_quiz_attempts
CREATE TABLE IF NOT EXISTS public.training_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id integer NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  answers jsonb NOT NULL,
  score integer NOT NULL,
  total integer NOT NULL,
  passed boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_training_attempts_user ON public.training_quiz_attempts(user_id);
ALTER TABLE public.training_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor reads own attempts" ON public.training_quiz_attempts FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "vendor inserts own attempts" ON public.training_quiz_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- training_certificates
CREATE TABLE IF NOT EXISTS public.training_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile text NOT NULL CHECK (profile IN ('admin','professional','receptionist','client','complete')),
  code uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profile)
);
ALTER TABLE public.training_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor reads own certificates" ON public.training_certificates FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "system inserts certificates" ON public.training_certificates FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- Trigger: emite certificado quando todos os módulos do perfil concluídos
CREATE OR REPLACE FUNCTION public.maybe_issue_training_certificate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _profile text;
  _total integer;
  _done integer;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  SELECT profile INTO _profile FROM public.training_modules WHERE id = NEW.module_id;
  IF _profile IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO _total FROM public.training_modules WHERE profile = _profile AND is_active = true;
  SELECT count(*) INTO _done FROM public.training_user_progress p
    JOIN public.training_modules m ON m.id = p.module_id
   WHERE p.user_id = NEW.user_id AND m.profile = _profile AND p.status = 'completed' AND m.is_active = true;
  IF _done >= _total AND _total > 0 THEN
    INSERT INTO public.training_certificates (user_id, profile)
    VALUES (NEW.user_id, _profile)
    ON CONFLICT (user_id, profile) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_maybe_issue_training_certificate
  AFTER INSERT OR UPDATE OF status ON public.training_user_progress
  FOR EACH ROW EXECUTE FUNCTION public.maybe_issue_training_certificate();

-- Auto-cria profile do vendedor ao receber role
CREATE OR REPLACE FUNCTION public.handle_new_sales_trainee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'sales_trainee' THEN
    INSERT INTO public.training_vendor_profiles (user_id, must_change_password)
    VALUES (NEW.user_id, true)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_new_sales_trainee
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_sales_trainee();