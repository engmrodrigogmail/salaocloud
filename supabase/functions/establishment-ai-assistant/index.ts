import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface EstablishmentData {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  working_hours: any;
  cancellation_policy: string | null;
  services: Array<{ id: string; name: string; price: number; duration_minutes: number; description: string | null }>;
  professionals: Array<{ id: string; name: string; specialties: string[]; working_hours: any }>;
  promotions: Array<{ name: string; description: string; discount_value: number; discount_type: string; start_date: string; end_date: string }>;
  coupons: Array<{ code: string; description: string | null; discount_value: number; discount_type: string; valid_until: string | null; min_purchase_value: number | null }>;
  loyaltyProgram: { name: string; description: string | null; points_per_currency: number; rewards: Array<{ name: string; points_required: number; reward_value: number }> } | null;
}

interface AssistantConfig {
  is_enabled: boolean;
  assistant_name: string;
  language_style: 'casual' | 'formal';
  availability_mode: 'only_business_hours' | '24h_with_message';
  working_hours: any;
  welcome_message: string | null;
  offline_message: string | null;
  escalation_whatsapp: string | null;
  custom_instructions: string | null;
}

async function getEstablishmentData(establishmentId: string): Promise<EstablishmentData | null> {
  // Fetch all data in parallel for better performance
  const [
    establishmentResult,
    servicesResult,
    professionalsResult,
    promotionsResult,
    couponsResult,
    loyaltyResult,
  ] = await Promise.all([
    supabase
      .from('establishments')
      .select('id, name, phone, address, city, state, description, working_hours, cancellation_policy')
      .eq('id', establishmentId)
      .single(),
    supabase
      .from('services')
      .select('id, name, price, duration_minutes, description')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true),
    supabase
      .from('professionals')
      .select('id, name, specialties, working_hours')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true),
    supabase
      .from('promotions')
      .select('name, description, discount_value, discount_type, start_date, end_date')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true)
      .gte('end_date', new Date().toISOString()),
    supabase
      .from('discount_coupons')
      .select('code, description, discount_value, discount_type, valid_until, min_purchase_value')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true),
    supabase
      .from('loyalty_programs')
      .select(`
        name, description, points_per_currency,
        loyalty_rewards(name, points_required, reward_value)
      `)
      .eq('establishment_id', establishmentId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
  ]);

  const establishment = establishmentResult.data;
  if (!establishment) return null;

  // Filter valid coupons (not expired)
  const now = new Date().toISOString();
  const validCoupons = (couponsResult.data || []).filter(
    (c: any) => !c.valid_until || c.valid_until >= now
  );

  return {
    ...establishment,
    services: servicesResult.data || [],
    professionals: professionalsResult.data || [],
    promotions: promotionsResult.data || [],
    coupons: validCoupons,
    loyaltyProgram: loyaltyResult.data ? {
      name: loyaltyResult.data.name,
      description: loyaltyResult.data.description,
      points_per_currency: loyaltyResult.data.points_per_currency,
      rewards: (loyaltyResult.data as any).loyalty_rewards || [],
    } : null,
  };
}

async function getAssistantConfig(establishmentId: string): Promise<AssistantConfig | null> {
  const { data } = await supabase
    .from('establishment_ai_assistant')
    .select('*')
    .eq('establishment_id', establishmentId)
    .single();

  return data;
}

async function checkUsageLimits(establishmentId: string): Promise<{ allowed: boolean; reason?: string }> {
  // Check subscription status
  const { data: subscription } = await supabase
    .from('establishment_ai_subscriptions')
    .select('*')
    .eq('establishment_id', establishmentId)
    .single();

  if (!subscription) {
    // Create trial subscription
    await supabase.from('establishment_ai_subscriptions').insert({
      establishment_id: establishmentId,
      status: 'trial',
      trial_messages_used: 0,
    });
    return { allowed: true };
  }

  if (subscription.status === 'active') {
    return { allowed: true };
  }

  if (subscription.status === 'trial') {
    const { data: addon } = await supabase
      .from('platform_ai_addon')
      .select('trial_message_limit')
      .single();

    const limit = addon?.trial_message_limit || 200;

    if (subscription.trial_messages_used >= limit) {
      return {
        allowed: false,
        reason: `Limite de ${limit} mensagens gratuitas atingido. Assine o addon para continuar usando a assistente.`,
      };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: 'Assinatura inativa.' };
}

async function incrementUsage(establishmentId: string): Promise<void> {
  const monthYear = new Date().toISOString().slice(0, 7);

  try {
    // Update subscription trial count - fetch current value and increment
    const { data: subscription } = await supabase
      .from('establishment_ai_subscriptions')
      .select('id, trial_messages_used')
      .eq('establishment_id', establishmentId)
      .eq('status', 'trial')
      .single();

    if (subscription) {
      await supabase
        .from('establishment_ai_subscriptions')
        .update({ trial_messages_used: (subscription.trial_messages_used || 0) + 1 })
        .eq('id', subscription.id);
    }

    // Upsert monthly usage
    const { data: existing } = await supabase
      .from('ai_assistant_usage')
      .select('id, message_count')
      .eq('establishment_id', establishmentId)
      .eq('month_year', monthYear)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('ai_assistant_usage')
        .update({ message_count: (existing.message_count || 0) + 1 })
        .eq('id', existing.id);
    } else {
      await supabase.from('ai_assistant_usage').insert({
        establishment_id: establishmentId,
        month_year: monthYear,
        message_count: 1,
      });
    }
  } catch (error) {
    console.error('[AI-Assistant] Erro ao incrementar uso:', error);
    // Non-blocking - don't throw
  }
}

async function getClientFutureAppointments(establishmentId: string, clientId?: string, clientPhone?: string): Promise<any[]> {
  if (!clientId && !clientPhone) return [];

  const now = new Date().toISOString();
  
  let query = supabase
    .from('appointments')
    .select(`
      id,
      scheduled_at,
      status,
      client_name,
      client_phone,
      service:services(id, name, price),
      professional:professionals(id, name)
    `)
    .eq('establishment_id', establishmentId)
    .in('status', ['pending', 'confirmed'])
    .gte('scheduled_at', now)
    .order('scheduled_at', { ascending: true });

  if (clientId) {
    query = query.eq('client_id', clientId);
  } else if (clientPhone) {
    const phoneClean = clientPhone.replace(/\D/g, '');
    query = query.eq('client_phone', phoneClean);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }

  return data || [];
}

async function cancelAppointments(appointmentIds: string[], reason: string): Promise<{ success: boolean; cancelled: number; errors: string[] }> {
  const errors: string[] = [];
  let cancelled = 0;

  for (const id of appointmentIds) {
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_reason: reason,
        cancelled_via_whatsapp: false,
      })
      .eq('id', id);

    if (error) {
      console.error(`Error cancelling appointment ${id}:`, error);
      errors.push(id);
    } else {
      cancelled++;
    }
  }

  return { success: errors.length === 0, cancelled, errors };
}

// Check if there's a scheduling conflict for the professional
// scheduledAtUTC must be in UTC timezone
async function checkSchedulingConflict(
  establishmentId: string,
  professionalId: string,
  scheduledAtUTC: Date,
  durationMinutes: number
): Promise<{ hasConflict: boolean; conflictingAppointment?: any }> {
  try {
    // Calculate time window for query (4 hours before and after in UTC)
    const windowStart = new Date(scheduledAtUTC.getTime() - 4 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(scheduledAtUTC.getTime() + 4 * 60 * 60 * 1000).toISOString();

    console.log('[AI-Assistant] Verificando conflitos:', {
      professionalId,
      scheduledAtUTC: scheduledAtUTC.toISOString(),
      durationMinutes,
      windowStart,
      windowEnd,
    });

    // Check for overlapping appointments
    const { data: conflicts, error } = await supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes, client_name')
      .eq('establishment_id', establishmentId)
      .eq('professional_id', professionalId)
      .in('status', ['pending', 'confirmed'])
      .gte('scheduled_at', windowStart)
      .lte('scheduled_at', windowEnd)
      .limit(20);

    if (error) {
      console.error('[AI-Assistant] Erro ao buscar conflitos:', error);
      return { hasConflict: false }; // Fail open - let the appointment be created
    }

    if (!conflicts || conflicts.length === 0) {
      console.log('[AI-Assistant] Nenhum conflito encontrado');
      return { hasConflict: false };
    }

    console.log('[AI-Assistant] Agendamentos encontrados na janela:', conflicts.length);

    // Check each appointment for overlap
    for (const apt of conflicts) {
      const aptStart = new Date(apt.scheduled_at);
      const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60 * 1000);
      const newStart = scheduledAtUTC;
      const newEnd = new Date(scheduledAtUTC.getTime() + durationMinutes * 60 * 1000);

      // Check for overlap: (StartA < EndB) && (EndA > StartB)
      if (newStart < aptEnd && newEnd > aptStart) {
        console.log('[AI-Assistant] Conflito detectado com:', apt.id);
        return { hasConflict: true, conflictingAppointment: apt };
      }
    }

    return { hasConflict: false };
  } catch (error) {
    console.error('[AI-Assistant] Erro inesperado em checkSchedulingConflict:', error);
    return { hasConflict: false }; // Fail open
  }
}

// Parse Brazilian date formats to Date object
function parseBrazilianDate(dateStr: string, timeStr: string): Date | null {
  try {
    dateStr = dateStr.trim();
    timeStr = timeStr.trim();

    // Get current date in Brasília
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const localOffset = now.getTimezoneOffset();
    const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000);

    let day: number, month: number, year: number;
    const parts = dateStr.split('/');

    if (parts.length === 2) {
      // Format DD/MM - add current year, or next year if date has passed
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = brasiliaTime.getFullYear();

      // If the date has already passed this year, use next year
      const testDate = new Date(year, month - 1, day);
      if (testDate < brasiliaTime) {
        // Check if it's for "today" (same day)
        if (day !== brasiliaTime.getDate() || month !== brasiliaTime.getMonth() + 1) {
          year++;
        }
      }
    } else if (parts.length === 3) {
      // Format DD/MM/YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      // Handle 2-digit year
      if (year < 100) {
        year += 2000;
      }
    } else {
      console.error('[AI-Assistant] Formato de data inválido:', dateStr);
      return null;
    }

    // Parse time
    const timeParts = timeStr.split(':');
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1] || '0', 10);

    // Validate ranges
    if (day < 1 || day > 31 || month < 1 || month > 12 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      console.error('[AI-Assistant] Valores de data/hora fora do intervalo válido');
      return null;
    }

    // Create date in Brasília timezone
    const scheduledDate = new Date(year, month - 1, day, hour, minute, 0);

    // Validate the date is valid (e.g., Feb 30 would fail)
    if (scheduledDate.getDate() !== day || scheduledDate.getMonth() !== month - 1) {
      console.error('[AI-Assistant] Data inválida (dia não existe no mês)');
      return null;
    }

    return scheduledDate;
  } catch (e) {
    console.error('[AI-Assistant] Erro ao parsear data:', e);
    return null;
  }
}

// Convert Brasília time to UTC for storage
function brasiliaToUTC(brasiliaDate: Date): Date {
  return new Date(brasiliaDate.getTime() + 3 * 60 * 60 * 1000);
}

function formatWorkingHours(workingHours: any): string {
  // Check if working_hours is empty or not defined
  if (!workingHours || Object.keys(workingHours).length === 0) {
    return 'HORÁRIO NÃO CONFIGURADO - O estabelecimento NÃO informou o horário de funcionamento. SIGA O PROTOCOLO DE HORÁRIO NÃO CONFIGURADO.';
  }
  
  const days: Record<string, string> = {
    monday: 'Segunda',
    tuesday: 'Terça',
    wednesday: 'Quarta',
    thursday: 'Quinta',
    friday: 'Sexta',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };
  
  const lines: string[] = [];
  let hasAnyDayConfigured = false;
  
  for (const [key, label] of Object.entries(days)) {
    const day = workingHours[key];
    if (day?.enabled) {
      hasAnyDayConfigured = true;
      lines.push(`- ${label}: ${day.start} às ${day.end}`);
    } else if (day && day.enabled === false) {
      // Explicitly marked as closed
      lines.push(`- ${label}: Fechado`);
    }
    // Don't list days that aren't configured
  }
  
  // If no day is configured, return the warning message
  if (!hasAnyDayConfigured) {
    return 'HORÁRIO NÃO CONFIGURADO - O estabelecimento NÃO informou o horário de funcionamento. SIGA O PROTOCOLO DE HORÁRIO NÃO CONFIGURADO.';
  }
  
  return lines.join('\n');
}

function buildSystemPrompt(config: AssistantConfig, establishment: EstablishmentData, clientInfo?: { name?: string; phone?: string }): string {
  const styleGuide = config.language_style === 'formal'
    ? 'Use linguagem formal e profissional. Trate o cliente por "senhor(a)".'
    : 'Use linguagem amigável e casual, mas sempre profissional. Pode usar emojis moderadamente.';

  const servicesInfo = establishment.services.map(s => 
    `- ${s.name}: R$ ${s.price.toFixed(2)} (${s.duration_minutes} min)${s.description ? ` - ${s.description}` : ''}`
  ).join('\n');

  const professionalsInfo = establishment.professionals.map(p =>
    `- ${p.name}${p.specialties?.length ? ` (especialidades: ${p.specialties.join(', ')})` : ''}`
  ).join('\n');

  const promotionsInfo = establishment.promotions.length > 0
    ? establishment.promotions.map(p =>
        `- ${p.name}: ${p.discount_type === 'percentage' ? `${p.discount_value}% de desconto` : `R$ ${p.discount_value} de desconto`}${p.description ? ` - ${p.description}` : ''}`
      ).join('\n')
    : 'Nenhuma promoção ativa no momento.';

  // Cupons de desconto
  const couponsInfo = establishment.coupons.length > 0
    ? establishment.coupons.map(c =>
        `- Código: ${c.code} → ${c.discount_type === 'percentage' ? `${c.discount_value}% de desconto` : `R$ ${c.discount_value} de desconto`}${c.min_purchase_value ? ` (mínimo R$ ${c.min_purchase_value})` : ''}${c.description ? ` - ${c.description}` : ''}`
      ).join('\n')
    : 'Nenhum cupom disponível.';

  // Programa de fidelidade
  const loyaltyInfo = establishment.loyaltyProgram
    ? `Programa: ${establishment.loyaltyProgram.name}
${establishment.loyaltyProgram.description || ''}
- A cada R$ 1 gasto, o cliente ganha ${establishment.loyaltyProgram.points_per_currency} ponto(s)
Recompensas disponíveis:
${establishment.loyaltyProgram.rewards.map(r => `  • ${r.name}: ${r.points_required} pontos (vale R$ ${r.reward_value})`).join('\n') || '  Nenhuma recompensa cadastrada.'}`
    : 'Nenhum programa de fidelidade ativo.';

  // Endereço
  const addressInfo = [establishment.address, establishment.city, establishment.state].filter(Boolean).join(', ') || 'Endereço não informado';

  // Client context section
  const clientContext = clientInfo?.name 
    ? `\n## Cliente Atual
O cliente que está conversando com você:
- Nome: ${clientInfo.name}
- Telefone: ${clientInfo.phone || 'Não informado'}

IMPORTANTE: Você JÁ SABE o nome e telefone deste cliente. NÃO pergunte novamente essas informações! Use o nome dele nas conversas para torná-las mais pessoais.`
    : `\n## Cliente Atual
O cliente ainda não está identificado. Você precisará coletar nome e telefone apenas se ele quiser agendar algo.`;

  // Obter data atual no fuso horário de Brasília
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const localOffset = now.getTimezoneOffset();
  const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000);
  
  const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  
  const diaAtual = brasiliaTime.getDate().toString().padStart(2, '0');
  const mesAtual = (brasiliaTime.getMonth() + 1).toString().padStart(2, '0');
  const anoAtual = brasiliaTime.getFullYear();
  const horaAtual = brasiliaTime.getHours().toString().padStart(2, '0');
  const minutoAtual = brasiliaTime.getMinutes().toString().padStart(2, '0');
  const diaSemanaAtual = diasSemana[brasiliaTime.getDay()];
  const mesNomeAtual = meses[brasiliaTime.getMonth()];

  // Calcular data de amanhã corretamente
  const amanha = new Date(brasiliaTime.getTime() + 24 * 60 * 60 * 1000);
  const diaAmanha = amanha.getDate().toString().padStart(2, '0');
  const mesAmanha = (amanha.getMonth() + 1).toString().padStart(2, '0');
  const anoAmanha = amanha.getFullYear();

  const dataHoraInfo = `
## Data e Hora Atual (Brasília - UTC-3)
- Data: ${diaAtual}/${mesAtual}/${anoAtual} (${diaSemanaAtual}, ${diaAtual} de ${mesNomeAtual} de ${anoAtual})
- Hora: ${horaAtual}:${minutoAtual}
- "Amanhã" significa ${diaAmanha}/${mesAmanha}/${anoAmanha}

CRÍTICO: Use SEMPRE a data correta ao confirmar agendamentos. Hoje é ${diaAtual}/${mesAtual}/${anoAtual}. NÃO invente datas!`;

  return `Você é ${config.assistant_name}, assistente virtual do ${establishment.name}.
${dataHoraInfo}

## Informações do Estabelecimento
- **Nome**: ${establishment.name}
- **Telefone**: ${establishment.phone || 'Não informado'}
- **Endereço**: ${addressInfo}
${establishment.description ? `- **Sobre**: ${establishment.description}` : ''}

## Horário de Funcionamento
${formatWorkingHours(establishment.working_hours)}

## Estilo de Comunicação
${styleGuide}
${clientContext}

## Suas Capacidades
1. **Agendamentos**: Ajudar clientes a agendar serviços
2. **Remarcações**: Auxiliar na remarcação de agendamentos existentes
3. **Cancelamentos**: Ajudar clientes a cancelar agendamentos
4. **Promoções e Cupons**: Informar sobre promoções ativas e cupons de desconto
5. **Programa de Fidelidade**: Explicar como funciona o programa e recompensas
6. **Fila de Espera**: Se a data/hora desejada estiver ocupada, oferecer alternativas ou adicionar à fila de espera
7. **Informações**: Responder dúvidas sobre serviços, preços, endereço e funcionamento

## Serviços Disponíveis
${servicesInfo || 'Nenhum serviço cadastrado.'}

## Profissionais
${professionalsInfo || 'Nenhum profissional cadastrado.'}

## Promoções Ativas
${promotionsInfo}

## Cupons de Desconto
${couponsInfo}

## Programa de Fidelidade
${loyaltyInfo}

${establishment.cancellation_policy ? `## Política de Cancelamento\n${establishment.cancellation_policy}` : ''}

## Instruções Especiais
${config.custom_instructions || 'Sem instruções adicionais.'}

## Regras CRÍTICAS - SIGA RIGOROSAMENTE
1. NUNCA invente informações - se não souber, diga que vai verificar ou encaminhe para humano
2. SEJA OBJETIVO E DIRETO - responda exatamente o que foi perguntado
3. Se o cliente pedir "o mais rápido possível" ou "primeiro horário disponível", NÃO pergunte preferência de horário. Sugira imediatamente o próximo horário disponível
4. Se o cliente disser "qualquer profissional" ou "independente de profissional", NÃO pergunte qual profissional prefere
5. NÃO faça perguntas redundantes - se você já tem a informação, USE-A
6. Para agendar, confirme apenas as informações que FALTAM: serviço, profissional (se não especificado que pode ser qualquer um), data e horário
7. Mantenha respostas CONCISAS - máximo 2 parágrafos curtos
8. Se o cliente mencionar uma data/hora ocupada, sugira alternativas imediatamente
9. Se não conseguir resolver, ofereça encaminhar para atendimento humano
10. USE A DATA ATUAL CORRETA: Hoje é ${diaAtual}/${mesAtual}/${anoAtual}. Amanhã é ${diaAmanha}/${mesAmanha}/${anoAmanha}. NUNCA invente datas!
11. Ao informar sobre cupons, diga o código exato para o cliente usar
12. Ao falar de fidelidade, explique quanto vale cada ponto e quais recompensas estão disponíveis

## PROTOCOLO DE HORÁRIO NÃO CONFIGURADO - CRÍTICO!
Se você ver a mensagem "HORÁRIO NÃO CONFIGURADO" nas informações de horário acima, você DEVE:
1. Informar ao cliente: "Infelizmente, o estabelecimento ainda não nos informou seus horários de funcionamento"
2. Pedir desculpas pela inconveniência
3. Sugerir que o cliente entre em contato diretamente com o estabelecimento pelo telefone: ${establishment.phone || 'não informado'}
4. Dizer que você vai notificar o estabelecimento sobre essa situação
5. Encerrar a conversa educadamente
6. Incluir [NOTIFICAR_HORARIO] ao final da sua mensagem para gerar notificação ao estabelecimento
7. NÃO tente agendar, nem dar informações de horário, nem prosseguir com atendimento normal

## CANCELAMENTOS - REGRA ESPECIAL
Quando o cliente mencionar palavras como "cancelar", "desmarcar", "não vou poder ir", "preciso desmarcar":
- Responda IMEDIATAMENTE com [LISTAR_AGENDAMENTOS] no final da sua mensagem
- NÃO pergunte detalhes do agendamento, o sistema irá mostrar botões automaticamente
- Exemplo de resposta: "Claro, vou buscar seus agendamentos para que você possa selecionar qual deseja cancelar. [LISTAR_AGENDAMENTOS]"

## Ações Especiais
- Para escalar para humano, inclua [ESCALAR] no final da resposta
- Para adicionar à fila de espera, inclua [FILA_ESPERA:serviço:data:horário] no final
- Para agendar, inclua [AGENDAR:serviço:profissional:data:horário:nome:telefone] no final (use a data no formato DD/MM/AAAA)
- Para buscar agendamentos do cliente (cancelamento), inclua [LISTAR_AGENDAMENTOS] no final
- Para notificar estabelecimento sobre horário não configurado, inclua [NOTIFICAR_HORARIO] no final`;
}

function isWorkingHoursConfigured(workingHours: any): boolean {
  if (!workingHours || Object.keys(workingHours).length === 0) {
    return false;
  }
  
  // Check if at least one day is configured
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days.some(day => workingHours[day]?.enabled === true || workingHours[day]?.enabled === false);
}

function isWithinWorkingHours(workingHours: any): { configured: boolean; withinHours: boolean } {
  // If working_hours is null, undefined, or empty object - NOT configured
  if (!workingHours || Object.keys(workingHours).length === 0) {
    console.log('[AI-Assistant] Horário não configurado');
    return { configured: false, withinHours: false };
  }

  // Check if any day has configuration
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const hasAnyConfig = days.some(day => workingHours[day]?.enabled === true || workingHours[day]?.enabled === false);
  
  if (!hasAnyConfig) {
    console.log('[AI-Assistant] Nenhum dia configurado no horário');
    return { configured: false, withinHours: false };
  }

  // Converter para horário de Brasília (UTC-3)
  const now = new Date();
  const brasiliaOffset = -3 * 60; // UTC-3 em minutos
  const localOffset = now.getTimezoneOffset(); // Offset local em minutos
  const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000);
  
  const today = days[brasiliaTime.getDay()];
  const todayConfig = workingHours[today];

  // If this specific day is not configured, consider closed (not explicitly open)
  if (!todayConfig || todayConfig.enabled === undefined) {
    console.log(`[AI-Assistant] Dia ${today} não configurado - considerando fechado`);
    return { configured: true, withinHours: false };
  }

  // If day exists but is explicitly disabled
  if (todayConfig.enabled === false) {
    console.log(`[AI-Assistant] Dia ${today} explicitamente fechado`);
    return { configured: true, withinHours: false };
  }

  // If day is enabled, check time range
  if (todayConfig.enabled && todayConfig.start && todayConfig.end) {
    const hours = brasiliaTime.getHours().toString().padStart(2, '0');
    const minutes = brasiliaTime.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    
    const isWithin = currentTime >= todayConfig.start && currentTime <= todayConfig.end;
    console.log(`[AI-Assistant] Horário atual (BRT): ${currentTime}, Configurado: ${todayConfig.start}-${todayConfig.end}, Dentro: ${isWithin}`);
    
    return { configured: true, withinHours: isWithin };
  }

  // Default to closed if configuration is incomplete
  console.log(`[AI-Assistant] Configuração incompleta para ${today} - considerando fechado`);
  return { configured: true, withinHours: false };
}

function formatAppointmentDate(dateString: string): string {
  const date = new Date(dateString);
  const brasiliaOffset = -3 * 60;
  const localOffset = date.getTimezoneOffset();
  const brasiliaTime = new Date(date.getTime() + (localOffset + brasiliaOffset) * 60 * 1000);
  
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dia = brasiliaTime.getDate().toString().padStart(2, '0');
  const mes = (brasiliaTime.getMonth() + 1).toString().padStart(2, '0');
  const hora = brasiliaTime.getHours().toString().padStart(2, '0');
  const minuto = brasiliaTime.getMinutes().toString().padStart(2, '0');
  const diaSemana = diasSemana[brasiliaTime.getDay()];
  
  return `${diaSemana}, ${dia}/${mes} às ${hora}:${minuto}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      action,
      establishmentId,
      conversationId,
      message,
      messageType = 'text',
      voiceTranscription,
      clientName,
      clientPhone,
      clientId,
      appointmentIds,
      cancelReason,
    } = await req.json();

    console.log('AI Assistant request:', { action, establishmentId, conversationId, messageType });

    // Get assistant config
    const config = await getAssistantConfig(establishmentId);
    if (!config || !config.is_enabled) {
      return new Response(
        JSON.stringify({ error: 'Assistente virtual não está habilitada para este estabelecimento.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check working hours
    const workingHoursStatus = isWithinWorkingHours(config.working_hours);
    
    // Only apply business hours restriction if hours ARE configured
    if (config.availability_mode === 'only_business_hours' && workingHoursStatus.configured && !workingHoursStatus.withinHours) {
      return new Response(
        JSON.stringify({ 
          offline: true,
          message: config.offline_message || 'Estamos fora do horário de atendimento.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check usage limits
    const usageCheck = await checkUsageLimits(establishmentId);
    if (!usageCheck.allowed) {
      return new Response(
        JSON.stringify({ error: usageCheck.reason, limitReached: true }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get establishment data
    const establishment = await getEstablishmentData(establishmentId);
    if (!establishment) {
      return new Response(
        JSON.stringify({ error: 'Estabelecimento não encontrado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    if (action === 'start_conversation') {
      // Create conversation with client info if available
      const { data: conversation, error: convError } = await supabase
        .from('ai_assistant_conversations')
        .insert({
          establishment_id: establishmentId,
          client_id: clientId || null,
          client_name: clientName || null,
          client_phone: clientPhone || null,
          channel: 'portal',
          status: 'active',
        })
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        throw convError;
      }

      // Send welcome message
      const welcomeMessage = config.welcome_message || 
        `Olá! Sou ${config.assistant_name}, assistente virtual do ${establishment.name}. Como posso ajudar?`;

      await supabase.from('ai_assistant_messages').insert({
        conversation_id: conversation.id,
        sender_type: 'assistant',
        message_type: 'text',
        content: welcomeMessage,
      });

      // Add offline notice if outside hours (only if hours are configured)
      let offlineNotice = null;
      if (workingHoursStatus.configured && !workingHoursStatus.withinHours && config.availability_mode === '24h_with_message') {
        offlineNotice = config.offline_message;
      }

      return new Response(
        JSON.stringify({
          conversationId: conversation.id,
          welcomeMessage,
          offlineNotice,
          assistantName: config.assistant_name,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Get client's future appointments for cancellation
    if (action === 'get_appointments') {
      const appointments = await getClientFutureAppointments(establishmentId, clientId, clientPhone);
      
      const formattedAppointments = appointments.map(apt => ({
        id: apt.id,
        serviceName: apt.service?.name || 'Serviço',
        professionalName: apt.professional?.name || 'Profissional',
        dateTime: formatAppointmentDate(apt.scheduled_at),
        status: apt.status,
        price: apt.service?.price || 0,
      }));

      return new Response(
        JSON.stringify({ appointments: formattedAppointments }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Cancel selected appointments
    if (action === 'cancel_appointments') {
      if (!appointmentIds || appointmentIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Nenhum agendamento selecionado.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await cancelAppointments(appointmentIds, cancelReason || 'Cancelado pelo cliente via assistente virtual');
      
      // Save cancellation message to conversation
      if (conversationId) {
        const cancelMessage = result.success
          ? `✅ ${result.cancelled} agendamento(s) cancelado(s) com sucesso!`
          : `⚠️ ${result.cancelled} agendamento(s) cancelado(s), mas houve ${result.errors.length} erro(s).`;

        await supabase.from('ai_assistant_messages').insert({
          conversation_id: conversationId,
          sender_type: 'assistant',
          message_type: 'text',
          content: cancelMessage,
        });
      }

      return new Response(
        JSON.stringify({ 
          success: result.success,
          cancelled: result.cancelled,
          message: result.success 
            ? `${result.cancelled} agendamento(s) cancelado(s) com sucesso!`
            : `Alguns agendamentos não puderam ser cancelados.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send_message') {
      if (!conversationId || !message) {
        return new Response(
          JSON.stringify({ error: 'conversationId e message são obrigatórios.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Save user message
      await supabase.from('ai_assistant_messages').insert({
        conversation_id: conversationId,
        sender_type: 'client',
        message_type: messageType,
        content: message,
        voice_transcription: voiceTranscription,
      });

      // Get conversation history
      const { data: messages } = await supabase
        .from('ai_assistant_messages')
        .select('sender_type, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20);

      // Build messages for AI
      const chatMessages: ChatMessage[] = messages?.map(m => ({
        role: m.sender_type === 'client' ? 'user' : 'assistant',
        content: m.content,
      })) || [];

      // Add system prompt with client context
      const systemPrompt = buildSystemPrompt(config, establishment, { name: clientName, phone: clientPhone });

      // Call AI
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            ...chatMessages,
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Muitas requisições. Tente novamente em alguns segundos.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'Erro de créditos. Entre em contato com o suporte.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`AI API error: ${response.status}`);
      }

      const aiResponse = await response.json();
      let assistantMessage = aiResponse.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

      // Check for special actions
      let shouldEscalate = false;
      let waitlistData = null;
      let scheduleData: { 
        service: any; 
        professional: any; 
        date: any; 
        time: any; 
        name: any; 
        phone: any; 
        appointmentId?: string; 
        created?: boolean;
        error?: string;
        conflict?: boolean;
      } | null = null;
      let showAppointmentsList = false;
      let notifyWorkingHours = false;

      // Check for cancellation flow trigger
      if (assistantMessage.includes('[LISTAR_AGENDAMENTOS]')) {
        showAppointmentsList = true;
        assistantMessage = assistantMessage.replace('[LISTAR_AGENDAMENTOS]', '').trim();
      }

      // Check for working hours notification
      if (assistantMessage.includes('[NOTIFICAR_HORARIO]')) {
        notifyWorkingHours = true;
        assistantMessage = assistantMessage.replace('[NOTIFICAR_HORARIO]', '').trim();
        
        // Create notification for establishment about missing working hours
        try {
          // Get conversation summary
          const { data: recentMessages } = await supabase
            .from('ai_assistant_messages')
            .select('sender_type, content')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(5);

          const conversationSummary = recentMessages?.reverse()
            .map(m => `${m.sender_type === 'client' ? 'Cliente' : 'Assistente'}: ${m.content.slice(0, 100)}`)
            .join('\n') || 'Sem histórico';

          console.log('[AI-Assistant] Notificação de horário não configurado - Resumo:', conversationSummary);

          // Send WhatsApp notification to establishment if configured
          if (config.escalation_whatsapp) {
            const Z_API_INSTANCE_ID = Deno.env.get('Z_API_INSTANCE_ID');
            const Z_API_TOKEN = Deno.env.get('Z_API_TOKEN');
            const Z_API_CLIENT_TOKEN = Deno.env.get('Z_API_CLIENT_TOKEN') || Z_API_TOKEN;

            if (Z_API_INSTANCE_ID && Z_API_TOKEN) {
              const notificationMessage = `⚠️ *Ação Necessária - ${establishment.name}*\n\n` +
                `*Problema:* Horário de funcionamento não configurado\n\n` +
                `Um cliente tentou obter informações sobre o horário de funcionamento, mas o estabelecimento ainda não configurou essas informações no sistema.\n\n` +
                `*Cliente:* ${clientName || 'Não identificado'}\n` +
                `*Telefone:* ${clientPhone || 'Não informado'}\n\n` +
                `*Resumo da conversa:*\n${conversationSummary}\n\n` +
                `*O que fazer:*\nAcesse o portal e configure o horário de funcionamento em:\n` +
                `Configurações > Informações do Estabelecimento > Horário de Funcionamento\n\n` +
                `Isso permitirá que a assistente virtual atenda melhor seus clientes.`;

              const formattedPhone = config.escalation_whatsapp.replace(/\D/g, '');
              const phoneToSend = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (Z_API_CLIENT_TOKEN) {
                headers['Client-Token'] = Z_API_CLIENT_TOKEN;
              }

              const zapiResponse = await fetch(
                `https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/send-text`,
                {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ phone: phoneToSend, message: notificationMessage }),
                }
              );

              if (zapiResponse.ok) {
                console.log(`[AI-Assistant] Notificação de horário enviada via WhatsApp para: ${phoneToSend.slice(-4)}`);
              } else {
                const errorText = await zapiResponse.text();
                console.error(`[AI-Assistant] Erro ao enviar notificação: ${zapiResponse.status} - ${errorText}`);
              }
            }
          }
        } catch (error) {
          console.error('[AI-Assistant] Erro ao processar notificação de horário:', error);
        }
      }

      if (assistantMessage.includes('[ESCALAR]')) {
        shouldEscalate = true;
        assistantMessage = assistantMessage.replace('[ESCALAR]', '').trim();
        
        // Update conversation status
        await supabase
          .from('ai_assistant_conversations')
          .update({ status: 'escalated', escalated_at: new Date().toISOString() })
          .eq('id', conversationId);

        // Enviar WhatsApp ao estabelecimento via instância Z-API do SaaS
        if (config.escalation_whatsapp) {
          const Z_API_INSTANCE_ID = Deno.env.get('Z_API_INSTANCE_ID');
          const Z_API_TOKEN = Deno.env.get('Z_API_TOKEN');
          const Z_API_CLIENT_TOKEN = Deno.env.get('Z_API_CLIENT_TOKEN') || Z_API_TOKEN;

          if (Z_API_INSTANCE_ID && Z_API_TOKEN) {
            try {
              // Buscar resumo da conversa para contexto
              const { data: recentMessages } = await supabase
                .from('ai_assistant_messages')
                .select('sender_type, content')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(5);

              const conversationSummary = recentMessages?.reverse()
                .map(m => `${m.sender_type === 'client' ? 'Cliente' : 'Assistente'}: ${m.content.slice(0, 100)}`)
                .join('\n') || 'Sem histórico';

              const escalationMessage = `🚨 *Escalonamento - ${establishment.name}*\n\n` +
                `*Cliente:* ${clientName || 'Não informado'}\n` +
                `*Telefone:* ${clientPhone || 'Não informado'}\n` +
                `*Canal:* Portal de agendamento\n\n` +
                `*Resumo da conversa:*\n${conversationSummary}\n\n` +
                `O cliente solicitou atendimento humano.`;

              const formattedPhone = config.escalation_whatsapp.replace(/\D/g, '');
              const phoneToSend = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (Z_API_CLIENT_TOKEN) {
                headers['Client-Token'] = Z_API_CLIENT_TOKEN;
              }

              const zapiResponse = await fetch(
                `https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/send-text`,
                {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ phone: phoneToSend, message: escalationMessage }),
                }
              );

              if (zapiResponse.ok) {
                console.log(`[AI-Assistant] Escalação enviada via WhatsApp para: ${phoneToSend.slice(-4)}`);
              } else {
                const errorText = await zapiResponse.text();
                console.error(`[AI-Assistant] Erro ao enviar escalação: ${zapiResponse.status} - ${errorText}`);
              }
            } catch (error) {
              console.error('[AI-Assistant] Erro ao enviar WhatsApp de escalação:', error);
            }
          } else {
            console.log('[AI-Assistant] Z-API não configurado, escalação não enviada via WhatsApp');
          }
        }
      }

      const waitlistMatch = assistantMessage.match(/\[FILA_ESPERA:([^:]+):([^:]+):([^\]]+)\]/);
      if (waitlistMatch) {
        waitlistData = {
          service: waitlistMatch[1],
          date: waitlistMatch[2],
          time: waitlistMatch[3],
        };
        assistantMessage = assistantMessage.replace(waitlistMatch[0], '').trim();
      }

      const scheduleMatch = assistantMessage.match(/\[AGENDAR:([^:]+):([^:]+):([^:]+):([^:]+):([^:]+):([^\]]+)\]/);
      if (scheduleMatch) {
        scheduleData = {
          service: scheduleMatch[1],
          professional: scheduleMatch[2],
          date: scheduleMatch[3],
          time: scheduleMatch[4],
          name: scheduleMatch[5],
          phone: scheduleMatch[6],
        };
        assistantMessage = assistantMessage.replace(scheduleMatch[0], '').trim();

        // Actually create the appointment in the database
        try {
          console.log('[AI-Assistant] Tentando criar agendamento:', scheduleData);
          
          // Find service by name (case-insensitive partial match)
          const { data: serviceData } = await supabase
            .from('services')
            .select('id, name, price, duration_minutes')
            .eq('establishment_id', establishmentId)
            .ilike('name', `%${scheduleData.service.trim()}%`)
            .eq('is_active', true)
            .limit(1)
            .single();

          if (!serviceData) {
            console.error('[AI-Assistant] Serviço não encontrado:', scheduleData.service);
            scheduleData.error = 'Serviço não encontrado';
          } else {
            // Find professional by name (case-insensitive partial match)
            const { data: professionalData } = await supabase
              .from('professionals')
              .select('id, name')
              .eq('establishment_id', establishmentId)
              .ilike('name', `%${scheduleData.professional.trim()}%`)
              .eq('is_active', true)
              .limit(1)
              .single();

            if (!professionalData) {
              console.error('[AI-Assistant] Profissional não encontrado:', scheduleData.professional);
              scheduleData.error = 'Profissional não encontrado';
            } else {
              // Parse date using the robust function
              const scheduledDateBrasilia = parseBrazilianDate(scheduleData.date, scheduleData.time);
              
              if (!scheduledDateBrasilia) {
                console.error('[AI-Assistant] Erro ao parsear data/hora:', scheduleData.date, scheduleData.time);
                scheduleData.error = 'Data ou horário inválido';
              } else {
                // Check if the date is in the past
                const now = new Date();
                const brasiliaOffset = -3 * 60;
                const localOffset = now.getTimezoneOffset();
                const nowBrasilia = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000);
                
                if (scheduledDateBrasilia < nowBrasilia) {
                  console.error('[AI-Assistant] Data no passado:', scheduledDateBrasilia);
                  scheduleData.error = 'Não é possível agendar para uma data/hora que já passou';
                } else {
                  // Convert to UTC for storage
                  const scheduledAtUTC = brasiliaToUTC(scheduledDateBrasilia);
                  
                  console.log('[AI-Assistant] Data agendada (Brasília):', scheduledDateBrasilia.toISOString());
                  console.log('[AI-Assistant] Data agendada (UTC):', scheduledAtUTC.toISOString());

                  // Check for scheduling conflicts
                  const conflictCheck = await checkSchedulingConflict(
                    establishmentId,
                    professionalData.id,
                    scheduledAtUTC,
                    serviceData.duration_minutes
                  );

                  if (conflictCheck.hasConflict) {
                    console.error('[AI-Assistant] Conflito de horário detectado');
                    scheduleData.error = `Horário já ocupado. ${professionalData.name} já tem um agendamento neste horário.`;
                    scheduleData.conflict = true;
                  } else {
                    // Find or create client
                    const phoneClean = (scheduleData.phone || clientPhone || '').replace(/\D/g, '');
                    let appointmentClientId = clientId;

                    // Validate clientId exists if provided
                    if (appointmentClientId) {
                      const { data: existingClientById } = await supabase
                        .from('clients')
                        .select('id')
                        .eq('id', appointmentClientId)
                        .eq('establishment_id', establishmentId)
                        .maybeSingle();
                      
                      if (!existingClientById) {
                        console.warn('[AI-Assistant] clientId fornecido não existe, tentando por telefone');
                        appointmentClientId = undefined;
                      }
                    }

                    if (!appointmentClientId && phoneClean) {
                      // Try to find existing client by phone
                      const { data: existingClient } = await supabase
                        .from('clients')
                        .select('id')
                        .eq('establishment_id', establishmentId)
                        .eq('phone', phoneClean)
                        .maybeSingle();

                      if (existingClient) {
                        appointmentClientId = existingClient.id;
                        console.log('[AI-Assistant] Cliente encontrado por telefone:', appointmentClientId);
                      } else if (phoneClean.length >= 10) {
                        // Create new client only if phone is valid
                        const { data: newClient, error: clientError } = await supabase
                          .from('clients')
                          .insert({
                            establishment_id: establishmentId,
                            name: scheduleData.name || clientName || 'Cliente',
                            phone: phoneClean,
                          })
                          .select('id')
                          .single();

                        if (clientError) {
                          console.error('[AI-Assistant] Erro ao criar cliente:', clientError);
                        } else if (newClient) {
                          appointmentClientId = newClient.id;
                          console.log('[AI-Assistant] Novo cliente criado:', appointmentClientId);
                        }
                      }
                    }

                    // Create the appointment
                    const { data: newAppointment, error: appointmentError } = await supabase
                      .from('appointments')
                      .insert({
                        establishment_id: establishmentId,
                        service_id: serviceData.id,
                        professional_id: professionalData.id,
                        client_id: appointmentClientId || null,
                        client_name: scheduleData.name || clientName || 'Cliente',
                        client_phone: phoneClean,
                        scheduled_at: scheduledAtUTC.toISOString(),
                        duration_minutes: serviceData.duration_minutes,
                        price: serviceData.price,
                        status: 'pending',
                      })
                      .select()
                      .single();

                    if (appointmentError) {
                      console.error('[AI-Assistant] Erro ao criar agendamento:', appointmentError);
                      scheduleData.error = 'Erro ao salvar agendamento no banco de dados';
                    } else {
                      console.log('[AI-Assistant] Agendamento criado com sucesso:', newAppointment.id);
                      scheduleData.appointmentId = newAppointment.id;
                      scheduleData.created = true;
                    }
                  }
                }
              }
            }
          }
        } catch (scheduleError) {
          console.error('[AI-Assistant] Erro no processo de agendamento:', scheduleError);
          scheduleData.error = 'Erro interno ao processar agendamento';
        }
      }

      // Save assistant message
      await supabase.from('ai_assistant_messages').insert({
        conversation_id: conversationId,
        sender_type: 'assistant',
        message_type: 'text',
        content: assistantMessage,
        metadata: { waitlistData, scheduleData, shouldEscalate, showAppointmentsList },
      });

      // Increment usage
      await incrementUsage(establishmentId);

      return new Response(
        JSON.stringify({
          message: assistantMessage,
          shouldEscalate,
          waitlistData,
          scheduleData,
          showAppointmentsList,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'transcribe_voice') {
      // This would integrate with a speech-to-text service
      // For now, return a placeholder
      return new Response(
        JSON.stringify({ 
          error: 'Transcrição de voz ainda não implementada. Use a Lovable AI diretamente.' 
        }),
        { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in AI assistant:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
