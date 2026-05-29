
-- Helper: decide if a professional should see a given tab when privacy is on
CREATE OR REPLACE FUNCTION public.can_professional_view_tab(_user_id uuid, _tab_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT id, establishment_id, professional_id
      FROM public.tabs WHERE id = _tab_id
  ),
  e AS (
    SELECT id, owner_id, COALESCE(privacy_tab_items_per_professional, false) AS privacy_on
      FROM public.establishments
     WHERE id = (SELECT establishment_id FROM t)
  ),
  p AS (
    SELECT id, is_manager, can_close_tabs
      FROM public.professionals
     WHERE establishment_id = (SELECT id FROM e)
       AND user_id = _user_id
       AND is_active = true
     LIMIT 1
  )
  SELECT
    -- Super admin always
    public.has_role(_user_id, 'super_admin'::app_role)
    -- Owner always
    OR EXISTS (SELECT 1 FROM e WHERE owner_id = _user_id)
    -- Privacy off: everyone in the salon can see
    OR EXISTS (SELECT 1 FROM e WHERE NOT privacy_on)
    -- Manager / receptionist (can_close_tabs) always
    OR EXISTS (SELECT 1 FROM p WHERE is_manager = true OR can_close_tabs = true)
    -- Professional is the tab's responsible
    OR EXISTS (
      SELECT 1 FROM t, p WHERE t.professional_id = p.id
    )
    -- Professional has at least one item in this tab
    OR EXISTS (
      SELECT 1 FROM public.tab_items ti, p
       WHERE ti.tab_id = _tab_id AND ti.professional_id = p.id
    );
$$;

-- Restrictive policy: limits SELECT on tabs for professionals when privacy is enabled
DROP POLICY IF EXISTS "Restrict tabs visibility per professional when privacy on" ON public.tabs;

CREATE POLICY "Restrict tabs visibility per professional when privacy on"
ON public.tabs
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.can_professional_view_tab(auth.uid(), id));
