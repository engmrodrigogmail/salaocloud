## Visão geral

Implementar em um único ciclo: (1) cupom CLOUD7DE de 100% por 7 dias, (2) tela de cadastro de cupons compatível com este formato, (3) lista de planos corrigida (apenas "Pro"), (4) badge de trial no super admin já existente, (5) bloqueio automático do salão (dono + funcionários + clientes do salão) quando o trial vencer, (6) Edu: limite de 50 consultas/mês resetando no plano pago + pacotes adicionais cadastráveis (10 por R$35 já pronto), (7) texto discreto sobre limite do Edu na landing.

## 1. Migração de banco

**a) Nova coluna em `platform_coupons`:**
- `grants_trial_days INT` — número de dias de trial gratuito que o cupom concede (NULL = cupom de desconto comum).
- `applicable_features` passa a aceitar valor `edu` para permitir restrição de funcionalidades durante o trial.

**b) Coluna `establishments.trial_coupon_id UUID` + `trial_features_allowed TEXT[]`:**
- Quando o cupom de trial é resgatado: setamos `subscription_plan='trial'`, `trial_ends_at = now() + grants_trial_days`, `trial_coupon_id`, e `trial_features_allowed = ['all']` ou `['all_except_edu']` conforme cupom.
- Quando o trial vence + Stripe checkout é confirmado → migramos para `pro` com `current_period_end` casado ao último dia do trial (lógica no `stripe-webhook`).

**c) Nova tabela `edu_packages`:**
```
id, name, consultations_count, price, stripe_product_id, stripe_price_id,
is_active, created_at, updated_at
```
Pré-popular com "10 consultas — R$35,00".

**d) Nova coluna em `edu_access_control`:**
- `consultations_used_month INT DEFAULT 0`
- `consultations_extra_balance INT DEFAULT 0` (pacotes adquiridos)
- `month_reference TEXT` (YYYY-MM, para reset automático)
- Função `consume_edu_consultation(_est_id)` que decrementa mensal/extras e bloqueia se >= 50.
- Limite mensal default = 50 na config (consultar `platform_settings`).

**e) Função `is_establishment_active(_est_id) RETURNS BOOLEAN`:**
- True se admin_trial OU plano pago ativo OU trial dentro do prazo.
- Usada por novas policies RLS (não vamos reescrever todas, vamos somar uma trava no `appointments` e `tabs` para impedir escrita quando o salão estiver expirado).

## 2. Tela admin/Coupons

- `SUBSCRIPTION_PLANS` passa a refletir apenas planos ativos do DB (`pro`). Carrega dinamicamente de `subscription_plans` filtrando `is_active`.
- Novo campo "Cupom de trial?" (switch). Quando ativo, exibe:
  - "Dias de trial" (número)
  - "Funcionalidades liberadas" multiselect (atualmente: `all`, ou `all_except_edu`).
  - `discount_value` é fixado em 100 e `discount_type='percentage'`.
- Mostra explicitamente "1 uso por CPF do dono" (já é a regra padrão de `max_redemptions=1` + chave `(coupon_id, establishment_id)` em `platform_coupon_redemptions`).

## 3. Cadastrar CLOUD7DE

Após o ajuste da tela, inserir programaticamente via `supabase--insert`:
- code: `CLOUD7DE`
- name: `7 dias de experiência`
- description: `7 dias de período de experiência com acesso a todas as funcionalidades e restrito a consultas ao Edu`
- discount_type: `percentage`, discount_value: `100`
- grants_trial_days: `7`
- applicable_plans: `['pro']`
- applicable_features: `['all_except_edu']`
- valid_from: `2026-06-25`, valid_until: `2026-09-25`
- max_redemptions: NULL (1 por salão é controlado pela unique key)

## 4. Edge functions

- `create-checkout`: aceitar `coupon_code`. Se for cupom de trial 100%, NÃO abrir Stripe — apenas marcar trial no estabelecimento, criar `platform_coupon_redemptions`, retornar `{trial_started: true}`. O frontend redireciona para o dashboard.
- `stripe-webhook` / `check-subscription`: ao receber assinatura paga e existir trial ativo, ajustar `current_period_end` para casar com último dia do trial (proration_behavior `none`, `billing_cycle_anchor`).
- `consume-edu` (nova): chamada em `analyze-hair-profile` para descontar 1 consulta e bloquear se sem saldo.

## 5. Bloqueio do salão expirado

Criar componente `SubscriptionGate` que envolve as rotas `/portal/:slug`, `/interno/:slug` e `/{slug}`:
- Usa `useSubscription(slug)`. Se `isExpired`, redireciona dono para `/portal/:slug/assinatura` com aviso, profissionais para uma tela "Salão temporariamente indisponível", e clientes para uma tela "Este salão está com a assinatura em revisão. Volte em breve."
- Outras telas (do mesmo cliente/profissional em salões ativos) seguem normais — gate é por slug.

## 6. Reset de 50 consultas

`platform_settings.edu_monthly_limit_paid = 50`. Ao ativar plano pago (webhook), zerar `consultations_used_month` e setar `month_reference = current_month`. A função `consume_edu_consultation` reseta automaticamente quando o mês muda.

## 7. Landing — texto discreto

Em `PricingSection.tsx`, abaixo do plano Pro, adicionar linha pequena: *"Inclui 50 consultas/mês com o Edu, nosso consultor capilar IA. Pacotes adicionais disponíveis."*

## 8. Onboarding/checkout

- `Onboarding.tsx` e `OnboardingAwaitingPayment.tsx`: ao validar cupom CLOUD7DE, em vez de abrir Stripe, ativa o trial e leva direto ao painel.

## Detalhes técnicos (não-usuário)

- Status `establishments.status` permanece como hoje; usaremos `subscription_plan + trial_ends_at` como fonte da verdade via `is_establishment_active`.
- Não vamos remover legado `basic/professional/premium` do enum, apenas escondê-los da UI.
- Edu: o `analyze-hair-profile` passa por `consume-edu` antes de chamar Claude; falha com 402 quando sem saldo, e o frontend mostra modal "Sem consultas — comprar pacote".

## Não inclusos neste ciclo

- Migrar usuários atuais em `admin_trial` (continuam de cortesia).
- Pacotes de Edu adicionais além do 10/R$35.
- Notificação por e-mail D-3, D-1, D0 do fim do trial (pode entrar no próximo ciclo).
