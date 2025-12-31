import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const Z_API_INSTANCE_ID = Deno.env.get('Z_API_INSTANCE_ID');
const Z_API_TOKEN = Deno.env.get('Z_API_TOKEN');
const Z_API_CLIENT_TOKEN = Deno.env.get('Z_API_CLIENT_TOKEN');

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) {
    return digits;
  }
  if (digits.length === 11 || digits.length === 10) {
    return `55${digits}`;
  }
  return digits;
}

async function sendTextMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!Z_API_INSTANCE_ID || !Z_API_TOKEN) {
    return { success: false, error: 'Z-API não configurado' };
  }

  const formattedPhone = formatPhoneNumber(phone);
  const url = `https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/send-text`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': Z_API_CLIENT_TOKEN || '',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
      }),
    });

    const result = await response.json();
    
    if (response.ok && result.zapiMessageId) {
      return { success: true, messageId: result.zapiMessageId };
    }
    
    return { success: false, error: result.message || 'Erro ao enviar mensagem' };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao enviar mensagem:', error);
    return { success: false, error: errorMessage };
  }
}

async function sendImageMessage(phone: string, imageUrl: string, caption: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!Z_API_INSTANCE_ID || !Z_API_TOKEN) {
    return { success: false, error: 'Z-API não configurado' };
  }

  const formattedPhone = formatPhoneNumber(phone);
  const url = `https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/send-image`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': Z_API_CLIENT_TOKEN || '',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        image: imageUrl,
        caption: caption,
      }),
    });

    const result = await response.json();
    
    if (response.ok && result.zapiMessageId) {
      return { success: true, messageId: result.zapiMessageId };
    }
    
    return { success: false, error: result.message || 'Erro ao enviar imagem' };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao enviar imagem:', error);
    return { success: false, error: errorMessage };
  }
}

async function processBroadcast(campaignId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log(`[Broadcast] Iniciando processamento da campanha: ${campaignId}`);

  // Fetch campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('broadcast_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campaignError || !campaign) {
    console.error('[Broadcast] Campanha não encontrada:', campaignError);
    return;
  }

  // Update campaign status to sending
  await supabase
    .from('broadcast_campaigns')
    .update({ status: 'sending', sent_at: new Date().toISOString() })
    .eq('id', campaignId);

  // Fetch pending logs
  const { data: logs, error: logsError } = await supabase
    .from('broadcast_logs')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');

  if (logsError || !logs) {
    console.error('[Broadcast] Erro ao buscar logs:', logsError);
    return;
  }

  console.log(`[Broadcast] Processando ${logs.length} mensagens em blocos de 5`);

  let sentCount = campaign.sent_count || 0;
  let failedCount = campaign.failed_count || 0;

  // Process in batches of 5 with 3 second delay between batches
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 3000;

  for (let i = 0; i < logs.length; i += BATCH_SIZE) {
    const batch = logs.slice(i, i + BATCH_SIZE);
    console.log(`[Broadcast] Processando lote ${Math.floor(i / BATCH_SIZE) + 1} de ${Math.ceil(logs.length / BATCH_SIZE)}`);

    // Process each message in the batch
    for (const log of batch) {
      let result;
      
      if (campaign.image_url) {
        result = await sendImageMessage(log.client_phone, campaign.image_url, campaign.message);
      } else {
        result = await sendTextMessage(log.client_phone, campaign.message);
      }

      if (result.success) {
        sentCount++;
        await supabase
          .from('broadcast_logs')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString() 
          })
          .eq('id', log.id);
      } else {
        failedCount++;
        await supabase
          .from('broadcast_logs')
          .update({ 
            status: 'failed', 
            error_message: result.error 
          })
          .eq('id', log.id);
      }

      console.log(`[Broadcast] Enviado para ${log.client_name}: ${result.success ? 'OK' : result.error}`);
    }

    // Update campaign counts after each batch
    await supabase
      .from('broadcast_campaigns')
      .update({ 
        sent_count: sentCount,
        failed_count: failedCount
      })
      .eq('id', campaignId);

    // Wait 3 seconds before next batch (unless it's the last batch)
    if (i + BATCH_SIZE < logs.length) {
      console.log(`[Broadcast] Aguardando ${BATCH_DELAY_MS / 1000}s antes do próximo lote...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Mark campaign as completed
  await supabase
    .from('broadcast_campaigns')
    .update({ 
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', campaignId);

  console.log(`[Broadcast] Campanha finalizada. Enviados: ${sentCount}, Falhas: ${failedCount}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id } = await req.json();

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: 'campaign_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process broadcast in background
    EdgeRuntime.waitUntil(processBroadcast(campaign_id));

    return new Response(
      JSON.stringify({ success: true, message: 'Processamento iniciado' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Broadcast] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
