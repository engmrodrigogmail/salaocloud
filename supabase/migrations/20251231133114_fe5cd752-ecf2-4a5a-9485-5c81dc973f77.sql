-- Create broadcast subscriptions table
CREATE TABLE public.broadcast_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'cancelled')),
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id)
);

-- Create broadcast campaigns table
CREATE TABLE public.broadcast_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'completed', 'failed')),
  created_by UUID,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create broadcast logs table
CREATE TABLE public.broadcast_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_phone TEXT NOT NULL,
  client_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broadcast_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcast_subscriptions
CREATE POLICY "Establishments can view their own broadcast subscription"
  ON public.broadcast_subscriptions FOR SELECT
  USING (establishment_id = public.get_user_establishment_id(auth.uid()));

CREATE POLICY "Establishments can manage their own broadcast subscription"
  ON public.broadcast_subscriptions FOR ALL
  USING (establishment_id = public.get_user_establishment_id(auth.uid()));

-- RLS Policies for broadcast_campaigns
CREATE POLICY "Establishments can view their own campaigns"
  ON public.broadcast_campaigns FOR SELECT
  USING (establishment_id = public.get_user_establishment_id(auth.uid()));

CREATE POLICY "Establishments can create campaigns"
  ON public.broadcast_campaigns FOR INSERT
  WITH CHECK (establishment_id = public.get_user_establishment_id(auth.uid()));

CREATE POLICY "Establishments can update their own campaigns"
  ON public.broadcast_campaigns FOR UPDATE
  USING (establishment_id = public.get_user_establishment_id(auth.uid()));

-- RLS Policies for broadcast_logs
CREATE POLICY "Establishments can view their campaign logs"
  ON public.broadcast_logs FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM public.broadcast_campaigns 
      WHERE establishment_id = public.get_user_establishment_id(auth.uid())
    )
  );

-- Create indexes
CREATE INDEX idx_broadcast_campaigns_establishment ON public.broadcast_campaigns(establishment_id);
CREATE INDEX idx_broadcast_campaigns_status ON public.broadcast_campaigns(status);
CREATE INDEX idx_broadcast_logs_campaign ON public.broadcast_logs(campaign_id);
CREATE INDEX idx_broadcast_logs_status ON public.broadcast_logs(status);

-- Add trigger for updated_at
CREATE TRIGGER update_broadcast_subscriptions_updated_at
  BEFORE UPDATE ON public.broadcast_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();