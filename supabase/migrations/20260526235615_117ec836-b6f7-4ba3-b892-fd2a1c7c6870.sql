
-- 1) Flag opcional por salão
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS privacy_tab_items_per_professional boolean NOT NULL DEFAULT false;

-- 2) Helpers SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.tab_privacy_enabled(_tab_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(e.privacy_tab_items_per_professional, false)
    FROM public.tabs t
    JOIN public.establishments e ON e.id = t.establishment_id
   WHERE t.id = _tab_id
$$;

CREATE OR REPLACE FUNCTION public.is_tab_privileged_user(_tab_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.tabs t
       JOIN public.establishments e ON e.id = t.establishment_id
      WHERE t.id = _tab_id AND e.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.tabs t
       JOIN public.professionals p
         ON p.establishment_id = t.establishment_id
        AND p.user_id = auth.uid()
       WHERE t.id = _tab_id
         AND p.is_active = true
         AND p.is_manager = true
    )
$$;

CREATE OR REPLACE FUNCTION public.current_professional_id_for_tab(_tab_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id
    FROM public.tabs t
    JOIN public.professionals p
      ON p.establishment_id = t.establishment_id
     AND p.user_id = auth.uid()
   WHERE t.id = _tab_id
     AND p.is_active = true
   LIMIT 1
$$;

-- 3) Reforço de RLS em tab_items: quando privacidade ligada e usuário NÃO é privilegiado,
--    só pode inserir/alterar/excluir itens cujo professional_id seja o dele.
--    Dono, gerentes e super admin permanecem com acesso total via políticas existentes.
DROP POLICY IF EXISTS "Tab item privacy enforced for common professionals INS" ON public.tab_items;
DROP POLICY IF EXISTS "Tab item privacy enforced for common professionals UPD" ON public.tab_items;
DROP POLICY IF EXISTS "Tab item privacy enforced for common professionals DEL" ON public.tab_items;

CREATE POLICY "Tab item privacy enforced for common professionals INS"
ON public.tab_items
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_tab_privileged_user(tab_id)
  OR NOT public.tab_privacy_enabled(tab_id)
  OR (
    professional_id IS NOT NULL
    AND professional_id = public.current_professional_id_for_tab(tab_id)
  )
);

CREATE POLICY "Tab item privacy enforced for common professionals UPD"
ON public.tab_items
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  public.is_tab_privileged_user(tab_id)
  OR NOT public.tab_privacy_enabled(tab_id)
  OR (
    professional_id IS NOT NULL
    AND professional_id = public.current_professional_id_for_tab(tab_id)
  )
)
WITH CHECK (
  public.is_tab_privileged_user(tab_id)
  OR NOT public.tab_privacy_enabled(tab_id)
  OR (
    professional_id IS NOT NULL
    AND professional_id = public.current_professional_id_for_tab(tab_id)
  )
);

CREATE POLICY "Tab item privacy enforced for common professionals DEL"
ON public.tab_items
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  public.is_tab_privileged_user(tab_id)
  OR NOT public.tab_privacy_enabled(tab_id)
  OR (
    professional_id IS NOT NULL
    AND professional_id = public.current_professional_id_for_tab(tab_id)
  )
);
