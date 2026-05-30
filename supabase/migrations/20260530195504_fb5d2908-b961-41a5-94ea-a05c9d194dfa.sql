-- Permitir owner e profissionais ativos criarem/atualizarem comandas
-- Mantém a privacidade de itens (tab_items) e a policy RESTRICTIVE de SELECT em tabs

-- 1. Owner pode inserir comandas no próprio salão
DROP POLICY IF EXISTS "Owner can insert tabs in their establishment" ON public.tabs;
CREATE POLICY "Owner can insert tabs in their establishment"
ON public.tabs FOR INSERT
WITH CHECK (
  establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_id = auth.uid()
  )
);

-- 2. Profissional ativo pode inserir comandas no salão
DROP POLICY IF EXISTS "Professionals can insert tabs in their establishment" ON public.tabs;
CREATE POLICY "Professionals can insert tabs in their establishment"
ON public.tabs FOR INSERT
WITH CHECK (
  establishment_id IN (
    SELECT establishment_id FROM public.professionals
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- 3. Profissional ativo pode atualizar comandas do salão
DROP POLICY IF EXISTS "Professionals can update tabs in their establishment" ON public.tabs;
CREATE POLICY "Professionals can update tabs in their establishment"
ON public.tabs FOR UPDATE
USING (
  establishment_id IN (
    SELECT establishment_id FROM public.professionals
    WHERE user_id = auth.uid() AND is_active = true
  )
)
WITH CHECK (
  establishment_id IN (
    SELECT establishment_id FROM public.professionals
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- 4. Profissional ativo pode visualizar comandas do salão (privacidade fica na RESTRICTIVE)
DROP POLICY IF EXISTS "Professionals can view and update tabs of their establishment" ON public.tabs;
DROP POLICY IF EXISTS "Professionals can view tabs of their establishment" ON public.tabs;
CREATE POLICY "Professionals can view tabs of their establishment"
ON public.tabs FOR SELECT
USING (
  establishment_id IN (
    SELECT establishment_id FROM public.professionals
    WHERE user_id = auth.uid() AND is_active = true
  )
);