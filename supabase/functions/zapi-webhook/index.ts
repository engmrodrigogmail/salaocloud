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

interface WebhookPayload {
  phone?: string;
  isGroup?: boolean;
  buttonPayload?: string;
  buttonText?: string;
  messageId?: string;
  momment?: number;
  type?: string;
}

// Format phone number to Brazilian format for Z-API
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

// Send confirmation message
async function sendConfirmationMessage(phone: string, message: string): Promise<void> {
  if (!Z_API_INSTANCE_ID || !Z_API_TOKEN) {
    console.error('[WEBHOOK] Z-API credentials not configured');
    return;
  }

  const formattedPhone = formatPhoneNumber(phone);
  
  try {
    await fetch(`https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: formattedPhone, message }),
    });
  } catch (error) {
    console.error('[WEBHOOK] Error sending confirmation:', error);
  }
}

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    console.log(`[WEBHOOK] ${requestId} Received:`, JSON.stringify(payload));

    // Only process button responses
    if (!payload.buttonPayload && !payload.buttonText) {
      console.log(`[WEBHOOK] ${requestId} Not a button response, ignoring`);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ignore group messages
    if (payload.isGroup) {
      console.log(`[WEBHOOK] ${requestId} Group message, ignoring`);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Parse button payload - format: "confirm_<appointmentId>" or "cancel_<appointmentId>"
    const buttonId = payload.buttonPayload || '';
    const parts = buttonId.split('_');
    
    if (parts.length < 2) {
      console.log(`[WEBHOOK] ${requestId} Invalid button payload format`);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const action = parts[0]; // 'confirm' or 'cancel'
    const appointmentId = parts.slice(1).join('_'); // Handle UUIDs with underscores

    console.log(`[WEBHOOK] ${requestId} Processing action=${action} appointmentId=${appointmentId}`);

    // Fetch the appointment
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        *,
        establishments:establishment_id (name)
      `)
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      console.error(`[WEBHOOK] ${requestId} Appointment not found:`, fetchError);
      return new Response(JSON.stringify({ received: true, error: 'Appointment not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const establishmentName = appointment.establishments?.name || 'Estabelecimento';

    if (action === 'confirm') {
      // Update appointment as confirmed
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          confirmed_at: new Date().toISOString(),
          status: 'confirmed'
        })
        .eq('id', appointmentId);

      if (updateError) {
        console.error(`[WEBHOOK] ${requestId} Error confirming appointment:`, updateError);
      } else {
        console.log(`[WEBHOOK] ${requestId} Appointment ${appointmentId} confirmed`);
        
        // Update reminder record
        await supabase
          .from('appointment_reminders')
          .update({ 
            response: 'confirmed',
            responded_at: new Date().toISOString()
          })
          .eq('appointment_id', appointmentId)
          .is('response', null);

        // Send confirmation message
        if (payload.phone) {
          await sendConfirmationMessage(
            payload.phone,
            `✅ *Presença confirmada!*\n\nObrigado por confirmar seu agendamento em *${establishmentName}*.\n\nAguardamos você! 💇‍♀️`
          );
        }
      }
    } else if (action === 'cancel') {
      // Update appointment as cancelled via WhatsApp
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          status: 'cancelled',
          cancelled_via_whatsapp: true,
          cancelled_reason: 'Cliente cancelou via WhatsApp'
        })
        .eq('id', appointmentId);

      if (updateError) {
        console.error(`[WEBHOOK] ${requestId} Error cancelling appointment:`, updateError);
      } else {
        console.log(`[WEBHOOK] ${requestId} Appointment ${appointmentId} cancelled via WhatsApp`);
        
        // Update reminder record
        await supabase
          .from('appointment_reminders')
          .update({ 
            response: 'cancelled',
            responded_at: new Date().toISOString()
          })
          .eq('appointment_id', appointmentId)
          .is('response', null);

        // Send cancellation confirmation
        if (payload.phone) {
          await sendConfirmationMessage(
            payload.phone,
            `❌ *Agendamento cancelado*\n\nSeu horário em *${establishmentName}* foi liberado.\n\nQuando quiser, faça um novo agendamento. Até breve! 👋`
          );
        }
      }
    }

    return new Response(JSON.stringify({ received: true, processed: true }), {
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
