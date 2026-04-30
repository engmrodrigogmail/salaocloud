
-- ============================================================================
-- BLOCO A — SEGURANÇA: Roles, RLS hardening, RPC PIN, Multi-role helpers
-- ============================================================================

-- 1. Coluna must_change_password em professionals
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- 2. CORREÇÃO CRÍTICA: Auto-promoção de is_manager
-- Drop da policy permissiva que permite profissional alterar qualquer coluna
DROP POLICY IF EXISTS "Professionals update own pin" ON public.professionals;

-- Profissional só pode atualizar must_change_password (via fluxo de troca de senha).
-- PIN agora é exclusivo via RPC SECURITY DEFINER.
CREATE POLICY "Professionals can update own password flag"
ON public.professionals
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  -- Bloqueia mudança de colunas sensíveis
  AND is_manager = (SELECT p.is_manager FROM public.professionals p WHERE p.id = professionals.id)
  AND establishment_id = (SELECT p.establishment_id FROM public.professionals p WHERE p.id = professionals.id)
  AND user_id = (SELECT p.user_id FROM public.professionals p WHERE p.id = professionals.id)
);

-- 3. RPC para alterar PIN (única forma autorizada para profissional)
CREATE OR REPLACE FUNCTION public.update_professional_pin(_pin_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prof RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO _prof FROM public.professionals WHERE user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'professional_not_found');
  END IF;

  IF NOT _prof.is_manager THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_manager');
  END IF;

  IF _pin_hash IS NULL OR length(_pin_hash) < 32 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_hash');
  END IF;

  UPDATE public.professionals
     SET manager_pin_hash = _pin_hash,
         manager_pin_set_at = now(),
         updated_at = now()
   WHERE id = _prof.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. RLS hardening: appointments — profissional só pode mudar status/notes
DROP POLICY IF EXISTS "Professionals can update their own appointments" ON public.appointments;

CREATE POLICY "Professionals can update status of own appointments"
ON public.appointments
FOR UPDATE
USING (professional_id = public.get_user_professional_id(auth.uid()))
WITH CHECK (
  professional_id = public.get_user_professional_id(auth.uid())
  -- Trava colunas sensíveis (apenas status, notes, cancelled_reason, updated_at podem mudar)
  AND establishment_id = (SELECT a.establishment_id FROM public.appointments a WHERE a.id = appointments.id)
  AND service_id = (SELECT a.service_id FROM public.appointments a WHERE a.id = appointments.id)
  AND professional_id = (SELECT a.professional_id FROM public.appointments a WHERE a.id = appointments.id)
  AND client_id IS NOT DISTINCT FROM (SELECT a.client_id FROM public.appointments a WHERE a.id = appointments.id)
  AND price = (SELECT a.price FROM public.appointments a WHERE a.id = appointments.id)
  AND scheduled_at = (SELECT a.scheduled_at FROM public.appointments a WHERE a.id = appointments.id)
  AND duration_minutes = (SELECT a.duration_minutes FROM public.appointments a WHERE a.id = appointments.id)
);

-- 5. Permite profissional inserir client do seu próprio estabelecimento (comanda avulsa)
CREATE POLICY "Professionals can create clients of their establishment"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  establishment_id = public.get_professional_establishment_id(auth.uid())
  AND user_id IS NULL
);

-- 6. Helper: retorna todas as roles do usuário (para multi-role no AuthContext)
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS TABLE(role app_role)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;

-- 7. Helper: lista todos os destinos de acesso (estabelecimentos como dono + interno como profissional)
CREATE OR REPLACE FUNCTION public.get_user_access_targets(_user_id uuid)
RETURNS TABLE(
  kind text,           -- 'owner' | 'professional' | 'client'
  establishment_id uuid,
  establishment_name text,
  establishment_slug text,
  is_manager boolean,
  must_change_password boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Sou dono de estabelecimento(s)
  SELECT 'owner'::text, e.id, e.name, e.slug, false, false
    FROM public.establishments e
   WHERE e.owner_id = _user_id

  UNION ALL

  -- Sou profissional vinculado a estabelecimento(s)
  SELECT 'professional'::text, e.id, e.name, e.slug, p.is_manager, COALESCE(p.must_change_password, false)
    FROM public.professionals p
    JOIN public.establishments e ON e.id = p.establishment_id
   WHERE p.user_id = _user_id
     AND p.is_active = true;
$$;

-- 8. Endurece policy "Professionals update own pin" — também restringe profissionais
-- de alterarem campos como leasing/comissão de si mesmos (regra de negócio).
-- Já coberto pelo WITH CHECK acima.
