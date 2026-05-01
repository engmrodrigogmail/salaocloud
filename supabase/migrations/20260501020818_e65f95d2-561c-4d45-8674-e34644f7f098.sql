-- RPC unificada: retorna TODOS os destinos de acesso de um usuário
-- Inclui owner (estabelecimentos próprios), professional (vínculos ativos)
-- e client (vínculos por email — global_identity_email ou email).

CREATE OR REPLACE FUNCTION public.get_user_access_targets_full(
  _user_id uuid,
  _email text DEFAULT NULL
)
RETURNS TABLE(
  kind text,
  establishment_id uuid,
  establishment_name text,
  establishment_slug text,
  establishment_logo_url text,
  is_manager boolean,
  must_change_password boolean,
  client_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Dono(s)
  SELECT 'owner'::text, e.id, e.name, e.slug, e.logo_url,
         false, false, NULL::uuid
    FROM public.establishments e
   WHERE _user_id IS NOT NULL
     AND e.owner_id = _user_id

  UNION ALL

  -- Profissional vinculado (ativo)
  SELECT 'professional'::text, e.id, e.name, e.slug, e.logo_url,
         p.is_manager, COALESCE(p.must_change_password, false), NULL::uuid
    FROM public.professionals p
    JOIN public.establishments e ON e.id = p.establishment_id
   WHERE _user_id IS NOT NULL
     AND p.user_id = _user_id
     AND p.is_active = true

  UNION ALL

  -- Cliente vinculado por email (global_identity_email OU email local)
  SELECT 'client'::text, e.id, e.name, e.slug, e.logo_url,
         false, false, c.id
    FROM public.clients c
    JOIN public.establishments e ON e.id = c.establishment_id
   WHERE _email IS NOT NULL
     AND lower(trim(_email)) <> ''
     AND e.status = 'active'::establishment_status
     AND (
       lower(coalesce(c.global_identity_email, '')) = lower(trim(_email))
       OR lower(coalesce(c.email, '')) = lower(trim(_email))
     );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_access_targets_full(uuid, text) TO anon, authenticated;