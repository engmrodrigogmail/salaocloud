UPDATE public.subscription_plans
SET features = ARRAY[
  'Profissionais ilimitados',
  'Serviços ilimitados',
  'Clientes ilimitados',
  'Comandas internas',
  'Comissões avançadas',
  'Programa de fidelidade',
  'Cupons de desconto',
  'Catálogo/portfólio',
  'Vitrine na tela de clientes',
  'Lembretes e notificações ilimitadas no próprio app',
  'Branding personalizado',
  'Relatórios avançados',
  'Suporte IA 24h/dia, 365 dias/ano'
]
WHERE slug = 'pro';