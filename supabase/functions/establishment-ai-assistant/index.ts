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

  return `Você é ${config.assistant_name}, assistente virtual do ${establishment.name}.

## Estilo de Comunicação
${styleGuide}
${clientContext}

## Suas Capacidades
1. **Agendamentos**: Ajudar clientes a agendar serviços
2. **Remarcações**: Auxiliar na remarcação de agendamentos existentes
3. **Promoções**: Informar sobre promoções ativas
4. **Fila de Espera**: Se a data/hora desejada estiver ocupada, oferecer alternativas ou adicionar à fila de espera
5. **Informações**: Responder dúvidas sobre serviços, preços e funcionamento

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

## Ações Especiais
- Para escalar para humano, inclua [ESCALAR] no final da resposta
- Para adicionar à fila de espera, inclua [FILA_ESPERA:serviço:data:horário] no final
- Para agendar, inclua [AGENDAR:serviço:profissional:data:horário:nome:telefone] no final

Telefone do estabelecimento: ${establishment.phone || 'Não informado'}`;
}

function isWithinWorkingHours(workingHours: any): boolean {
  if (!workingHours) return true;

  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[now.getDay()];
  const todayConfig = workingHours[today];

  if (!todayConfig?.enabled) return false;

  const currentTime = now.toTimeString().slice(0, 5);
  return currentTime >= todayConfig.start && currentTime <= todayConfig.end;
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
      let scheduleData = null;

      if (assistantMessage.includes('[ESCALAR]')) {
        shouldEscalate = true;
        assistantMessage = assistantMessage.replace('[ESCALAR]', '').trim();
        
        // Update conversation status
        await supabase
          .from('ai_assistant_conversations')
          .update({ status: 'escalated', escalated_at: new Date().toISOString() })
          .eq('id', conversationId);

        // TODO: Send WhatsApp to establishment if configured
        if (config.escalation_whatsapp) {
          console.log('Would send escalation WhatsApp to:', config.escalation_whatsapp);
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
      }

      // Save assistant message
      await supabase.from('ai_assistant_messages').insert({
        conversation_id: conversationId,
        sender_type: 'assistant',
        message_type: 'text',
        content: assistantMessage,
        metadata: { waitlistData, scheduleData, shouldEscalate },
      });

      // Increment usage
      await incrementUsage(establishmentId);

      return new Response(
        JSON.stringify({
          message: assistantMessage,
          shouldEscalate,
          waitlistData,
          scheduleData,
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
