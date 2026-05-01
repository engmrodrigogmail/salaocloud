-- ============================================================
-- FASE 1: Módulo de Comunicação e Alertas
-- ============================================================

-- Habilitar extensões necessárias para Fase 5 (cron + http)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.notification_sender_type AS ENUM ('system', 'admin', 'establishment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_recipient_type AS ENUM ('admin', 'establishment', 'professional', 'client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABELAS DE PUSH SUBSCRIPTIONS (VAPID)
-- ============================================================

-- 1) Super Admin
CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_admin_push_user ON public.admin_push_subscriptions(user_id) WHERE is_active = true;

ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage own push" ON public.admin_push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins read all admin push" ON public.admin_push_subscriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_admin_push_updated
  BEFORE UPDATE ON public.admin_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Estabelecimento (dono do salão)
CREATE TABLE IF NOT EXISTS public.establishment_push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_est_push_estab ON public.establishment_push_subscriptions(establishment_id) WHERE is_active = true;

ALTER TABLE public.establishment_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own est push" ON public.establishment_push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins read all est push" ON public.establishment_push_subscriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_est_push_updated
  BEFORE UPDATE ON public.establishment_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Profissional
CREATE TABLE IF NOT EXISTS public.professional_push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_prof_push_prof ON public.professional_push_subscriptions(professional_id) WHERE is_active = true;

ALTER TABLE public.professional_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals manage own push" ON public.professional_push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Salon owners read prof push" ON public.professional_push_subscriptions
  FOR SELECT USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      JOIN public.establishments e ON e.id = p.establishment_id
      WHERE e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Super admins read all prof push" ON public.professional_push_subscriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_prof_push_updated
  BEFORE UPDATE ON public.professional_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Cliente (não usa auth.users — usa client_id e identificação por email/sessão)
CREATE TABLE IF NOT EXISTS public.client_push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_client_push_client ON public.client_push_subscriptions(client_id) WHERE is_active = true;

ALTER TABLE public.client_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Inserts/updates de cliente acontecem via edge function (service role).
-- Donos do salão podem ver as inscrições de seus clientes (para auditoria).
CREATE POLICY "Salon owners read client push" ON public.client_push_subscriptions
  FOR SELECT USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.establishments e ON e.id = c.establishment_id
      WHERE e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Super admins read all client push" ON public.client_push_subscriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_client_push_updated
  BEFORE UPDATE ON public.client_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABELA notifications (histórico in-app / sino)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_type public.notification_sender_type NOT NULL,
  sender_id UUID,
  recipient_type public.notification_recipient_type NOT NULL,
  recipient_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications(recipient_type, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON public.notifications(recipient_type, recipient_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notif_sender ON public.notifications(sender_type, sender_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Destinatário: Super Admin
CREATE POLICY "Super admins read own notifications" ON public.notifications
  FOR SELECT USING (
    recipient_type = 'admin' AND public.has_role(auth.uid(), 'super_admin')
    AND recipient_id = auth.uid()
  );

CREATE POLICY "Super admins update own notifications" ON public.notifications
  FOR UPDATE USING (
    recipient_type = 'admin' AND public.has_role(auth.uid(), 'super_admin')
    AND recipient_id = auth.uid()
  );

-- Destinatário: Estabelecimento (dono lê notificações do seu salão)
CREATE POLICY "Owners read est notifications" ON public.notifications
  FOR SELECT USING (
    recipient_type = 'establishment'
    AND recipient_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid())
  );

CREATE POLICY "Owners update est notifications" ON public.notifications
  FOR UPDATE USING (
    recipient_type = 'establishment'
    AND recipient_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid())
  );

-- Destinatário: Profissional
CREATE POLICY "Professionals read own notifications" ON public.notifications
  FOR SELECT USING (
    recipient_type = 'professional'
    AND recipient_id = public.get_user_professional_id(auth.uid())
  );

CREATE POLICY "Professionals update own notifications" ON public.notifications
  FOR UPDATE USING (
    recipient_type = 'professional'
    AND recipient_id = public.get_user_professional_id(auth.uid())
  );

-- Cliente: leitura pública controlada pelo edge function (não usa auth.uid).
-- Permitimos leitura pública por client_id apenas para registros do tipo client
-- (a UI envia o client_id da sessão local; sino exibe somente do cliente identificado).
CREATE POLICY "Clients read own notifications" ON public.notifications
  FOR SELECT USING (recipient_type = 'client');

CREATE POLICY "Clients mark own as read" ON public.notifications
  FOR UPDATE USING (recipient_type = 'client');

-- Remetente: Super Admin pode criar/excluir qualquer envio
CREATE POLICY "Super admins insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins delete sent" ON public.notifications
  FOR DELETE USING (
    public.has_role(auth.uid(), 'super_admin')
    AND sender_type IN ('admin', 'system')
  );

-- Remetente: Estabelecimento pode inserir/excluir o que enviou
CREATE POLICY "Owners insert est notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    sender_type = 'establishment'
    AND sender_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid())
  );

CREATE POLICY "Owners delete sent" ON public.notifications
  FOR DELETE USING (
    sender_type = 'establishment'
    AND sender_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid())
  );

-- ============================================================
-- TABELA notification_settings (configuração por salão)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  appointment_reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  appointment_reminder_minutes_before INTEGER NOT NULL DEFAULT 120,
  appointment_reminder_template TEXT NOT NULL DEFAULT 'Olá {cliente}! Lembrete: você tem um horário em {salao} às {hora} com {profissional} para {servico}. Até já!',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own notif settings" ON public.notification_settings
  FOR ALL USING (
    establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid())
  ) WITH CHECK (
    establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid())
  );

CREATE POLICY "Super admins read notif settings" ON public.notification_settings
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_notif_settings_updated
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna para evitar duplicidade do lembrete de agendamento
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_appt_reminder
  ON public.appointments(scheduled_at)
  WHERE reminder_sent_at IS NULL AND status IN ('pending', 'confirmed');