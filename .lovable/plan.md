# Agendamento com múltiplos serviços (manual e cliente)

## Resumo
Permitir 1..N serviços em um único agendamento, cada um com profissional próprio (podendo ser o mesmo ou diferentes). Cada serviço entra como linha em `appointment_services`. A agenda valida cada bloco contra o calendário do profissional atribuído, respeitando bloqueios, expediente, fechamentos, sobreposições e regras existentes. Quando não houver sequência contínua, oferece automaticamente alternativa com gap.

---

## 1. Modelo de dados (migration)

Nova tabela `public.appointment_services` (filha de `appointments`):

| coluna | tipo | observações |
|---|---|---|
| `id` | uuid PK | |
| `appointment_id` | uuid FK → appointments(id) ON DELETE CASCADE | |
| `service_id` | uuid FK → services(id) | |
| `professional_id` | uuid FK → professionals(id) | |
| `position` | int | ordem na sequência (1..N) |
| `starts_at` | timestamptz | início absoluto do bloco |
| `duration_minutes` | int | snapshot da duração |
| `price` | numeric | snapshot do preço |
| `created_at` / `updated_at` | timestamptz | |

- Index em `(appointment_id, position)` e em `(professional_id, starts_at)`.
- RLS espelhando `appointments` (mesma owner/professional/cliente que enxerga o pai).
- Trigger `update_updated_at_column`.
- `appointments` continua sendo a "capa": guarda cliente, status, `scheduled_at` (= 1º bloco), `duration_minutes` (= soma incluindo gaps até o último fim) e `price` (= soma). `service_id`/`professional_id` permanecem populados com o 1º item para retro-compat (queries antigas, Dashboard, comissões via comanda).
- Backfill: para cada appointment existente, inserir 1 linha em `appointment_services` espelhando os campos atuais.

---

## 2. Camada de disponibilidade (frontend)

Refatorar/estender `useAvailability.ts` e a lógica local de `NewAppointmentDialog`:

- Nova função `findSequenceSlots(date, items[{service_id, professional_id}], { mode: "continuous" | "with_gap" })`:
  1. Modo `continuous`: para cada slot inicial candidato, valida bloco 1 com `isProfessionalAvailable(prof1, t1, dur1)`. Se livre, calcula `t2 = t1 + dur1` e valida bloco 2 com `prof2`. Repete até o fim. Bloco passa só se TODOS livres em sequência sem lacuna.
  2. Modo `with_gap`: para cada bloco independente, busca o próximo slot livre do `professional_id` daquele item, começando em `t_anterior + dur_anterior`. Permite intervalo.
  3. Em todos os casos: valida expediente do salão, expediente do profissional do bloco, `professional_blocked_times`, `establishment_closures`, e sobreposição com `appointments` (do mesmo profissional). Profissionais diferentes podem trabalhar em paralelo — não bloqueia entre si, exceto se for o mesmo profissional em dois blocos do mesmo agendamento (auto-conflito impossível porque são sequenciais).
- `findNextAvailableSequence(fromDate, items)`: varre dias futuros, retorna primeiro arranjo viável (tenta contínuo, depois com gap).
- Slot picker do dialog passa a mostrar horários de **início** válidos para a sequência inteira.

---

## 3. UI — `NewAppointmentDialog` (interno/portal)

- Substituir `serviceId` único por `items: Array<{ serviceId, professionalId }>` com mínimo 1.
- Linha de item:
  - SearchableSelect de serviço.
  - SearchableSelect de profissional (filtrado por `professional_services` do serviço; ou "Qualquer um" para auto-seleção).
  - Botão remover (se >1).
- Botão "+ Adicionar serviço".
- Resumo lateral: lista os blocos com horário previsto (`t1, t2, ...`), duração e preço de cada um; total no rodapé.
- Picker de horário: mostra apenas inícios em que a sequência cabe contínua. Toggle "Permitir intervalo entre serviços" — quando ativo, mostra também horários com gap (marcador visual diferente, igual ao atual de "fora do expediente").
- Mensagem inteligente: se nenhuma sequência contínua existir no dia, propõe automaticamente a primeira data/hora com gap aceito, ou no próximo dia.
- Confirmação: revisa todos os blocos antes de salvar.

## 4. UI — `BookingPage.tsx` (cliente)

- Step 1 "Escolha o Serviço" vira lista com checkbox/quantidade e botão "Adicionar mais um serviço". Cliente seleciona N serviços.
- Step 2 "Escolha o Profissional" passa a ser por serviço (lista cada serviço selecionado e pede profissional, ou "Qualquer disponível"). Filtra por `professional_services`.
- Step 3 "Data/Horário" usa o mesmo motor de `findSequenceSlots`. Mostra horários onde a sequência inteira cabe contínua; se não houver, oferece automaticamente "Mais cedo possível com intervalo" como segunda lista.
- Step 4 inalterado (dados do cliente).
- Step 5 confirma com os blocos detalhados.

---

## 5. Persistência

- `appointments` insert: `service_id` = 1º item, `professional_id` = 1º item, `scheduled_at` = início bloco 1, `duration_minutes` = (fim do último bloco − início bloco 1), `price` = soma.
- `appointment_services` insert: linha por bloco com `starts_at`, `duration_minutes`, `price`, `position`.
- Tudo em transação via RPC `create_appointment_with_services(_payload jsonb)` para garantir atomicidade e revalidar conflitos no servidor (anti race-condition).

## 6. Integração com Comanda

Quando o agendamento entra em atendimento e a comanda abre (`useTabs.createTab` com `appointment_id`):
- Em vez de inserir 1 `tab_items` baseado em `appointments.service_id`, ler `appointment_services` e inserir 1 `tab_items` por bloco (cada um com seu `professional_id` para comissão correta). Preço da comanda = soma.
- `close_tab_atomic` continua funcionando — comissões já são calculadas por `tab_items`.

## 7. Renderização na Agenda

- `Agenda.tsx` (interno e portal) passam a buscar `appointment_services` junto e renderizam cada bloco no grid do profissional correspondente. Visualmente conectados (mesma borda/cor) para indicar que pertencem ao mesmo agendamento.
- "Iniciar atendimento" e "Encerrar" continuam atuando no `appointments` pai (status único).

## 8. Backfill e compatibilidade

- Migration copia cada appointment existente para `appointment_services` (1 linha, position=1).
- Dashboard e relatórios continuam lendo `appointments.price` (já é a soma). Comissões continuam vindo de `tab_items`.

## 9. Fora de escopo (não nesta entrega)

- Edição de agendamento existente para adicionar/remover serviços (manter apenas criar; editar só recria).
- AI assistant `[AGENDAR|...]` multi-serviço (manter single-service por enquanto; sinalizar como follow-up).
- Reagendamento drag-and-drop dos blocos individualmente.

---

## Detalhes técnicos

```text
appointments (capa)
 ├─ id, client_*, status, scheduled_at (= bloco1.start), duration_minutes (= cobertura total), price (= Σ)
 └─ appointment_services[]
      ├─ position=1, service_A, prof_X, starts_at, dur, price
      ├─ position=2, service_B, prof_Y, starts_at = starts_at1+dur1 (ou + gap), dur, price
      └─ ...
```

Algoritmo de checagem por bloco (idêntico ao atual `isProfessionalAvailable`):
1. Expediente do salão aberto em `(date, time, time+dur)`.
2. Sem `establishment_closures` cobrindo o intervalo.
3. Expediente do `professional_id` ativo no dia e cobrindo `(time, time+dur)`.
4. Sem `professional_blocked_times` sobrepondo.
5. Sem `appointments` ou `appointment_services` do mesmo `professional_id` sobrepondo (exceto o próprio agendamento em edição).

Sobreposição entre blocos do MESMO agendamento mas com profissionais DIFERENTES é permitida (são pessoas distintas). Só blocos sequenciais do mesmo profissional teriam conflito — e por construção `t_n = t_{n-1} + dur_{n-1}` evita isso.