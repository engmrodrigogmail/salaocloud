import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const Z_API_INSTANCE_ID = Deno.env.get('Z_API_INSTANCE_ID');
const Z_API_TOKEN = Deno.env.get('Z_API_TOKEN');
// Some Z-API accounts require an additional "client-token" header.
// If not set, we fall back to Z_API_TOKEN for compatibility.
const Z_API_CLIENT_TOKEN = Deno.env.get('Z_API_CLIENT_TOKEN') || Z_API_TOKEN;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SendMessageRequest {
  action: 'send_message' | 'send_reminder' | 'send_interactive_reminder' | 'test_connection' | 'get_status' | 'process_reminders';
  phone?: string;
  message?: string;
  appointmentId?: string;
  reminderType?: '24h' | '1h';
}

interface Appointment {
  id: string;
  client_name: string;
  client_phone: string;
  scheduled_at: string;
  status: string;
  services: { name: string } | null;
  professionals: { name: string } | null;
  establishments: { name: string; id: string } | null;
}

// Format phone number to Brazilian format for Z-API
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

function redactSecret(value: string | null | undefined) {
  if (!value) return 'MISSING';
  if (value.length <= 8) return `len=${value.length}`;
  return `${value.slice(0, 4)}...${value.slice(-4)} (len=${value.length})`;
}

function safeZApiUrl(url: string) {
  if (!Z_API_TOKEN) return url;
  return url.replace(`/token/${Z_API_TOKEN}`, '/token/***');
}

async function zapiFetchJson(
  requestId: string,
  label: string,
  url: string,
  init: RequestInit,
) {
  const startedAt = Date.now();

  const headers = new Headers(init.headers);
  // Z-API seems to expect this header key as "client-token" (some gateways are picky).
  if (Z_API_CLIENT_TOKEN) {
    headers.set('client-token', Z_API_CLIENT_TOKEN);
  }
  headers.set('Content-Type', 'application/json');

  const method = (init.method || 'GET').toUpperCase();

  console.log(
    `[ZAPI] ${requestId} ${label} -> ${method} ${safeZApiUrl(url)} | client-token=${redactSecret(Z_API_CLIENT_TOKEN)}`,
  );

  try {
    const res = await fetch(url, { ...init, headers });
    const elapsedMs = Date.now() - startedAt;

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { nonJsonBody: text?.slice(0, 500) };
    }

    console.log(
      `[ZAPI] ${requestId} ${label} <- ${res.status} (${elapsedMs}ms) body=${text?.slice(0, 500)}`,
    );

    return { res, data };
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    console.error(`[ZAPI] ${requestId} ${label} !! fetch error (${elapsedMs}ms):`, err);
    throw err;
  }
}

// Send message via Z-API
async function sendZApiMessage(
  phone: string,
  message: string,
  requestId = 'noid',
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!Z_API_INSTANCE_ID || !Z_API_TOKEN) {
    console.error(`[ZAPI] ${requestId} send-text missing credentials instance=${!!Z_API_INSTANCE_ID} token=${!!Z_API_TOKEN}`);
    return { success: false, error: 'Z-API credentials not configured' };
  }

  const formattedPhone = formatPhoneNumber(phone);
  console.log(`[ZAPI] ${requestId} Preparing send-text to phone=***${formattedPhone.slice(-4)} messageLen=${message?.length ?? 0}`);

  const url = `https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/send-text`;

  try {
    const { res, data } = await zapiFetchJson(requestId, 'send-text', url, {
      method: 'POST',
      body: JSON.stringify({ phone: formattedPhone, message }),
    });

    // deno-lint-ignore no-explicit-any
    const d: any = data;

    if (res.ok && (d?.zapiMessageId || d?.messageId)) {
      return { success: true, messageId: d.zapiMessageId || d.messageId };
    }

    return { success: false, error: d?.message || d?.error || 'Unknown error from Z-API' };
  } catch (error: unknown) {
    console.error(`[ZAPI] ${requestId} Error sending message:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Send interactive message with buttons via Z-API
async function sendInteractiveMessage(
  phone: string,
  message: string,
  buttons: { id: string; title: string }[],
  footer?: string,
  requestId = 'noid',
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!Z_API_INSTANCE_ID || !Z_API_TOKEN) {
    console.error(`[ZAPI] ${requestId} send-button-list missing credentials instance=${!!Z_API_INSTANCE_ID} token=${!!Z_API_TOKEN}`);
    return { success: false, error: 'Z-API credentials not configured' };
  }

  const formattedPhone = formatPhoneNumber(phone);
  console.log(
    `[ZAPI] ${requestId} Preparing send-button-list to phone=***${formattedPhone.slice(-4)} buttons=${buttons?.length ?? 0} messageLen=${message?.length ?? 0}`,
  );

  const url = `https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/send-button-list`;

  try {
    const { res, data } = await zapiFetchJson(requestId, 'send-button-list', url, {
      method: 'POST',
      body: JSON.stringify({
        phone: formattedPhone,
        message,
        buttonList: {
          buttons: buttons.map((btn) => ({ id: btn.id, label: btn.title })),
        },
        footer: footer || '',
      }),
    });

    // deno-lint-ignore no-explicit-any
    const d: any = data;

    if (res.ok && (d?.zapiMessageId || d?.messageId)) {
      return { success: true, messageId: d.zapiMessageId || d.messageId };
    }

    return { success: false, error: d?.message || d?.error || 'Unknown error from Z-API' };
  } catch (error: unknown) {
    console.error(`[ZAPI] ${requestId} Error sending interactive message:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Check Z-API connection status
async function checkZApiStatus(
  requestId = 'noid',
): Promise<{ connected: boolean; status?: string; error?: string }> {
  if (!Z_API_INSTANCE_ID || !Z_API_TOKEN) {
    console.error(`[ZAPI] ${requestId} status missing credentials instance=${!!Z_API_INSTANCE_ID} token=${!!Z_API_TOKEN}`);
    return { connected: false, error: 'Z-API credentials not configured' };
  }

  const url = `https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/status`;

  try {
    const { res, data } = await zapiFetchJson(requestId, 'status', url, { method: 'GET' });

    // deno-lint-ignore no-explicit-any
    const d: any = data;

    if (!res.ok) {
      return { connected: false, error: d?.message || d?.error || `HTTP ${res.status}` };
    }

    return {
      connected: d?.connected === true,
      status: d?.status || d?.state || 'Unknown',
    };
  } catch (error: unknown) {
    console.error(`[ZAPI] ${requestId} Error checking status:`, error);
    return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Generate interactive reminder message
function generateInteractiveReminderMessage(
  clientName: string, 
  serviceName: string, 
  professionalName: string, 
  scheduledAt: string, 
  establishmentName: string,
  reminderType: '24h' | '1h'
): string {
  const date = new Date(scheduledAt);
  const formattedDate = date.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: '2-digit', 
    month: 'long' 
  });
  const formattedTime = date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const timeLabel = reminderType === '24h' ? 'amanhã' : 'em breve';

  return `*Agenda Inteligente Salão Cloud - Lembrete automático*

Olá, ${clientName}! 👋

Seu agendamento está chegando ${timeLabel}:

📅 *${formattedDate}*
🕐 *${formattedTime}*
💇 *${serviceName}*
👤 *${professionalName}*
📍 *${establishmentName}*

Por favor, confirme sua presença:`;
}

// Process pending reminders (called by cron)
// deno-lint-ignore no-explicit-any
async function processReminders(supabase: any): Promise<{ sent24h: number; sent1h: number; errors: number }> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  
  // Window for 24h reminders (23h30min to 24h30min before)
  const window24hStart = new Date(in24h.getTime() - 30 * 60 * 1000);
  const window24hEnd = new Date(in24h.getTime() + 30 * 60 * 1000);
  
  // Window for 1h reminders (30min to 1h30min before)
  const window1hStart = new Date(in1h.getTime() - 30 * 60 * 1000);
  const window1hEnd = new Date(in1h.getTime() + 30 * 60 * 1000);

  let sent24h = 0;
  let sent1h = 0;
  let errors = 0;

  console.log(`[REMINDERS] Processing reminders at ${now.toISOString()}`);

  // Fetch appointments that need 24h reminders
  const { data: appointments24h } = await supabase
    .from('appointments')
    .select(`
      id, client_name, client_phone, scheduled_at, status,
      services:service_id (name),
      professionals:professional_id (name),
      establishments:establishment_id (name, id)
    `)
    .gte('scheduled_at', window24hStart.toISOString())
    .lte('scheduled_at', window24hEnd.toISOString())
    .in('status', ['pending', 'confirmed']);

  // Fetch appointments that need 1h reminders
  const { data: appointments1h } = await supabase
    .from('appointments')
    .select(`
      id, client_name, client_phone, scheduled_at, status,
      services:service_id (name),
      professionals:professional_id (name),
      establishments:establishment_id (name, id)
    `)
    .gte('scheduled_at', window1hStart.toISOString())
    .lte('scheduled_at', window1hEnd.toISOString())
    .in('status', ['pending', 'confirmed']);

  // Process 24h reminders
  const apts24h = (appointments24h || []) as unknown as Appointment[];
  for (const apt of apts24h) {
    // Check if reminder already sent
    const { data: existingReminder } = await supabase
      .from('appointment_reminders')
      .select('id')
      .eq('appointment_id', apt.id)
      .eq('reminder_type', '24h')
      .maybeSingle();

    if (existingReminder) {
      console.log(`[REMINDERS] 24h reminder already sent for appointment ${apt.id}`);
      continue;
    }

    // Send the reminder
    const message = generateInteractiveReminderMessage(
      apt.client_name,
      apt.services?.name || 'Serviço',
      apt.professionals?.name || 'Profissional',
      apt.scheduled_at,
      apt.establishments?.name || 'Estabelecimento',
      '24h'
    );

    const buttons = [
      { id: `confirm_${apt.id}`, title: 'Com certeza estarei aí' },
      { id: `cancel_${apt.id}`, title: 'Não conseguirei ir' }
    ];

    const result = await sendInteractiveMessage(apt.client_phone, message, buttons, 'Salão Cloud', 'cron');

    // Record the reminder
    await supabase.from('appointment_reminders').insert({
      appointment_id: apt.id,
      reminder_type: '24h',
      sent_at: result.success ? new Date().toISOString() : null,
      message_id: result.messageId || null,
      error_message: result.error || null
    });

    if (result.success) {
      sent24h++;
      console.log(`[REMINDERS] 24h reminder sent for appointment ${apt.id}`);
    } else {
      errors++;
      console.error(`[REMINDERS] Failed to send 24h reminder for ${apt.id}:`, result.error);
    }
  }

  // Process 1h reminders
  const apts1h = (appointments1h || []) as unknown as Appointment[];
  for (const apt of apts1h) {
    const { data: existingReminder } = await supabase
      .from('appointment_reminders')
      .select('id')
      .eq('appointment_id', apt.id)
      .eq('reminder_type', '1h')
      .maybeSingle();

    if (existingReminder) {
      console.log(`[REMINDERS] 1h reminder already sent for appointment ${apt.id}`);
      continue;
    }

    const message = generateInteractiveReminderMessage(
      apt.client_name,
      apt.services?.name || 'Serviço',
      apt.professionals?.name || 'Profissional',
      apt.scheduled_at,
      apt.establishments?.name || 'Estabelecimento',
      '1h'
    );

    const buttons = [
      { id: `confirm_${apt.id}`, title: 'Com certeza estarei aí' },
      { id: `cancel_${apt.id}`, title: 'Não conseguirei ir' }
    ];

    const result = await sendInteractiveMessage(apt.client_phone, message, buttons, 'Salão Cloud', 'cron');

    await supabase.from('appointment_reminders').insert({
      appointment_id: apt.id,
      reminder_type: '1h',
      sent_at: result.success ? new Date().toISOString() : null,
      message_id: result.messageId || null,
      error_message: result.error || null
    });

    if (result.success) {
      sent1h++;
      console.log(`[REMINDERS] 1h reminder sent for appointment ${apt.id}`);
    } else {
      errors++;
      console.error(`[REMINDERS] Failed to send 1h reminder for ${apt.id}:`, result.error);
    }
  }

  console.log(`[REMINDERS] Completed: sent24h=${sent24h}, sent1h=${sent1h}, errors=${errors}`);
  return { sent24h, sent1h, errors };
}

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SendMessageRequest = await req.json();
    console.log(`[ZAPI] ${requestId} Request:`, JSON.stringify(body));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (body.action) {
      case 'test_connection':
      case 'get_status': {
        const status = await checkZApiStatus(requestId);
        return new Response(JSON.stringify(status), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'send_message': {
        if (!body.phone || !body.message) {
          return new Response(JSON.stringify({ success: false, error: 'Phone and message are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = await sendZApiMessage(body.phone, body.message, requestId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'send_interactive_reminder': {
        if (!body.appointmentId) {
          return new Response(JSON.stringify({ success: false, error: 'Appointment ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .select(`
            *,
            services:service_id (name),
            professionals:professional_id (name),
            establishments:establishment_id (name)
          `)
          .eq('id', body.appointmentId)
          .single();

        if (appointmentError || !appointment) {
          return new Response(JSON.stringify({ success: false, error: 'Appointment not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const apt = appointment as unknown as Appointment;
        const message = generateInteractiveReminderMessage(
          apt.client_name,
          apt.services?.name || 'Serviço',
          apt.professionals?.name || 'Profissional',
          apt.scheduled_at,
          apt.establishments?.name || 'Estabelecimento',
          body.reminderType || '24h'
        );

        const buttons = [
          { id: `confirm_${apt.id}`, title: 'Com certeza estarei aí' },
          { id: `cancel_${apt.id}`, title: 'Não conseguirei ir' }
        ];

        const result = await sendInteractiveMessage(apt.client_phone, message, buttons, 'Salão Cloud', requestId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'send_reminder': {
        if (!body.appointmentId) {
          return new Response(JSON.stringify({ success: false, error: 'Appointment ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .select(`
            *,
            services:service_id (name),
            professionals:professional_id (name),
            establishments:establishment_id (name)
          `)
          .eq('id', body.appointmentId)
          .single();

        if (appointmentError || !appointment) {
          return new Response(JSON.stringify({ success: false, error: 'Appointment not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const apt = appointment as unknown as Appointment;
        const message = generateInteractiveReminderMessage(
          apt.client_name,
          apt.services?.name || 'Serviço',
          apt.professionals?.name || 'Profissional',
          apt.scheduled_at,
          apt.establishments?.name || 'Estabelecimento',
          '24h'
        );

        const result = await sendZApiMessage(apt.client_phone, message, requestId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'process_reminders': {
        const result = await processReminders(supabase);
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    console.error(`[ZAPI] ${requestId} Error:`, error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
