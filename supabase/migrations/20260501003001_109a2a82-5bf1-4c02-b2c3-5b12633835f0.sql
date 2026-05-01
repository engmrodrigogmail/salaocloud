-- Backfill: garantir que todo dono de estabelecimento tenha a role 'establishment' em user_roles.
-- Isso fecha o gap onde has_role(uid, 'establishment') retornava false para donos antigos.
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT e.owner_id, 'establishment'::app_role
FROM public.establishments e
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = e.owner_id AND ur.role = 'establishment'::app_role
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Trigger: ao criar um novo establishment, atribuir automaticamente a role 'establishment' ao owner.
CREATE OR REPLACE FUNCTION public.assign_establishment_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.owner_id, 'establishment'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_establishment_role ON public.establishments;
CREATE TRIGGER trg_assign_establishment_role
AFTER INSERT ON public.establishments
FOR EACH ROW EXECUTE FUNCTION public.assign_establishment_role();