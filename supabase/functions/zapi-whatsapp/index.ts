import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const Z_API_INSTANCE_ID = Deno.env.get('Z_API_INSTANCE_ID');
const Z_API_TOKEN = Deno.env.get('Z_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SendMessageRequest {
  action: 'send_message' | 'send_reminder' | 'test_connection' | 'get_status';
  phone?: string;
  message?: string;
  appointmentId?: string;
}

// Format phone number to Brazilian format for Z-API
function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If doesn't start with 55 (Brazil code), add it
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

// Send message via Z-API
async function sendZApiMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!Z_API_INSTANCE_ID || !Z_API_TOKEN) {
    return { success: false, error: 'Z-API credentials not configured' };
  }

  const formattedPhone = formatPhoneNumber(phone);
  
  console.log(`[ZAPI] Sending message to ${formattedPhone}`);
  
  try {
    const response = await fetch(`https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
      }),
    });

    const data = await response.json();
    
    console.log(`[ZAPI] Response:`, JSON.stringify(data));
    
    if (response.ok && data.zapiMessageId) {
      return { success: true, messageId: data.zapiMessageId };
    } else {
      return { success: false, error: data.message || data.error || 'Unknown error from Z-API' };
    }
  } catch (error: unknown) {
    console.error(`[ZAPI] Error sending message:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// Check Z-API connection status
async function checkZApiStatus(): Promise<{ connected: boolean; status?: string; error?: string }> {
  if (!Z_API_INSTANCE_ID || !Z_API_TOKEN) {
    return { connected: false, error: 'Z-API credentials not configured' };
  }

  try {
    const response = await fetch(`https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    console.log(`[ZAPI] Status response:`, JSON.stringify(data));
    
    return { 
      connected: data.connected === true, 
      status: data.status || data.state || 'Unknown'
    };
  } catch (error: unknown) {
    console.error(`[ZAPI] Error checking status:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { connected: false, error: errorMessage };
  }
}

// Generate appointment reminder message
function generateReminderMessage(clientName: string, serviceName: string, professionalName: string, scheduledAt: string, establishmentName: string): string {
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

  return `Olá, ${clientName}! 👋

Passando para lembrar do seu agendamento:

📅 *${formattedDate}*
🕐 *${formattedTime}*
💇 *${serviceName}*
👤 *${professionalName}*
📍 *${establishmentName}*

Aguardamos você! Caso precise reagendar, entre em contato.

_Enviado automaticamente por Salão Cloud_`;
}

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SendMessageRequest = await req.json();
    console.log(`[ZAPI] ${requestId} Request:`, JSON.stringify(body));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (body.action) {
      case 'test_connection': {
        const status = await checkZApiStatus();
        return new Response(JSON.stringify(status), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_status': {
        const status = await checkZApiStatus();
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

        const result = await sendZApiMessage(body.phone, body.message);
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

        // Fetch appointment details with related data
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
          console.error(`[ZAPI] ${requestId} Error fetching appointment:`, appointmentError);
          return new Response(JSON.stringify({ success: false, error: 'Appointment not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const message = generateReminderMessage(
          appointment.client_name,
          appointment.services?.name || 'Serviço',
          appointment.professionals?.name || 'Profissional',
          appointment.scheduled_at,
          appointment.establishments?.name || 'Estabelecimento'
        );

        const result = await sendZApiMessage(appointment.client_phone, message);
        
        console.log(`[ZAPI] ${requestId} Reminder sent:`, JSON.stringify({ 
          appointmentId: body.appointmentId, 
          success: result.success 
        }));

        return new Response(JSON.stringify(result), {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
