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
  working_hours: any;
  services: Array<{ id: string; name: string; price: number; duration_minutes: number }>;
  professionals: Array<{ id: string; name: string; specialties: string[] }>;
  promotions: Array<{ name: string; description: string; discount_value: number; discount_type: string }>;
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
  const { data: establishment } = await supabase
    .from('establishments')
    .select('id, name, phone, working_hours')
    .eq('id', establishmentId)
    .single();

  if (!establishment) return null;

  const { data: services } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes')
    .eq('establishment_id', establishmentId)
    .eq('is_active', true);

  const { data: professionals } = await supabase
    .from('professionals')
    .select('id, name, specialties')
    .eq('establishment_id', establishmentId)
    .eq('is_active', true);

  const { data: promotions } = await supabase
    .from('promotions')
    .select('name, description, discount_value, discount_type')
    .eq('establishment_id', establishmentId)
    .eq('is_active', true)
    .gte('end_date', new Date().toISOString());

  return {
    ...establishment,
    services: services || [],
    professionals: professionals || [],
    promotions: promotions || [],
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

  // Update subscription trial count
  await supabase
    .from('establishment_ai_subscriptions')
    .update({ trial_messages_used: supabase.rpc('increment', { x: 1 }) })
    .eq('establishment_id', establishmentId)
    .eq('status', 'trial');

  // Upsert monthly usage
  const { data: existing } = await supabase
    .from('ai_assistant_usage')
    .select('id, message_count')
    .eq('establishment_id', establishmentId)
    .eq('month_year', monthYear)
    .single();

  if (existing) {
    await supabase
      .from('ai_assistant_usage')
      .update({ message_count: existing.message_count + 1 })
      .eq('id', existing.id);
  } else {
    await supabase.from('ai_assistant_usage').insert({
      establishment_id: establishmentId,
      month_year: monthYear,
      message_count: 1,
    });
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

function buildSystemPrompt(config: AssistantConfig, establishment: EstablishmentData, clientInfo?: { name?: string; phone?: string }): string {
  const styleGuide = config.language_style === 'formal'
    ? 'Use linguagem formal e profissional. Trate o cliente por "senhor(a)".'
    : 'Use linguagem amigável e casual, mas sempre profissional. Pode usar emojis moderadamente.';

  const servicesInfo = establishment.services.map(s => 
    `- ${s.name}: R$ ${s.price.toFixed(2)} (${s.duration_minutes} min)`
  ).join('\n');

  const professionalsInfo = establishment.professionals.map(p =>
    `- ${p.name}${p.specialties?.length ? ` (especialidades: ${p.specialties.join(', ')})` : ''}`
  ).join('\n');

  const promotionsInfo = establishment.promotions.length > 0
    ? establishment.promotions.map(p =>
        `- ${p.name}: ${p.discount_type === 'percentage' ? `${p.discount_value}% de desconto` : `R$ ${p.discount_value} de desconto`}${p.description ? ` - ${p.description}` : ''}`
      ).join('\n')
    : 'Nenhuma promoção ativa no momento.';

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

  const dataHoraInfo = `
## Data e Hora Atual (Brasília)
- Data: ${diaAtual}/${mesAtual}/${anoAtual} (${diaSemanaAtual}, ${diaAtual} de ${mesNomeAtual} de ${anoAtual})
- Hora: ${horaAtual}:${minutoAtual}
- "Amanhã" significa ${new Date(brasiliaTime.getTime() + 24 * 60 * 60 * 1000).getDate().toString().padStart(2, '0')}/${mesAtual}/${anoAtual}

CRÍTICO: Use SEMPRE a data correta ao confirmar agendamentos. Hoje é ${diaAtual}/${mesAtual}/${anoAtual}, NÃO invente datas!`;

  return `Você é ${config.assistant_name}, assistente virtual do ${establishment.name}.
${dataHoraInfo}

## Estilo de Comunicação
${styleGuide}
${clientContext}

## Suas Capacidades
1. **Agendamentos**: Ajudar clientes a agendar serviços
2. **Remarcações**: Auxiliar na remarcação de agendamentos existentes
3. **Cancelamentos**: Ajudar clientes a cancelar agendamentos
4. **Promoções**: Informar sobre promoções ativas
5. **Fila de Espera**: Se a data/hora desejada estiver ocupada, oferecer alternativas ou adicionar à fila de espera
6. **Informações**: Responder dúvidas sobre serviços, preços e funcionamento

## Serviços Disponíveis
${servicesInfo || 'Nenhum serviço cadastrado.'}

## Profissionais
${professionalsInfo || 'Nenhum profissional cadastrado.'}

## Promoções Ativas
${promotionsInfo}

## Instruções Especiais
${config.custom_instructions || 'Sem instruções adicionais.'}

## Regras CRÍTICAS - SIGA RIGOROSAMENTE
1. NUNCA invente informações - se não souber, diga que vai verificar
2. SEJA OBJETIVO E DIRETO - responda exatamente o que foi perguntado
3. Se o cliente pedir "o mais rápido possível" ou "primeiro horário disponível", NÃO pergunte preferência de horário. Sugira imediatamente o próximo horário disponível
4. Se o cliente disser "qualquer profissional" ou "independente de profissional", NÃO pergunte qual profissional prefere
5. NÃO faça perguntas redundantes - se você já tem a informação, USE-A
6. Para agendar, confirme apenas as informações que FALTAM: serviço, profissional (se não especificado que pode ser qualquer um), data e horário
7. Mantenha respostas CONCISAS - máximo 2 parágrafos curtos
8. Se o cliente mencionar uma data/hora ocupada, sugira alternativas imediatamente
9. Se não conseguir resolver, ofereça encaminhar para atendimento humano
10. USE A DATA ATUAL CORRETA: Hoje é ${diaAtual}/${mesAtual}/${anoAtual}. Amanhã é ${new Date(brasiliaTime.getTime() + 24 * 60 * 60 * 1000).getDate().toString().padStart(2, '0')}/${mesAtual}/${anoAtual}. NUNCA invente datas!

## CANCELAMENTOS - REGRA ESPECIAL
Quando o cliente mencionar palavras como "cancelar", "desmarcar", "não vou poder ir", "preciso desmarcar":
- Responda IMEDIATAMENTE com [LISTAR_AGENDAMENTOS] no final da sua mensagem
- NÃO pergunte detalhes do agendamento, o sistema irá mostrar botões automaticamente
- Exemplo de resposta: "Claro, vou buscar seus agendamentos para que você possa selecionar qual deseja cancelar. [LISTAR_AGENDAMENTOS]"

## Ações Especiais
- Para escalar para humano, inclua [ESCALAR] no final da resposta
- Para adicionar à fila de espera, inclua [FILA_ESPERA:serviço:data:horário] no final
- Para agendar, inclua [AGENDAR:serviço:profissional:data:horário:nome:telefone] no final
- Para buscar agendamentos do cliente (cancelamento), inclua [LISTAR_AGENDAMENTOS] no final

Telefone do estabelecimento: ${establishment.phone || 'Não informado'}`;
}

function isWithinWorkingHours(workingHours: any): boolean {
  if (!workingHours) return true;

  // Converter para horário de Brasília (UTC-3)
  const now = new Date();
  const brasiliaOffset = -3 * 60; // UTC-3 em minutos
  const localOffset = now.getTimezoneOffset(); // Offset local em minutos
  const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000);
  
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[brasiliaTime.getDay()];
  const todayConfig = workingHours[today];

  if (!todayConfig?.enabled) {
    console.log(`[AI-Assistant] Dia ${today} não está habilitado`);
    return false;
  }

  const hours = brasiliaTime.getHours().toString().padStart(2, '0');
  const minutes = brasiliaTime.getMinutes().toString().padStart(2, '0');
  const currentTime = `${hours}:${minutes}`;
  
  const isWithin = currentTime >= todayConfig.start && currentTime <= todayConfig.end;
  console.log(`[AI-Assistant] Horário atual (BRT): ${currentTime}, Configurado: ${todayConfig.start}-${todayConfig.end}, Dentro: ${isWithin}`);
  
  return isWithin;
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
    const isOnline = isWithinWorkingHours(config.working_hours);
    if (config.availability_mode === 'only_business_hours' && !isOnline) {
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

      // Add offline notice if outside hours
      let offlineNotice = null;
      if (!isOnline && config.availability_mode === '24h_with_message') {
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
      } | null = null;
      let showAppointmentsList = false;

      // Check for cancellation flow trigger
      if (assistantMessage.includes('[LISTAR_AGENDAMENTOS]')) {
        showAppointmentsList = true;
        assistantMessage = assistantMessage.replace('[LISTAR_AGENDAMENTOS]', '').trim();
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
          
          // Find service by name
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
          } else {
            // Find professional by name
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
            } else {
              // Parse date - support formats like "02/01/2026" or "02/01"
              let dateStr = scheduleData.date.trim();
              let scheduledDate: Date;
              
              const now = new Date();
              const brasiliaOffset = -3 * 60;
              const localOffset = now.getTimezoneOffset();
              const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000);
              
              if (dateStr.split('/').length === 2) {
                // Format DD/MM - add current year
                const [day, month] = dateStr.split('/');
                dateStr = `${day}/${month}/${brasiliaTime.getFullYear()}`;
              }
              
              const [day, month, year] = dateStr.split('/').map(Number);
              const [hour, minute] = scheduleData.time.trim().split(':').map(Number);
              
              // Create date in Brasília timezone, then convert to UTC for storage
              scheduledDate = new Date(year, month - 1, day, hour, minute, 0);
              // Add 3 hours to convert Brasília to UTC
              const scheduledAtUTC = new Date(scheduledDate.getTime() + 3 * 60 * 60 * 1000);
              
              console.log('[AI-Assistant] Data agendada (Brasília):', scheduledDate.toISOString());
              console.log('[AI-Assistant] Data agendada (UTC):', scheduledAtUTC.toISOString());

              // Find or create client
              const phoneClean = (scheduleData.phone || clientPhone || '').replace(/\D/g, '');
              let appointmentClientId = clientId;

              if (!appointmentClientId && phoneClean) {
                // Try to find existing client
                const { data: existingClient } = await supabase
                  .from('clients')
                  .select('id')
                  .eq('establishment_id', establishmentId)
                  .eq('phone', phoneClean)
                  .limit(1)
                  .single();

                if (existingClient) {
                  appointmentClientId = existingClient.id;
                } else {
                  // Create new client
                  const { data: newClient } = await supabase
                    .from('clients')
                    .insert({
                      establishment_id: establishmentId,
                      name: scheduleData.name || clientName || 'Cliente',
                      phone: phoneClean,
                    })
                    .select('id')
                    .single();

                  if (newClient) {
                    appointmentClientId = newClient.id;
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
              } else {
                console.log('[AI-Assistant] Agendamento criado com sucesso:', newAppointment.id);
                scheduleData.appointmentId = newAppointment.id;
                scheduleData.created = true;
              }
            }
          }
        } catch (scheduleError) {
          console.error('[AI-Assistant] Erro no processo de agendamento:', scheduleError);
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
