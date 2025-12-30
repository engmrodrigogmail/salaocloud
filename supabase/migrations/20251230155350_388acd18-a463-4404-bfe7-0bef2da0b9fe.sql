-- Tabela de configuração da assistente virtual por estabelecimento
CREATE TABLE public.establishment_ai_assistant (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  assistant_name TEXT NOT NULL DEFAULT 'Assistente',
  language_style TEXT NOT NULL DEFAULT 'casual' CHECK (language_style IN ('casual', 'formal')),
  availability_mode TEXT NOT NULL DEFAULT '24h_with_message' CHECK (availability_mode IN ('only_business_hours', '24h_with_message')),
  working_hours JSONB DEFAULT '{"monday":{"start":"09:00","end":"18:00","enabled":true},"tuesday":{"start":"09:00","end":"18:00","enabled":true},"wednesday":{"start":"09:00","end":"18:00","enabled":true},"thursday":{"start":"09:00","end":"18:00","enabled":true},"friday":{"start":"09:00","end":"18:00","enabled":true},"saturday":{"start":"09:00","end":"13:00","enabled":true},"sunday":{"enabled":false}}'::jsonb,
  welcome_message TEXT,
  offline_message TEXT DEFAULT 'Olá! No momento estou fora do horário de atendimento. Deixe sua mensagem e entrarei em contato assim que possível.',
  escalation_whatsapp TEXT,
  custom_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de uso mensal da assistente (controle de limites no trial)
CREATE TABLE public.ai_assistant_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  voice_messages_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, month_year)
);

-- Tabela de conversas do chat da assistente
CREATE TABLE public.ai_assistant_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id),
  client_phone TEXT,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'escalated', 'closed')),
  channel TEXT NOT NULL DEFAULT 'portal' CHECK (channel IN ('portal', 'whatsapp')),
  escalated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de mensagens do chat
CREATE TABLE public.ai_assistant_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_assistant_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'assistant', 'human')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'action')),
  content TEXT NOT NULL,
  voice_url TEXT,
  voice_transcription TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de fila de espera
CREATE TABLE public.ai_assistant_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id),
  client_phone TEXT NOT NULL,
  client_name TEXT NOT NULL,
  service_id UUID REFERENCES public.services(id),
  professional_id UUID REFERENCES public.professionals(id),
  preferred_date DATE NOT NULL,
  preferred_time_start TIME,
  preferred_time_end TIME,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'expired', 'cancelled')),
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para configuração do addon da IA pelo super admin
CREATE TABLE public.platform_ai_addon (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Assistente Virtual IA',
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 30.00,
  trial_message_limit INTEGER NOT NULL DEFAULT 200,
  is_active BOOLEAN NOT NULL DEFAULT true,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de assinaturas do addon
CREATE TABLE public.establishment_ai_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'cancelled', 'past_due')),
  trial_messages_used INTEGER NOT NULL DEFAULT 0,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.establishment_ai_assistant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_assistant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_assistant_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ai_addon ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishment_ai_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies para establishment_ai_assistant
CREATE POLICY "Establishment owners can manage their AI assistant"
ON public.establishment_ai_assistant
FOR ALL
USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Super admins can manage all AI assistants"
ON public.establishment_ai_assistant
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- RLS Policies para ai_assistant_usage
CREATE POLICY "Establishment owners can view their usage"
ON public.ai_assistant_usage
FOR SELECT
USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Super admins can manage all usage"
ON public.ai_assistant_usage
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- RLS Policies para ai_assistant_conversations
CREATE POLICY "Public can create conversations"
ON public.ai_assistant_conversations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can view their own conversations"
ON public.ai_assistant_conversations
FOR SELECT
USING (true);

CREATE POLICY "Public can update conversations"
ON public.ai_assistant_conversations
FOR UPDATE
USING (true);

CREATE POLICY "Establishment owners can view all conversations"
ON public.ai_assistant_conversations
FOR SELECT
USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()));

-- RLS Policies para ai_assistant_messages
CREATE POLICY "Public can insert messages"
ON public.ai_assistant_messages
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can view messages"
ON public.ai_assistant_messages
FOR SELECT
USING (true);

-- RLS Policies para ai_assistant_waitlist
CREATE POLICY "Public can add to waitlist"
ON public.ai_assistant_waitlist
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Establishment owners can manage waitlist"
ON public.ai_assistant_waitlist
FOR ALL
USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()));

-- RLS Policies para platform_ai_addon
CREATE POLICY "Anyone can view AI addon info"
ON public.platform_ai_addon
FOR SELECT
USING (true);

CREATE POLICY "Super admins can manage AI addon"
ON public.platform_ai_addon
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- RLS Policies para establishment_ai_subscriptions
CREATE POLICY "Establishment owners can view their subscription"
ON public.establishment_ai_subscriptions
FOR SELECT
USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Public can insert subscription for trial"
ON public.establishment_ai_subscriptions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Super admins can manage all subscriptions"
ON public.establishment_ai_subscriptions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Triggers para updated_at
CREATE TRIGGER update_establishment_ai_assistant_updated_at
BEFORE UPDATE ON public.establishment_ai_assistant
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_assistant_usage_updated_at
BEFORE UPDATE ON public.ai_assistant_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_assistant_conversations_updated_at
BEFORE UPDATE ON public.ai_assistant_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_assistant_waitlist_updated_at
BEFORE UPDATE ON public.ai_assistant_waitlist
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_establishment_ai_subscriptions_updated_at
BEFORE UPDATE ON public.establishment_ai_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default addon configuration
INSERT INTO public.platform_ai_addon (name, description, price_monthly, trial_message_limit)
VALUES ('Assistente Virtual IA', 'Assistente virtual inteligente para atendimento automático de clientes via chat e WhatsApp. Agenda, remarca, gerencia fila de espera e responde dúvidas.', 30.00, 200);

-- Enable realtime for conversations and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_assistant_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_assistant_messages;