import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const Z_API_INSTANCE_ID = Deno.env.get('Z_API_INSTANCE_ID');
const Z_API_TOKEN = Deno.env.get('Z_API_TOKEN');
const Z_API_CLIENT_TOKEN = Deno.env.get('Z_API_CLIENT_TOKEN') || Z_API_TOKEN;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface WebhookPayload {
  phone?: string;
  isGroup?: boolean;
  buttonPayload?: string;
  buttonText?: string;
  messageId?: string;
  momment?: number;
  type?: string;
  text?: {
    message?: string;
  };
  fromMe?: boolean;
  senderName?: string;
}

// Format phone number to Brazilian format for Z-API
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

// Send message via Z-API
async function sendZApiMessage(phone: string, message: string, requestId: string): Promise<boolean> {
  if (!Z_API_INSTANCE_ID || !Z_API_TOKEN) {
    console.error(`[WEBHOOK] ${requestId} Z-API credentials not configured`);
    return false;
  }

  const formattedPhone = formatPhoneNumber(phone);
  
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (Z_API_CLIENT_TOKEN) {
      headers['Client-Token'] = Z_API_CLIENT_TOKEN;
    }

    const response = await fetch(
      `https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/send-text`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: formattedPhone, message }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[WEBHOOK] ${requestId} Z-API send error: ${response.status} - ${text}`);
      return false;
    }

    console.log(`[WEBHOOK] ${requestId} Message sent to ${formattedPhone.slice(-4)}`);
    return true;
  } catch (error) {
    console.error(`[WEBHOOK] ${requestId} Error sending message:`, error);
    return false;
  }
}

// Get or create conversation for WhatsApp client
async function getOrCreateConversation(
  supabase: any, 
  establishmentId: string, 
  clientPhone: string,
  clientName: string | null,
  requestId: string
): Promise<string | null> {
  // Check for existing active conversation
  const { data: existing } = await supabase
    .from('ai_assistant_conversations')
    .select('id')
    .eq('establishment_id', establishmentId)
    .eq('client_phone', clientPhone)
    .eq('channel', 'whatsapp')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log(`[WEBHOOK] ${requestId} Found existing conversation: ${existing.id}`);
    return existing.id;
  }

  // Create new conversation
  const { data: newConv, error } = await supabase
    .from('ai_assistant_conversations')
    .insert({
      establishment_id: establishmentId,
      client_phone: clientPhone,
      client_name: clientName,
      channel: 'whatsapp',
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`[WEBHOOK] ${requestId} Error creating conversation:`, error);
    return null;
  }

  console.log(`[WEBHOOK] ${requestId} Created new conversation: ${newConv.id}`);
  return newConv.id;
}

// Get AI assistant response
async function getAIResponse(
  supabase: any,
  establishmentId: string,
  conversationId: string,
  userMessage: string,
  requestId: string
): Promise<string | null> {
  // Get assistant config
  const { data: config } = await supabase
    .from('establishment_ai_assistant')
    .select('*')
    .eq('establishment_id', establishmentId)
    .single();

  if (!config || !config.is_enabled) {
    console.log(`[WEBHOOK] ${requestId} AI assistant not enabled for establishment`);
    return null;
  }

  // Check usage limits
  const { data: subscription } = await supabase
    .from('establishment_ai_subscriptions')
    .select('*')
    .eq('establishment_id', establishmentId)
    .single();

  if (subscription?.status === 'trial') {
    const { data: addon } = await supabase
      .from('platform_ai_addon')
      .select('trial_message_limit')
      .single();
    const limit = addon?.trial_message_limit || 200;
    if (subscription.trial_messages_used >= limit) {
      console.log(`[WEBHOOK] ${requestId} Usage limit reached`);
      return 'Desculpe, o limite de mensagens gratuitas foi atingido. Entre em contato diretamente com o estabelecimento.';
    }
  }

  // Get establishment data
  const { data: establishment } = await supabase
    .from('establishments')
    .select('id, name, phone, working_hours')
    .eq('id', establishmentId)
    .single();

  if (!establishment) {
    console.log(`[WEBHOOK] ${requestId} Establishment not found`);
    return null;
  }

  // Get services, professionals, promotions
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

  // Save user message
  await supabase.from('ai_assistant_messages').insert({
    conversation_id: conversationId,
    sender_type: 'client',
    message_type: 'text',
    content: userMessage,
  });

  // Get conversation history
  const { data: messages } = await supabase
    .from('ai_assistant_messages')
    .select('sender_type, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20);

  // Build system prompt
  const styleGuide = config.language_style === 'formal'
    ? 'Use linguagem formal e profissional.'
    : 'Use linguagem amigável e casual, mas sempre profissional. Pode usar emojis moderadamente.';

  const servicesInfo = (services || []).map((s: any) => 
    `- ${s.name}: R$ ${s.price.toFixed(2)} (${s.duration_minutes} min)`
  ).join('\n');

  const professionalsInfo = (professionals || []).map((p: any) =>
    `- ${p.name}${p.specialties?.length ? ` (${p.specialties.join(', ')})` : ''}`
  ).join('\n');

  const promotionsInfo = (promotions || []).length > 0
    ? (promotions || []).map((p: any) =>
        `- ${p.name}: ${p.discount_type === 'percentage' ? `${p.discount_value}%` : `R$ ${p.discount_value}`} de desconto`
      ).join('\n')
    : 'Nenhuma promoção ativa.';

  const systemPrompt = `Você é ${config.assistant_name}, assistente virtual do ${establishment.name} via WhatsApp.

## Estilo
${styleGuide}

## Capacidades
- Ajudar com agendamentos e informações sobre serviços
- Informar sobre promoções ativas
- Responder dúvidas sobre horários e funcionamento

## Serviços
${servicesInfo || 'Nenhum serviço cadastrado.'}

## Profissionais
${professionalsInfo || 'Nenhum profissional cadastrado.'}

## Promoções
${promotionsInfo}

${config.custom_instructions || ''}

## Regras
1. Respostas concisas (máximo 2 parágrafos) para WhatsApp
2. Se não souber, ofereça encaminhar para atendimento humano
3. Para escalar, inclua [ESCALAR] no final
4. Nunca invente informações

Telefone do estabelecimento: ${establishment.phone || 'Não informado'}`;

  // Build chat messages
  const chatMessages = (messages || []).map((m: any) => ({
    role: m.sender_type === 'client' ? 'user' : 'assistant',
    content: m.content,
  }));

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
    console.error(`[WEBHOOK] ${requestId} AI API error: ${response.status}`);
    return null;
  }

  const aiResponse = await response.json();
  let assistantMessage = aiResponse.choices?.[0]?.message?.content || 
    'Desculpe, não consegui processar sua mensagem. Tente novamente.';

  // Check for escalation
  let shouldEscalate = false;
  if (assistantMessage.includes('[ESCALAR]')) {
    shouldEscalate = true;
    assistantMessage = assistantMessage.replace('[ESCALAR]', '').trim();
    
    await supabase
      .from('ai_assistant_conversations')
      .update({ status: 'escalated', escalated_at: new Date().toISOString() })
      .eq('id', conversationId);
  }

  // Save assistant message
  await supabase.from('ai_assistant_messages').insert({
    conversation_id: conversationId,
    sender_type: 'assistant',
    message_type: 'text',
    content: assistantMessage,
    metadata: { shouldEscalate },
  });

  // Update usage
  const monthYear = new Date().toISOString().slice(0, 7);
  const { data: existingUsage } = await supabase
    .from('ai_assistant_usage')
    .select('id, message_count')
    .eq('establishment_id', establishmentId)
    .eq('month_year', monthYear)
    .single();

  if (existingUsage) {
    await supabase
      .from('ai_assistant_usage')
      .update({ message_count: existingUsage.message_count + 1 })
      .eq('id', existingUsage.id);
  } else {
    await supabase.from('ai_assistant_usage').insert({
      establishment_id: establishmentId,
      month_year: monthYear,
      message_count: 1,
    });
  }

  // Update trial usage
  if (subscription?.status === 'trial') {
    await supabase
      .from('establishment_ai_subscriptions')
      .update({ trial_messages_used: (subscription.trial_messages_used || 0) + 1 })
      .eq('establishment_id', establishmentId);
  }

  console.log(`[WEBHOOK] ${requestId} AI response generated (${assistantMessage.length} chars)`);
  return assistantMessage;
}

// Find establishment by phone number
async function findEstablishmentByPhone(supabase: any, phone: string): Promise<string | null> {
  // First check if there's a client with this phone in any establishment
  const { data: clients } = await supabase
    .from('clients')
    .select('establishment_id')
    .eq('phone', phone)
    .limit(1);

  if (clients && clients.length > 0) {
    return clients[0].establishment_id;
  }

  // Check appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select('establishment_id')
    .eq('client_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1);

  if (appointments && appointments.length > 0) {
    return appointments[0].establishment_id;
  }

  // Check previous AI conversations
  const { data: conversations } = await supabase
    .from('ai_assistant_conversations')
    .select('establishment_id')
    .eq('client_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1);

  if (conversations && conversations.length > 0) {
    return conversations[0].establishment_id;
  }

  return null;
}

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    console.log(`[WEBHOOK] ${requestId} Received:`, JSON.stringify(payload));

    // Ignore group messages and messages from ourselves
    if (payload.isGroup || payload.fromMe) {
      console.log(`[WEBHOOK] ${requestId} Ignoring group/self message`);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Handle button responses (existing functionality)
    if (payload.buttonPayload || payload.buttonText) {
      const buttonId = payload.buttonPayload || '';
      const parts = buttonId.split('_');
      
      if (parts.length >= 2) {
        const action = parts[0];
        const appointmentId = parts.slice(1).join('_');

        console.log(`[WEBHOOK] ${requestId} Processing button action=${action} appointmentId=${appointmentId}`);

        const { data: appointment } = await supabase
          .from('appointments')
          .select(`*, establishments:establishment_id (name)`)
          .eq('id', appointmentId)
          .single();

        if (appointment) {
          const establishmentName = appointment.establishments?.name || 'Estabelecimento';

          if (action === 'confirm') {
            await supabase
              .from('appointments')
              .update({ confirmed_at: new Date().toISOString(), status: 'confirmed' })
              .eq('id', appointmentId);

            await supabase
              .from('appointment_reminders')
              .update({ response: 'confirmed', responded_at: new Date().toISOString() })
              .eq('appointment_id', appointmentId)
              .is('response', null);

            if (payload.phone) {
              await sendZApiMessage(
                payload.phone,
                `✅ *Presença confirmada!*\n\nObrigado por confirmar seu agendamento em *${establishmentName}*.\n\nAguardamos você! 💇‍♀️`,
                requestId
              );
            }
          } else if (action === 'cancel') {
            await supabase
              .from('appointments')
              .update({ 
                status: 'cancelled',
                cancelled_via_whatsapp: true,
                cancelled_reason: 'Cliente cancelou via WhatsApp'
              })
              .eq('id', appointmentId);

            await supabase
              .from('appointment_reminders')
              .update({ response: 'cancelled', responded_at: new Date().toISOString() })
              .eq('appointment_id', appointmentId)
              .is('response', null);

            if (payload.phone) {
              await sendZApiMessage(
                payload.phone,
                `❌ *Agendamento cancelado*\n\nSeu horário em *${establishmentName}* foi liberado.\n\nQuando quiser, faça um novo agendamento. Até breve! 👋`,
                requestId
              );
            }
          }
        }
      }

      return new Response(JSON.stringify({ received: true, processed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle text messages for AI assistant
    const textMessage = payload.text?.message;
    if (textMessage && payload.phone) {
      console.log(`[WEBHOOK] ${requestId} Processing text message from ${payload.phone?.slice(-4)}`);

      // Find which establishment this client belongs to
      const establishmentId = await findEstablishmentByPhone(supabase, payload.phone);
      
      if (!establishmentId) {
        console.log(`[WEBHOOK] ${requestId} No establishment found for phone ${payload.phone?.slice(-4)}`);
        // Don't respond if we don't know the establishment
        return new Response(JSON.stringify({ received: true, noEstablishment: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if AI assistant is enabled for this establishment
      const { data: aiConfig } = await supabase
        .from('establishment_ai_assistant')
        .select('is_enabled')
        .eq('establishment_id', establishmentId)
        .single();

      if (!aiConfig?.is_enabled) {
        console.log(`[WEBHOOK] ${requestId} AI not enabled for establishment ${establishmentId}`);
        return new Response(JSON.stringify({ received: true, aiNotEnabled: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get or create conversation
      const conversationId = await getOrCreateConversation(
        supabase, 
        establishmentId, 
        payload.phone,
        payload.senderName || null,
        requestId
      );

      if (!conversationId) {
        console.error(`[WEBHOOK] ${requestId} Failed to get/create conversation`);
        return new Response(JSON.stringify({ received: true, error: 'conversation_failed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get AI response
      const aiResponse = await getAIResponse(
        supabase,
        establishmentId,
        conversationId,
        textMessage,
        requestId
      );

      if (aiResponse) {
        // Send response via WhatsApp
        await sendZApiMessage(payload.phone, aiResponse, requestId);
      }

      return new Response(JSON.stringify({ received: true, processed: true, aiResponse: !!aiResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Other message types - just acknowledge
    console.log(`[WEBHOOK] ${requestId} Unhandled message type`);
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error(`[WEBHOOK] ${requestId} Error:`, error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
