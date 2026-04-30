-- ============================================================
-- FASE C - INFRA: PIN de gerente + auditoria
-- ============================================================

-- 1. Adicionar campos em professionals
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_pin_hash text,
  ADD COLUMN IF NOT EXISTS manager_pin_set_at timestamptz;

-- 2. Tabela de auditoria de uso do PIN
CREATE TABLE IF NOT EXISTS public.manager_pin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  manager_professional_id uuid NOT NULL,
  action_type text NOT NULL, -- 'price_override' | 'commission_override' | 'discount_above_limit' | 'reopen_tab' | 'other'
  target_type text, -- 'tab' | 'tab_item' | 'commission'
  target_id uuid,
  tab_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_pin_audit_estab ON public.manager_pin_audit(establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manager_pin_audit_manager ON public.manager_pin_audit(manager_professional_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manager_pin_audit_tab ON public.manager_pin_audit(tab_id);

ALTER TABLE public.manager_pin_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view manager pin audit"
  ON public.manager_pin_audit FOR SELECT
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Owners insert manager pin audit"
  ON public.manager_pin_audit FOR INSERT
  WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Managers insert their own pin audit"
  ON public.manager_pin_audit FOR INSERT
  WITH CHECK (
    manager_professional_id IN (
      SELECT id FROM public.professionals WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins manage all pin audit"
  ON public.manager_pin_audit FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Função para verificar PIN (compara com hash PBKDF2 — mesmo padrão da senha do cliente)
-- O hash é gerado/validado em edge function. Aqui só fazemos comparação.
CREATE OR REPLACE FUNCTION public.verify_manager_pin(_professional_id uuid, _pin_hash text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.professionals
    WHERE id = _professional_id
      AND is_manager = true
      AND manager_pin_hash IS NOT NULL
      AND manager_pin_hash = _pin_hash
  )
$$;

-- 4. Política para profissional gerenciar seu próprio PIN
-- (assume que já existe policy de update para professionals; se não, owners gerenciam tudo)
-- Profissional pode atualizar seu próprio registro para definir o PIN
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'professionals' 
      AND policyname = 'Professionals update own pin'
  ) THEN
    CREATE POLICY "Professionals update own pin"
      ON public.professionals FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- ============================================================
-- BUG FIX: trigger de cancelamento de comanda
-- Antes: ao cancelar, agendamento voltava para 'confirmed' (errado)
-- Agora: agendamento vai para 'cancelled' (correto)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_appointment_on_tab_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tab cancelled => cancel linked appointment (only if it was in_service)
  IF NEW.status = 'cancelled' AND OLD.status = 'open' AND NEW.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
       SET status = 'cancelled'::appointment_status,
           cancelled_reason = COALESCE(cancelled_reason, 'Comanda cancelada'),
           updated_at = now()
     WHERE id = NEW.appointment_id
       AND status = 'in_service'::appointment_status;
  END IF;

  -- Tab closed => mark linked appointment as completed (if still in_service)
  IF NEW.status = 'closed' AND OLD.status = 'open' AND NEW.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
       SET status = 'completed'::appointment_status,
           updated_at = now()
     WHERE id = NEW.appointment_id
       AND status = 'in_service'::appointment_status;
  END IF;

  RETURN NEW;
END;
$$;

-- Garante que o trigger esteja ligado
DROP TRIGGER IF EXISTS trg_sync_appointment_on_tab_status_change ON public.tabs;
CREATE TRIGGER trg_sync_appointment_on_tab_status_change
AFTER UPDATE OF status ON public.tabs
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_appointment_on_tab_status_change();