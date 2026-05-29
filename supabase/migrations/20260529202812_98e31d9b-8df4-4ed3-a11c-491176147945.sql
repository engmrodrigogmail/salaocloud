-- Estende can_professional_view_tab para considerar profissionais vinculados ao
-- agendamento de origem da comanda (multi-profissional via appointment_services).
-- Isso também garante que o INSERT + RETURNING funcione para o profissional que
-- abre a comanda a partir do agendamento, mesmo antes de existirem tab_items.
CREATE OR REPLACE FUNCTION public.can_professional_view_tab(_user_id uuid, _tab_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT id, establishment_id, professional_id, appointment_id
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
    public.has_role(_user_id, 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM e WHERE owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM e WHERE NOT privacy_on)
    OR EXISTS (SELECT 1 FROM p WHERE is_manager = true OR can_close_tabs = true)
    OR EXISTS (SELECT 1 FROM t, p WHERE t.professional_id = p.id)
    OR EXISTS (
      SELECT 1 FROM public.tab_items ti, p
       WHERE ti.tab_id = _tab_id AND ti.professional_id = p.id
    )
    -- NOVO: profissional vinculado ao agendamento de origem (multi-profissional)
    OR EXISTS (
      SELECT 1
        FROM t
        JOIN public.appointment_services aps ON aps.appointment_id = t.appointment_id
        JOIN p ON p.id = aps.professional_id
    )
    -- NOVO: profissional é o titular do agendamento de origem
    OR EXISTS (
      SELECT 1
        FROM t
        JOIN public.appointments a ON a.id = t.appointment_id
        JOIN p ON p.id = a.professional_id
    );
$$;