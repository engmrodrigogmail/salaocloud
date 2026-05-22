## Fase 2 — Plano de execução

A Fase 1 já entregou backend (`appointment_services`, RPC, validações) e o diálogo interno multi-serviço. A Fase 2 tem 4 frentes; sugiro executá-las em sequência (cada uma é independente e gera valor sozinha) para evitar uma PR gigante de difícil revisão.

### 2A — Comanda já abre com todos os serviços (recomendado começar por aqui)
- Em `useTabs.createTab`, depois de criar/recuperar o agendamento, ler `appointment_services` do `appointment_id`.
- Se houver múltiplos itens: inserir um `tab_items` por serviço, cada um com `professional_id` correto (para comissão do profissional certo).
- Se não houver itens em `appointment_services` (agendamento legado/único): manter comportamento atual (1 item).
- Recalcular total da comanda ao final.
- **Impacto:** comissões corretas por profissional desde a abertura; nada quebra para agendamentos antigos.

### 2B — Agenda renderiza blocos em colunas dos profissionais corretos
- `Agenda.tsx` e `AgendaTimeSlots.tsx` hoje pintam 1 card por `appointments.scheduled_at` na coluna do `professional_id` da capa.
- Buscar `appointment_services` junto (`select('*, appointment_services(*, services(name), professionals(name))')`) e, quando existir, expandir em múltiplos cards visuais — um por serviço, no horário e profissional do bloco.
- Cada card mostra um badge "Parte X/Y" e cor/borda comum (cor por `appointment_id`) para evidenciar que pertencem ao mesmo agendamento.
- Status (Pend./Conf./Atend./Conc./Canc.) é herdado da capa.
- Clique em qualquer bloco abre o mesmo diálogo do agendamento pai.

### 2C — BookingPage (cliente externo) multi-serviço
- Refactor do wizard atual (1 serviço/1 profissional) para lista dinâmica como no `NewAppointmentDialog`:
  - Step 1: adicionar/remover serviços; para cada um escolher profissional (ou "Qualquer um").
  - Step 2: data + busca de slot contínuo (fallback com gap, mostrando aviso).
  - Step 3: dados do cliente.
- Persistir via RPC `create_appointment_with_services` (já existe).
- Status inicial continua `pending`.

### 2D — Edição de agendamentos multi-serviço
- Diálogo de edição (`Agenda.tsx`): permitir alterar profissional/horário de cada bloco individualmente.
- Backend: nova RPC `update_appointment_services(_appointment_id, _items)` que valida conflitos do mesmo jeito que `create_appointment_with_services` e substitui a lista de itens em transação. Atualiza também a capa (`scheduled_at` = mín, `duration_minutes` = max-min, `price` = soma).
- Bloquear edição se a comanda já estiver fechada.

### Sugestão de execução
Começo por **2A + 2B** nesta rodada (são os de maior impacto visível e mantêm tudo coerente para agendamentos já criados via diálogo interno). **2C** e **2D** ficam para a próxima rodada por serem refactors grandes (booking público sozinho são ~300 linhas reescritas).

Confirma esse recorte (2A + 2B agora) ou quer que eu faça as 4 frentes de uma vez?
