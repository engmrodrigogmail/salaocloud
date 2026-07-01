// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

async function sendOne(phone: string, message: string) {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": ZAPI_CLIENT_TOKEN!,
    },
    body: JSON.stringify({ phone, message }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Z-API ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const salon_name = String(body.salon_name || "").trim();
    const owner_name = String(body.owner_name || "").trim();
    if (!salon_name) throw new Error("salon_name required");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load template
    const { data: type } = await admin
      .from("whatsapp_message_types")
      .select("template, is_active")
      .eq("key", "new_signup")
      .maybeSingle();

    if (!type || !type.is_active) {
      return new Response(JSON.stringify({ skipped: true, reason: "type inactive" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = (type.template || "")
      .replaceAll("{{salon_name}}", salon_name)
      .replaceAll("{{owner_name}}", owner_name || "—");

    const { data: recs } = await admin
      .from("whatsapp_recipients")
      .select("id,name,phone,message_type_keys,is_active")
      .eq("is_active", true);

    const targets = (recs || []).filter((r: any) =>
      (r.message_type_keys || []).includes("new_signup")
    );

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      throw new Error("Z-API credentials not configured");
    }

    let sent = 0;
    for (const t of targets) {
      const phone = normalizePhone(t.phone);
      if (!phone) continue;
      try {
        const resp = await sendOne(phone, message);
        await admin.from("whatsapp_send_log").insert({
          message_type_key: "new_signup",
          recipient_id: t.id,
          recipient_name: t.name,
          recipient_phone: phone,
          message_body: message,
          status: "sent",
          payload: resp,
        });
        sent++;
      } catch (err: any) {
        await admin.from("whatsapp_send_log").insert({
          message_type_key: "new_signup",
          recipient_id: t.id,
          recipient_name: t.name,
          recipient_phone: phone,
          message_body: message,
          status: "failed",
          error: String(err?.message || err),
        });
      }
    }

    return new Response(JSON.stringify({ sent, total: targets.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
