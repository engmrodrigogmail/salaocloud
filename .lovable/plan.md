## Visão geral

Portal interno para treinar vendedores SalãoCloud. Acesso para vendedores via `/treinamento` (Supabase Auth + role `sales_trainee`) e para o Superadmin via dois cards no Hub (Gerenciar / Acessar como vendedor).

## Banco de dados (1 migration)

**Enum:** adicionar valor `sales_trainee` em `app_role`.

**Tabelas:**
- `training_vendor_profiles` — dados pessoais do vendedor (cpf, telefone, cidade, uf, must_change_password, locked_until, failed_attempts).
- `training_modules` — id (int 1–29), title, profile (admin/professional/receptionist/client), view (portal/interno/cliente), iframe_url, screenshot_url, order, content jsonb (técnico, comercial, argumentos por porte, diferenciais, casos, checklist, quiz).
- `training_user_progress` — vendor_id, module_id, status (not_started/in_progress/completed), checklist_state jsonb, started_at, completed_at, score.
- `training_quiz_attempts` — vendor_id, module_id, answers jsonb, score, passed, attempted_at.
- `training_certificates` — vendor_id, profile, issued_at, code (UUID público).

**RLS:**
- Vendedor lê só o próprio progresso/certificados; lê todos os módulos ativos.
- Super admin (via `has_role`) lê/edita tudo.
- Módulos públicos para `sales_trainee` autenticado (read-only).

**Seed:**
- Criar establishment demo (`slug = demo-treinamento`, owner = super admin atual) via insert tool, em modo somente-leitura (flag `is_demo`).
- Inserir os 29 módulos com conteúdo extraído do spec (jsonb).

## Frontend

**Hub (`src/pages/Hub.tsx`):** dois cards extras só para super_admin:
- "Gerenciar Treinamento" → `/treinamento/admin`
- "Acessar como Vendedor" → `/treinamento/dashboard` (impersona via flag local)

**Rotas novas (em `App.tsx`):**
- `/treinamento` — login (email + senha)
- `/treinamento/primeiro-acesso` — completar cadastro + nova senha
- `/treinamento/recuperar-senha` — pede email
- `/treinamento/resetar-senha` — token via Supabase
- `/treinamento/dashboard` — progresso geral + lista de módulos por perfil
- `/treinamento/perfil` — dados + segurança + estatísticas
- `/treinamento/modulo/:id` — player genérico (60% conteúdo / 40% iframe)
- `/treinamento/admin` — CRUD vendedores + edição rápida de módulos + dashboard de progresso

**Componentes:**
- `TrainingProtectedRoute` — exige role `sales_trainee` ou `super_admin`.
- `TrainingLayout` — sidebar + header com avatar + progresso global.
- `ModulePlayer` — renderiza seções a partir do jsonb + iframe + checklist + quiz.
- `QuizComponent` — múltipla escolha, libera "concluir" só com 100% acerto.
- `ProgressBar`, `CertificateCard`.

## Edge functions

- `training-vendor-create` (admin): cria user + envia email de primeiro acesso.
- `training-issue-certificate`: gera certificado quando todos os módulos do perfil concluídos.

(Reaproveita `client-auth-request-reset` patterns para email — ou usa `supabase.auth.resetPasswordForEmail` direto; preferimos o nativo para simplificar.)

## Conteúdo dos 29 módulos

Extraído integralmente do spec anexado (2910 linhas). Cada módulo vira uma linha em `training_modules` com `content` jsonb estruturado:

```json
{
  "technical": "...",
  "commercial": "...",
  "arguments": { "small": [...], "medium": [...], "large": [...] },
  "differentials": [{ "feature": "...", "salaocloud": "...", "competitor_a": "...", "competitor_b": "..." }],
  "use_cases": [{ "salon": "...", "before": "...", "after": "...", "result": "...", "roi": "..." }],
  "checklist": ["...", "..."],
  "quiz": [{ "question": "...", "options": ["A","B","C"], "correct": 1 }]
}
```

Distribuição: 12 admin (Portal) + 6 profissional (Interno) + 6 recepcionista (Interno) + 5 cliente.

## Fluxo de dados

```text
Super Admin → Hub → Card "Gerenciar"  → /treinamento/admin
                 → Card "Acessar como vendedor" → /treinamento/dashboard

Vendedor → /treinamento (login) → /treinamento/dashboard
        → escolhe módulo → /treinamento/modulo/:id
        → conclui checklist + passa quiz → progress.completed
        → todos os módulos do perfil completos → certificado emitido
```

## Detalhes técnicos relevantes

- Establishment demo recebe seed mínimo (1 profissional, 3 serviços, 5 clientes fictícios) para iframes não ficarem vazios. Marcado com `is_demo=true` para excluir de buscas/relatórios reais (adicionar coluna no `establishments`).
- Iframes restritos via `sandbox="allow-scripts allow-same-origin"`; conteúdo do salão demo é read-only por RLS extra (CHECK no role).
- Senha de primeiro acesso: gerada pelo admin, marcada `must_change_password=true`, tela de primeiro acesso força troca.
- Logout limpa sessão Supabase normalmente.

## Entregáveis

1. **Migration** com enum, 5 tabelas, RLS, coluna `is_demo` em establishments, trigger de updated_at.
2. **Insert** com salão demo + 29 módulos populados.
3. **Edge functions** (`training-vendor-create`, `training-issue-certificate`).
4. **15+ arquivos frontend** (rotas, layout, player, admin, hub atualizado).
5. **Memory** atualizada com regras do portal.

## O que NÃO está incluído

- Integração com WhatsApp para notificar vendedor (fora do escopo Z-API).
- Gamification além de certificado (rankings, badges).
- Versionamento de conteúdo dos módulos (edita-se direto).
- Tradução multi-idioma.
