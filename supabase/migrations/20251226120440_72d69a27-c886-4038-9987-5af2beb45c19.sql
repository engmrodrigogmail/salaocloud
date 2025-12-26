-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  price_yearly NUMERIC,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  stripe_product_id TEXT,
  features TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_highlighted BOOLEAN NOT NULL DEFAULT false,
  badge TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone can view active plans (public pricing page)
CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans
FOR SELECT
USING (is_active = true);

-- Only super admins can manage plans
CREATE POLICY "Super admins can manage plans"
ON public.subscription_plans
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Insert the default plans with Stripe IDs
INSERT INTO public.subscription_plans (slug, name, description, price_monthly, price_yearly, stripe_product_id, stripe_price_id_monthly, features, is_active, is_highlighted, badge, display_order)
VALUES 
  ('basic', 'Básico', 'Ideal para pequenos negócios que estão começando', 99, 950, 'prod_Tfva1I8dvNAXjQ', 'price_1SiZjIFoG2SsKoyTqUAE3Qgy', 
   ARRAY['Até 3 profissionais', 'Agenda básica', 'Notificações por email', 'Relatórios básicos'], 
   true, false, NULL, 1),
  ('professional', 'Profissional', 'Para negócios em crescimento que precisam de mais recursos', 199, 1900, 'prod_TfvbZ44XsjZnvk', 'price_1SiZjvFoG2SsKoyTq4KhyoFg',
   ARRAY['Até 10 profissionais', 'Agenda avançada', 'Notificações WhatsApp', 'Relatórios avançados', 'Programa de fidelidade', 'Cupons de desconto'],
   true, true, 'Mais Popular', 2),
  ('premium', 'Premium', 'Solução completa para negócios estabelecidos', 399, 3800, 'prod_Tfvb6bBdob6Gjh', 'price_1SiZk4FoG2SsKoyTaZajRlUf',
   ARRAY['Profissionais ilimitados', 'Todas as funcionalidades', 'API de integração', 'Suporte prioritário', 'Multi-unidades', 'Personalização da marca'],
   true, false, NULL, 3);

-- Create trigger for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();