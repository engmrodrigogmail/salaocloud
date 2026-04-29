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

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface Professional {
  id: string;
  name: string;
  specialties: string[] | null;
  working_hours: any;
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

// Parse date from various formats (dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, or natural language)
function parseDate(dateStr: string): string | null {
  const today = new Date();
  const lowered = dateStr.toLowerCase().trim();
  
  // Natural language parsing
  if (lowered === 'hoje') {
    return today.toISOString().split('T')[0];
  }
  if (lowered === 'amanha' || lowered === 'amanhã') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  // Check for weekday names
  const weekdays: Record<string, number> = {
    'domingo': 0, 'segunda': 1, 'terca': 2, 'terça': 2, 'quarta': 3,
    'quinta': 4, 'sexta': 5, 'sabado': 6, 'sábado': 6
  };
  
  for (const [day, num] of Object.entries(weekdays)) {
    if (lowered.includes(day)) {
      const currentDay = today.getDay();
      let daysAhead = num - currentDay;
      if (daysAhead <= 0) daysAhead += 7;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysAhead);
      return targetDate.toISOString().split('T')[0];
    }
  }
  
  // DD/MM/YYYY or DD-MM-YYYY
  const brMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // DD/MM (current year)
  const shortMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (shortMatch) {
    const [, day, month] = shortMatch;
    return `${today.getFullYear()}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // YYYY-MM-DD (ISO format)
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[0];
  }
  
  return null;
}

// Parse time from various formats
function parseTime(timeStr: string): string | null {
  const cleaned = timeStr.toLowerCase().replace(/\s+/g, '').replace('h', ':').replace('hrs', '').replace('hr', '');
  
  // HH:MM or HH
  const match = cleaned.match(/(\d{1,2}):?(\d{2})?/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2] || '00';
    return `${hours}:${minutes}`;
  }
  
  return null;
}

// Check availability for a specific date/time
async function checkAvailability(
  supabase: any,
  establishmentId: string,
  professionalId: string | null,
  date: string,
  time: string,
  durationMinutes: number,
  requestId: string
): Promise<{ available: boolean; conflictingAppointments?: any[]; availableProfessionals?: string[] }> {
  const startDateTime = `${date}T${time}:00`;
  const startTime = new Date(startDateTime);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
  
  let query = supabase
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, professional_id, professionals:professional_id (name)')
    .eq('establishment_id', establishmentId)
    .in('status', ['pending', 'confirmed', 'in_service'])
    .gte('scheduled_at', `${date}T00:00:00`)
    .lt('scheduled_at', `${date}T23:59:59`);
  
  if (professionalId) {
    query = query.eq('professional_id', professionalId);
  }
  
  const { data: existingAppointments } = await query;
  
  if (!existingAppointments || existingAppointments.length === 0) {
    return { available: true };
  }
  
  // Check for time conflicts
  const conflicts = existingAppointments.filter((apt: any) => {
    const aptStart = new Date(apt.scheduled_at);
    const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
    return startTime < aptEnd && endTime > aptStart;
  });
  
  if (conflicts.length === 0) {
    return { available: true };
  }
  
  // If specific professional was requested and is busy, find alternatives
  if (professionalId) {
    const { data: allProfessionals } = await supabase
      .from('professionals')
      .select('id, name')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true);
    
    const busyProfessionalIds = conflicts.map((c: any) => c.professional_id);
    const available = (allProfessionals || [])
      .filter((p: any) => !busyProfessionalIds.includes(p.id))
      .map((p: any) => p.name);
    
    return {
      available: false,
      conflictingAppointments: conflicts,
      availableProfessionals: available
    };
  }
  
  return { available: false, conflictingAppointments: conflicts };
}

// Create appointment
async function createAppointment(
  supabase: any,
  establishmentId: string,
  data: {
    serviceId: string;
    professionalId: string;
    date: string;
    time: string;
    clientName: string;
    clientPhone: string;
    price: number;
    durationMinutes: number;
  },
  requestId: string
): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
  const scheduledAt = `${data.date}T${data.time}:00`;
  
  // First check if client exists
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('establishment_id', establishmentId)
    .eq('phone', data.clientPhone)
    .maybeSingle();
  
  let clientId = existingClient?.id;
  
  // Create client if doesn't exist
  if (!clientId) {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        establishment_id: establishmentId,
        name: data.clientName,
        phone: data.clientPhone,
      })
      .select('id')
      .single();
    
    if (clientError) {
      console.error(`[WEBHOOK] ${requestId} Error creating client:`, clientError);
    } else {
      clientId = newClient?.id;
    }
  }
  
  // Create appointment
  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      establishment_id: establishmentId,
      service_id: data.serviceId,
      professional_id: data.professionalId,
      client_id: clientId,
      client_name: data.clientName,
      client_phone: data.clientPhone,
      scheduled_at: scheduledAt,
      price: data.price,
      duration_minutes: data.durationMinutes,
      status: 'pending',
    })
    .select('id')
    .single();
  
  if (error) {
    console.error(`[WEBHOOK] ${requestId} Error creating appointment:`, error);
    return { success: false, error: error.message };
  }
  
  console.log(`[WEBHOOK] ${requestId} Appointment created: ${appointment.id}`);
  return { success: true, appointmentId: appointment.id };
}

// Add to waitlist
async function addToWaitlist(
  supabase: any,
  establishmentId: string,
  data: {
    serviceId?: string;
    professionalId?: string;
    date: string;
    timeStart?: string;
    timeEnd?: string;
    clientName: string;
    clientPhone: string;
  },
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  // Check if client exists
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('establishment_id', establishmentId)
    .eq('phone', data.clientPhone)
    .maybeSingle();
  
  const { error } = await supabase
    .from('ai_assistant_waitlist')
    .insert({
      establishment_id: establishmentId,
      client_id: existingClient?.id,
      client_name: data.clientName,
      client_phone: data.clientPhone,
      service_id: data.serviceId,
      professional_id: data.professionalId,
      preferred_date: data.date,
      preferred_time_start: data.timeStart,
      preferred_time_end: data.timeEnd,
      status: 'waiting',
    });
  
  if (error) {
    console.error(`[WEBHOOK] ${requestId} Error adding to waitlist:`, error);
    return { success: false, error: error.message };
  }
  
  console.log(`[WEBHOOK] ${requestId} Added to waitlist for ${data.date}`);
  return { success: true };
}

// Find service by name (fuzzy match)
function findServiceByName(services: Service[], name: string): Service | null {
  const lowered = name.toLowerCase().trim();
  
  // Exact match first
  const exact = services.find(s => s.name.toLowerCase() === lowered);
  if (exact) return exact;
  
  // Partial match
  const partial = services.find(s => 
    s.name.toLowerCase().includes(lowered) || lowered.includes(s.name.toLowerCase())
  );
  if (partial) return partial;
  
  return null;
}

// Find professional by name (fuzzy match)
function findProfessionalByName(professionals: Professional[], name: string): Professional | null {
  const lowered = name.toLowerCase().trim();
  
  if (lowered === 'qualquer' || lowered === 'qualquer um' || lowered === 'qualquer uma' || lowered === 'tanto faz') {
    return professionals[0] || null; // Return first available
  }
  
  // Exact match first
  const exact = professionals.find(p => p.name.toLowerCase() === lowered);
  if (exact) return exact;
  
  // Partial match
  const partial = professionals.find(p => 
    p.name.toLowerCase().includes(lowered) || lowered.includes(p.name.toLowerCase())
  );
  if (partial) return partial;
  
  return null;
}

// Get available time slots for a date
async function getAvailableSlots(
  supabase: any,
  establishmentId: string,
  professionalId: string | null,
  date: string,
  durationMinutes: number,
  requestId: string
): Promise<string[]> {
  // Get establishment working hours
  const { data: establishment } = await supabase
    .from('establishments')
    .select('working_hours')
    .eq('id', establishmentId)
    .single();
  
  const workingHours = establishment?.working_hours;
  const dayOfWeek = new Date(date).getDay();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayConfig = workingHours?.[days[dayOfWeek]];
  
  if (!dayConfig?.enabled) {
    return [];
  }
  
  const startHour = parseInt(dayConfig.start.split(':')[0]);
  const endHour = parseInt(dayConfig.end.split(':')[0]);
  
  // Get existing appointments
  let query = supabase
    .from('appointments')
    .select('scheduled_at, duration_minutes')
    .eq('establishment_id', establishmentId)
    .in('status', ['pending', 'confirmed', 'in_service'])
    .gte('scheduled_at', `${date}T00:00:00`)
    .lt('scheduled_at', `${date}T23:59:59`);
  
  if (professionalId) {
    query = query.eq('professional_id', professionalId);
  }
  
  const { data: appointments } = await query;
  
  // Generate time slots
  const slots: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const slotStart = new Date(`${date}T${time}:00`);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
      
      // Check if slot is in the past
      if (slotStart < new Date()) continue;
      
      // Check conflicts
      const hasConflict = (appointments || []).some((apt: any) => {
        const aptStart = new Date(apt.scheduled_at);
        const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
        return slotStart < aptEnd && slotEnd > aptStart;
      });
      
      if (!hasConflict) {
        slots.push(time);
      }
    }
  }
  
  return slots.slice(0, 6); // Return max 6 slots
}

// Get AI assistant response with scheduling capabilities
async function getAIResponse(
  supabase: any,
  establishmentId: string,
  conversationId: string,
  userMessage: string,
  clientPhone: string,
  clientName: string | null,
  requestId: string
): Promise<{ message: string; action?: any }> {
  // Get assistant config
  const { data: config } = await supabase
    .from('establishment_ai_assistant')
    .select('*')
    .eq('establishment_id', establishmentId)
    .single();

  if (!config || !config.is_enabled) {
    console.log(`[WEBHOOK] ${requestId} AI assistant not enabled for establishment`);
    return { message: '' };
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
      return { message: 'Desculpe, o limite de mensagens gratuitas foi atingido. Entre em contato diretamente com o estabelecimento.' };
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
    return { message: '' };
  }

  // Get services, professionals, promotions
  const { data: services } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes')
    .eq('establishment_id', establishmentId)
    .eq('is_active', true);

  const { data: professionals } = await supabase
    .from('professionals')
    .select('id, name, specialties, working_hours')
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

  // Build detailed system prompt with scheduling instructions
  const today = new Date();
  const todayStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  const styleGuide = config.language_style === 'formal'
    ? 'Use linguagem formal e profissional.'
    : 'Use linguagem amigável e casual, mas sempre profissional. Pode usar emojis moderadamente.';

  const servicesInfo = (services || []).map((s: Service) => 
    `- ${s.name} (ID: ${s.id}): R$ ${s.price.toFixed(2)} (${s.duration_minutes} min)`
  ).join('\n');

  const professionalsInfo = (professionals || []).map((p: Professional) =>
    `- ${p.name} (ID: ${p.id})${p.specialties?.length ? ` - especialidades: ${p.specialties.join(', ')}` : ''}`
  ).join('\n');

  const promotionsInfo = (promotions || []).length > 0
    ? (promotions || []).map((p: any) =>
        `- ${p.name}: ${p.discount_type === 'percentage' ? `${p.discount_value}%` : `R$ ${p.discount_value}`} de desconto`
      ).join('\n')
    : 'Nenhuma promoção ativa.';

  // Get working hours info
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayNames: Record<string, string> = {
    sunday: 'Domingo', monday: 'Segunda', tuesday: 'Terça', 
    wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado'
  };
  const workingHoursInfo = days.map(day => {
    const cfg = establishment.working_hours?.[day];
    if (cfg?.enabled) {
      return `- ${dayNames[day]}: ${cfg.start} às ${cfg.end}`;
    }
    return `- ${dayNames[day]}: Fechado`;
  }).join('\n');

  const systemPrompt = `Você é ${config.assistant_name}, assistente virtual do ${establishment.name} via WhatsApp.

## Data Atual
Hoje é ${todayStr}.

## Estilo
${styleGuide}

## SUAS CAPACIDADES DE AGENDAMENTO
Você pode realizar agendamentos automaticamente! Para agendar, você DEVE coletar:
1. **Serviço** desejado (confirmar preço e duração)
2. **Profissional** (ou "qualquer um" se não tiver preferência)
3. **Data** (aceite formatos: dd/mm, dd/mm/aaaa, "hoje", "amanhã", ou dia da semana)
4. **Horário** (ex: 14:00, 14h, 2 da tarde)
5. **Nome** do cliente (se não souber, pergunte)

Telefone do cliente: ${clientPhone}
Nome conhecido: ${clientName || 'Não informado'}

## Serviços Disponíveis
${servicesInfo || 'Nenhum serviço cadastrado.'}

## Profissionais
${professionalsInfo || 'Nenhum profissional cadastrado.'}

## Horários de Funcionamento
${workingHoursInfo}

## Promoções
${promotionsInfo}

${config.custom_instructions ? `## Instruções Especiais\n${config.custom_instructions}` : ''}

## COMANDOS DE AÇÃO
Quando tiver TODOS os dados necessários, inclua o comando ao FINAL da sua mensagem:

**Para agendar (quando tiver serviço, profissional, data, hora e nome):**
[AGENDAR:serviceId:professionalId:YYYY-MM-DD:HH:MM:NomeCliente]

**Para adicionar à fila de espera (quando horário desejado não estiver disponível):**
[FILA_ESPERA:serviceId:professionalId:YYYY-MM-DD:HH:MM:NomeCliente]

**Para escalar para atendimento humano:**
[ESCALAR]

## REGRAS IMPORTANTES
1. Respostas CURTAS (máximo 3 parágrafos) - é WhatsApp!
2. Se não souber algo, PERGUNTE - nunca invente
3. Confirme os dados antes de usar o comando [AGENDAR]
4. Se o horário estiver ocupado, sugira alternativas ou ofereça fila de espera
5. Use os IDs corretos dos serviços e profissionais nos comandos
6. Datas sempre no formato YYYY-MM-DD e horários no formato HH:MM nos comandos

## EXEMPLO DE FLUXO
Cliente: "Quero agendar um corte"
→ Pergunte o profissional preferido e o dia/horário

Cliente: "Com Maria, amanhã às 14h"
→ Confirme: "Vou agendar Corte com Maria amanhã às 14h, valor R$ 50,00. Posso confirmar?"

Cliente: "Sim!"
→ Use [AGENDAR:uuid-servico:uuid-profissional:2025-01-02:14:00:NomeCliente]

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
    return { message: '' };
  }

  const aiResponse = await response.json();
  let assistantMessage = aiResponse.choices?.[0]?.message?.content || 
    'Desculpe, não consegui processar sua mensagem. Tente novamente.';

  let action: any = null;

  // Process scheduling commands
  const scheduleMatch = assistantMessage.match(/\[AGENDAR:([^:]+):([^:]+):([^:]+):([^:]+):([^\]]+)\]/);
  if (scheduleMatch) {
    const [, serviceId, professionalId, date, time, name] = scheduleMatch;
    assistantMessage = assistantMessage.replace(scheduleMatch[0], '').trim();
    
    // Validate and create appointment
    const service = (services || []).find((s: Service) => s.id === serviceId);
    const professional = (professionals || []).find((p: Professional) => p.id === professionalId);
    
    if (service && professional) {
      // Check availability first
      const availability = await checkAvailability(
        supabase, establishmentId, professionalId, date, time, service.duration_minutes, requestId
      );
      
      if (availability.available) {
        const result = await createAppointment(supabase, establishmentId, {
          serviceId,
          professionalId,
          date,
          time,
          clientName: name || clientName || 'Cliente',
          clientPhone,
          price: service.price,
          durationMinutes: service.duration_minutes,
        }, requestId);
        
        if (result.success) {
          action = { type: 'appointment_created', appointmentId: result.appointmentId };
          assistantMessage += `\n\n✅ *Agendamento confirmado!*\n📋 ${service.name}\n👤 ${professional.name}\n📅 ${date.split('-').reverse().join('/')}\n🕐 ${time}\n💰 R$ ${service.price.toFixed(2)}`;
        } else {
          assistantMessage += `\n\n⚠️ Houve um erro ao criar o agendamento. Por favor, tente novamente.`;
        }
      } else {
        // Slot not available, suggest alternatives
        const availableSlots = await getAvailableSlots(supabase, establishmentId, professionalId, date, service.duration_minutes, requestId);
        if (availableSlots.length > 0) {
          assistantMessage += `\n\n⚠️ Este horário não está disponível. Horários disponíveis para ${date.split('-').reverse().join('/')}:\n${availableSlots.map(s => `• ${s}`).join('\n')}\n\nDeseja agendar em um desses horários?`;
        } else {
          assistantMessage += `\n\n⚠️ Não há horários disponíveis nesta data. Gostaria de tentar outro dia ou entrar na fila de espera?`;
        }
      }
    } else {
      assistantMessage += `\n\n⚠️ Não encontrei o serviço ou profissional. Por favor, escolha das opções disponíveis.`;
    }
  }

  // Process waitlist commands
  const waitlistMatch = assistantMessage.match(/\[FILA_ESPERA:([^:]+):([^:]+):([^:]+):([^:]+):([^\]]+)\]/);
  if (waitlistMatch) {
    const [, serviceId, professionalId, date, time, name] = waitlistMatch;
    assistantMessage = assistantMessage.replace(waitlistMatch[0], '').trim();
    
    const result = await addToWaitlist(supabase, establishmentId, {
      serviceId: serviceId !== 'null' ? serviceId : undefined,
      professionalId: professionalId !== 'null' ? professionalId : undefined,
      date,
      timeStart: time,
      clientName: name || clientName || 'Cliente',
      clientPhone,
    }, requestId);
    
    if (result.success) {
      action = { type: 'waitlist_added' };
      assistantMessage += `\n\n📋 Adicionei você à fila de espera para ${date.split('-').reverse().join('/')} às ${time}. Avisaremos se surgir uma vaga!`;
    }
  }

  // Check for escalation
  let shouldEscalate = false;
  if (assistantMessage.includes('[ESCALAR]')) {
    shouldEscalate = true;
    assistantMessage = assistantMessage.replace('[ESCALAR]', '').trim();
    action = { type: 'escalated' };
    
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
    metadata: { action, shouldEscalate },
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

  console.log(`[WEBHOOK] ${requestId} AI response generated (${assistantMessage.length} chars)${action ? `, action: ${action.type}` : ''}`);
  return { message: assistantMessage, action };
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

      // Get AI response with scheduling
      const { message: aiResponse, action } = await getAIResponse(
        supabase,
        establishmentId,
        conversationId,
        textMessage,
        payload.phone,
        payload.senderName || null,
        requestId
      );

      if (aiResponse) {
        // Send response via WhatsApp
        await sendZApiMessage(payload.phone, aiResponse, requestId);
      }

      return new Response(JSON.stringify({ 
        received: true, 
        processed: true, 
        aiResponse: !!aiResponse,
        action: action?.type 
      }), {
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
