-- Recipients
CREATE TABLE public.whatsapp_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  message_type_keys text[] NOT NULL DEFAULT ARRAY['daily_report']::text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_recipients TO authenticated;
GRANT ALL ON public.whatsapp_recipients TO service_role;
ALTER TABLE public.whatsapp_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages recipients"
  ON public.whatsapp_recipients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE TRIGGER trg_whatsapp_recipients_updated
  BEFORE UPDATE ON public.whatsapp_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Message types (templates)
CREATE TABLE public.whatsapp_message_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_message_types TO authenticated;
GRANT ALL ON public.whatsapp_message_types TO service_role;
ALTER TABLE public.whatsapp_message_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages message types"
  ON public.whatsapp_message_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE TRIGGER trg_whatsapp_message_types_updated
  BEFORE UPDATE ON public.whatsapp_message_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Send log
CREATE TABLE public.whatsapp_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type_key text NOT NULL,
  recipient_id uuid REFERENCES public.whatsapp_recipients(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  recipient_name text,
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  zapi_message_id text,
  zapi_response jsonb,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_send_log TO authenticated;
GRANT ALL ON public.whatsapp_send_log TO service_role;
ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin reads log"
  ON public.whatsapp_send_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "super admin writes log"
  ON public.whatsapp_send_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE INDEX idx_whatsapp_send_log_created ON public.whatsapp_send_log (created_at DESC);
CREATE INDEX idx_whatsapp_send_log_type ON public.whatsapp_send_log (message_type_key, created_at DESC);

-- Seed default message type: daily_report
INSERT INTO public.whatsapp_message_types (key, label, description, template) VALUES (
  'daily_report',
  'Resumo Diário',
  'Relatório diário enviado às 20:59 (horário de São Paulo) com indicadores da plataforma.',
$$📊 *Resumo Diário — Salão Cloud*
🗓️ {{date}}

*🔌 Conectores*
{{connectors_section}}

*🌐 Landing Page*
• Visualizações hoje: {{lp_views_today}}
• Visualizações 7d: {{lp_views_7d}}
• Top 3 páginas:
{{top_pages}}

*🤖 Silvia (assistente)*
• Acionamentos hoje: {{silvia_triggers_today}}
• Acionamentos 7d: {{silvia_triggers_7d}}

*🏢 Operacional*
• Novos salões hoje: {{new_salons_today}}
• Salões ativos: {{active_salons}}
• Trials ativos: {{active_trials}}
• Assinaturas ativas: {{active_subscriptions}}
• Receita estimada (mês): R$ {{mrr}}

_Enviado automaticamente — Salão Cloud._$$
);