-- ========================================
-- 1) Tabela de sessões de cliente
-- ========================================
CREATE TABLE IF NOT EXISTS public.client_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '180 days'),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_sessions_client ON public.client_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_sessions_expires ON public.client_sessions(expires_at);

ALTER TABLE public.client_sessions ENABLE ROW LEVEL SECURITY;

-- Ninguém acessa diretamente; só via edge functions (service role).
CREATE POLICY "client_sessions service only select"
  ON public.client_sessions FOR SELECT USING (false);
CREATE POLICY "client_sessions service only insert"
  ON public.client_sessions FOR INSERT WITH CHECK (false);
CREATE POLICY "client_sessions service only update"
  ON public.client_sessions FOR UPDATE USING (false);
CREATE POLICY "client_sessions service only delete"
  ON public.client_sessions FOR DELETE USING (false);

-- ========================================
-- 2) Bloqueia acesso público às notifications de clientes
-- ========================================
DROP POLICY IF EXISTS "Clients read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Clients mark own as read" ON public.notifications;

-- Acesso a notificações de clientes deve passar exclusivamente pela edge function
-- 'client-notifications-list', que valida token de sessão e usa service role.

-- ========================================
-- 3) Owner pode ler/excluir notificações enviadas por seu estabelecimento
--    (para qualquer recipient — necessário no histórico de envios do Portal)
-- ========================================
DROP POLICY IF EXISTS "Owners read sent notifications" ON public.notifications;
CREATE POLICY "Owners read sent notifications"
  ON public.notifications FOR SELECT
  USING (
    sender_type = 'establishment'::notification_sender_type
    AND sender_id IN (
      SELECT id FROM public.establishments WHERE owner_id = auth.uid()
    )
  );

-- (a policy de DELETE 'Owners delete sent' já existe e cobre o caso)

-- ========================================
-- 4) Super admin pode ler todas as notificações enviadas por ele
-- ========================================
DROP POLICY IF EXISTS "Super admins read sent notifications" ON public.notifications;
CREATE POLICY "Super admins read sent notifications"
  ON public.notifications FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    AND sender_type = 'admin'::notification_sender_type
  );

-- ========================================
-- 5) Função utilitária: validar token de sessão de cliente
-- ========================================
CREATE OR REPLACE FUNCTION public.validate_client_session(_token_hash text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.client_sessions
   WHERE token_hash = _token_hash
     AND expires_at > now()
   LIMIT 1
$$;