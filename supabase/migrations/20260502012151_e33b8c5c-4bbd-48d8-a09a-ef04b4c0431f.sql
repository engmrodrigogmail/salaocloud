-- 1) Coluna admin_trial_granted_at + remoção do default de 14 dias
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS admin_trial_granted_at TIMESTAMPTZ;

ALTER TABLE public.establishments
  ALTER COLUMN trial_ends_at DROP DEFAULT;

-- 2) Plano "Pro" único
INSERT INTO public.subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  stripe_price_id_monthly, stripe_product_id,
  features, is_active, is_highlighted, badge, display_order,
  limits
) VALUES (
  'pro',
  'Pro',
  'Plano único com tudo liberado para o seu salão crescer.',
  129.90,
  NULL,
  'price_1TSRjwC9ZOIZNxgNiecIyNQu',
  'prod_URKOm1rdaX21qV',
  ARRAY[
    'Profissionais ilimitados',
    'Serviços ilimitados',
    'Clientes ilimitados',
    'Comandas internas',
    'Comissões avançadas',
    'Programa de fidelidade',
    'Cupons de desconto',
    'Catálogo/portfólio',
    'Lembretes por email',
    'Lembretes por WhatsApp',
    'Branding personalizado',
    'Relatórios avançados',
    'Suporte prioritário'
  ],
  true,
  true,
  'Oferta de lançamento',
  1,
  jsonb_build_object(
    'max_professionals', -1,
    'max_services', -1,
    'max_clients', -1,
    'multi_units', true,
    'internal_tabs', true,
    'commissions', true,
    'loyalty_program', true,
    'discount_coupons', true,
    'portfolio_catalog', true,
    'custom_branding', true,
    'email_reminders', true,
    'whatsapp_reminders', true,
    'reports_basic', true,
    'reports_advanced', true,
    'priority_support', true,
    'dedicated_manager', false,
    'api_access', false
  )
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  stripe_product_id = EXCLUDED.stripe_product_id,
  features = EXCLUDED.features,
  is_active = true,
  is_highlighted = true,
  badge = EXCLUDED.badge,
  display_order = 1,
  limits = EXCLUDED.limits,
  updated_at = now();

-- 3) Desativa planos legados
UPDATE public.subscription_plans
   SET is_active = false, is_highlighted = false, updated_at = now()
 WHERE slug IN ('basic','professional','premium');

-- 4) Migra TODOS os estabelecimentos existentes para admin_trial (cortesia)
UPDATE public.establishments
   SET subscription_plan = 'admin_trial'::subscription_plan,
       admin_trial_granted_at = now(),
       trial_ends_at = NULL,
       updated_at = now();

-- 5) Função helper: bypass de limites
CREATE OR REPLACE FUNCTION public.is_admin_trial(_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.establishments
    WHERE id = _establishment_id
      AND subscription_plan = 'admin_trial'::subscription_plan
  )
$$;