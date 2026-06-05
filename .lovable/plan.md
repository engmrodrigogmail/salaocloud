# Remanejar agendamento marcado como Falta

## Decisões já alinhadas
- **Substituição:** o próprio registro do agendamento volta para `pending`/`confirmed` na nova data (apaga o `no_show`, não cria duplicata). Mantemos rastreio mínimo via `notes` + `previous_status`.
- **Pacote inteiro:** mover o `appointment` pai recalcula `scheduled_at`, `duration_minutes`, `price` e desloca todas as linhas de `appointment_services` para os novos horários.
- **Janela:** botão só aparece se a falta tem ≤ 24h (comparando `now()` com o `scheduled_at` original).
- **Editável no remanejo:** data, hora, serviços (add/remove) e profissional por serviço.
- **Visibilidade:** apenas `/portal/:slug/agenda` e `/interno/:slug/agenda`. Nada na área do cliente.

## Como o "Remanejar" se comporta

1. Aparece dentro do diálogo de detalhe do agendamento quando `status = 'no_show'` E `scheduled_at` está dentro da janela de 24h.
2. Abre um modal único:
   - Campo **Data** (date picker) + **Hora** (TimeSelect existente).
   - Lista de serviços do agendamento, reaproveitando o componente de edição de serviços já usado em `EditAppointmentServicesDialog` (permite trocar serviço e profissional de cada item, adicionar e remover).
   - Resumo de duração total e valor.
3. Ao confirmar:
   - Valida disponibilidade na nova data/hora (reusa `useAvailability` / regra de bloqueios).
   - Atualiza `appointments`: `scheduled_at`, `status='pending'`, `professional_id` = profissional do 1º serviço, `duration_minutes` e `price` somados, `previous_status='no_show'`, `confirmed_at=null`, `cancelled_reason=null`. Anexa em `notes` uma linha "Remanejado em DD/MM/YYYY HH:mm (era DD/MM HH:mm)".
   - Deleta linhas antigas de `appointment_services` e insere as novas com `starts_at` calculados a partir do novo horário base, respeitando o `sequence_mode` do salão (sequential/gap/parallel).
4. Refresca a agenda e mostra toast `top-center` 2s "Agendamento remanejado".

## Consequências analisadas

| Área | Impacto | Tratamento |
|---|---|---|
| Cron auto no-show | Novo `scheduled_at` é futuro → não dispara. | Sem mudança. |
| Comissões | `no_show` não gera comissão; após remanejo só haverá comissão quando comanda for fechada. | Sem mudança. |
| Comanda vinculada | Não pode existir comanda em falta. Se existir órfã, bloqueamos com mensagem. | Validação no início. |
| Reincidência | Como apagamos o `no_show`, a falta desaparece do relatório — exatamente o pedido do usuário (flexibilizar). | Documentado. |
| Privacidade multi-prof | Quem vê o agendamento na própria agenda pode remanejar. Como agora é único registro, regra atual já cobre. | Sem nova policy. |
| Auditoria | `previous_status='no_show'` + nota em `notes` preserva rastro. | Implementado. |

## Arquivos que vou tocar

**Frontend (UI/lógica, sem backend novo):**
- `src/components/schedule/ReopenNoShowDialog.tsx` *(novo)* — modal de remanejo.
- `src/pages/portal/Agenda.tsx` — botão "Remanejar" no detalhe quando elegível.
- `src/pages/interno/Agenda.tsx` — mesmo botão.

**Sem migração de banco.** Não há novas colunas nem RLS — reutilizamos `previous_status`, `notes`, `appointments` e `appointment_services` que já existem, e as policies atuais (`owners can manage`, `professionals can update own appointments`) já permitem o UPDATE.

## Fora de escopo (posso fazer depois se quiser)
- Histórico permanente da falta original (precisaria nova tabela `appointment_reschedules`).
- Notificação WhatsApp/push para a cliente avisando do novo horário.
- Botão equivalente para `cancelled` (regra é diferente).
