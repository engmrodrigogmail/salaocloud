-- 1. New privacy column (default TRUE = hide from professionals)
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS privacy_hide_client_contacts_from_professionals boolean NOT NULL DEFAULT true;

-- 2. Security-definer gate: can this user view client contact data for this establishment?
CREATE OR REPLACE FUNCTION public.can_view_client_contacts(_user_id uuid, _establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Super admin sempre
    public.has_role(_user_id, 'super_admin'::app_role)
    OR
    -- Dono do estabelecimento
    EXISTS (
      SELECT 1 FROM public.establishments e
       WHERE e.id = _establishment_id AND e.owner_id = _user_id
    )
    OR
    -- Profissional com cargo de gerente, recepcionista (can_close_tabs) OU salão liberou geral
    EXISTS (
      SELECT 1
        FROM public.professionals p
        JOIN public.establishments e ON e.id = p.establishment_id
       WHERE p.establishment_id = _establishment_id
         AND p.user_id = _user_id
         AND p.is_active = true
         AND (
           p.is_manager = true
           OR p.can_close_tabs = true
           OR COALESCE(e.privacy_hide_client_contacts_from_professionals, true) = false
         )
    )
$$;

-- 3. Substituir a policy de SELECT de profissionais por uma que exija o gate
DROP POLICY IF EXISTS "Professionals can view clients of their establishment" ON public.clients;

CREATE POLICY "Professionals can view clients of their establishment"
ON public.clients
FOR SELECT
USING (
  establishment_id = public.get_professional_establishment_id(auth.uid())
  AND public.can_view_client_contacts(auth.uid(), establishment_id)
);
