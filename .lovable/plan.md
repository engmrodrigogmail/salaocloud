
# Relatórios WhatsApp via Z-API (Super Admin)

## Visão geral
Criar módulo no painel do Super Admin para configurar relatórios e alertas via WhatsApp (Z-API), com destinatários nomeados, tipos de mensagem ativáveis, template editável de KPIs e disparo automático.

## 1. Credenciais (secrets)
Solicitar via formulário seguro:
- `ZAPI_INSTANCE_ID`
- `ZAPI_TOKEN`
- `ZAPI_CLIENT_TOKEN` (Account Security Token)

## 2. Banco de dados (migration)

**`whatsapp_recipients`** — destinatários
- `id`, `name`, `phone` (E.164, ex: 5511947551416), `active`, `created_at`
- Seed: Rodrigo `5511947551416`, Lizandra `5511979546293`

**`whatsapp_message_types`** — tipos de mensagem com toggle ativar/desativar
- `id`, `code` (ex: `daily_report`, `new_trial`, `silvia_escalation`, `subscription_activated`, `trial_expired`, `subscription_expiring_3d`), `name`, `description`, `active`, `template` (texto com placeholders `{{var}}`), `enabled_kpis` (jsonb com lista de KPIs ativos para o relatório diário), `created_at`, `updated_at`
- Seed: 6 tipos pré-cadastrados, `daily_report` com template fornecido pelo usuário

**`whatsapp_send_log`** — auditoria
- `id`, `message_type_code`, `recipient_phone`, `recipient_name`, `payload`, `status` (`sent`/`failed`), `error`, `sent_at`

Todas com RLS restrita a super admin (`has_role(auth.uid(),'super_admin')`) + grants para `authenticated` e `service_role`.

## 3. Edge Functions

**`zapi-send`** (interna, JWT obrigatório) — envia texto para um número via Z-API REST  
`POST https://api.z-api.io/instances/{ID}/token/{TOKEN}/send-text` com header `Client-Token`. Loga em `whatsapp_send_log`.

**`whatsapp-daily-report`** (cron, sem JWT) — coleta KPIs e dispara para destinatários ativos quando `daily_report` ativo:
- Visualizações landing hoje (`user_session_logs` rota `/`)
- Top 3 páginas mais acessadas no SaaS hoje (`user_session_logs` agrupado por `page_name`)
- Acionamentos Silvia hoje (`ai_assistant_conversations`/`messages` por dia)
- Novos salões hoje (`establishments.created_at`)
- Salões em teste (`is_trial=true`)
- Salões com teste vencido hoje (`trial_ends_at::date = today`)
- Assinaturas Stripe ativas (`subscription_status='active'`)
- Receita do dia e acumulada do mês (Stripe via `stripe-data` ou cache local)
- Assinaturas expirando em 3 dias (`current_period_end` entre +3d)

Renderiza o template substituindo `{{kpi}}` por valores.

**`whatsapp-event-dispatcher`** (interna) — chamada por hooks (signup trial, escalation Silvia, webhook Stripe) para disparar tipos eventuais se ativos.

## 4. Cron (pg_cron)
Job diário às `22:59 UTC` (= 19:59 BRT atual). **Correção:** 20:59 horário de São Paulo (BRT, UTC-3) = **23:59 UTC**. Vou agendar `59 23 * * *`.

```sql
select cron.schedule('whatsapp-daily-report','59 23 * * *', $$
  select net.http_post(url:='.../whatsapp-daily-report', headers:='{...apikey...}'::jsonb, body:='{}'::jsonb);
$$);
```

## 5. UI Super Admin
Nova rota `/admin/whatsapp-reports` + item no menu `AdminLayout`.

**Aba 1 — Destinatários**: lista com Nome + Telefone + Ativo, botões Adicionar/Editar/Excluir. Validação de telefone (E.164).

**Aba 2 — Tipos de mensagem**: lista os 6 tipos com:
- Switch ativar/desativar
- Editor de template (textarea com syntax `{{var}}`)
- Para `daily_report`: checkboxes de KPIs sugeridos (cada um vira `{{kpi_nome}}` no template)
- Botão "Enviar teste" → dispara para destinatários ativos imediatamente
- Lista de placeholders disponíveis ao lado do editor

**Aba 3 — Histórico**: tabela de `whatsapp_send_log` últimos 30 dias com filtro por tipo/status.

## 6. Integração com eventos existentes
- `create-checkout` ou trigger pós-trial → chama `whatsapp-event-dispatcher` com `new_trial`
- `stripe-webhook` ao receber `customer.subscription.created`/`invoice.paid` → `subscription_activated`
- `chat-ai-agent` quando detecta escalation → `silvia_escalation`

## Detalhes técnicos
- Template engine simples (regex replace `{{key}}`)
- Datas em UTC-3 via `dateUtils.ts`
- Send sequencial com `await` (Z-API recomenda ~1 msg/seg)
- Erros não interrompem demais destinatários
- Constraint no `code` de `whatsapp_message_types` para evitar duplicatas

## Pendente
Após você aprovar o plano, solicito os 3 secrets Z-API via formulário seguro e implemento.
