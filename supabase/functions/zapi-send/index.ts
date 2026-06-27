// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  // assume BR if missing country code
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

async function sendOne(phone: string, message: string) {
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    throw new Error("Z-API credentials not configured");
  }
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": ZAPI_CLIENT_TOKEN,
    },
    body: JSON.stringify({ phone, message }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Z-API ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isSuper } = await admin.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isSuper) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const message_type_key: string = body.message_type_key || "manual";
    const message: string = String(body.message ?? "").trim();
    if (!message) throw new Error("message required");

    let targets: { id?: string; name?: string; phone: string }[] = [];
    if (Array.isArray(body.recipients) && body.recipients.length > 0) {
      targets = body.recipients;
    } else {
      const { data: rec } = await admin
        .from("whatsapp_recipients")
        .select("id,name,phone,message_type_keys,is_active")
        .eq("is_active", true);
      targets = (rec || [])
        .filter((r: any) => (r.message_type_keys || []).includes(message_type_key))
        .map((r: any) => ({ id: r.id, name: r.name, phone: r.phone }));
    }

    const results: any[] = [];
    for (const t of targets) {
      const phone = normalizePhone(t.phone);
      if (!phone) continue;
      try {
        const resp = await sendOne(phone, message);
        await admin.from("whatsapp_send_log").insert({
          message_type_key,
          recipient_id: t.id ?? null,
          recipient_phone: phone,
          recipient_name: t.name ?? null,
          message_body: message,
          status: "sent",
          zapi_message_id: resp?.messageId ?? resp?.id ?? null,
          zapi_response: resp,
          sent_at: new Date().toISOString(),
        });
        results.push({ phone, ok: true });
      } catch (e: any) {
        await admin.from("whatsapp_send_log").insert({
          message_type_key,
          recipient_id: t.id ?? null,
          recipient_phone: phone,
          recipient_name: t.name ?? null,
          message_body: message,
          status: "failed",
          error: String(e?.message ?? e),
        });
        results.push({ phone, ok: false, error: String(e?.message ?? e) });
      }
    }

    return new Response(JSON.stringify({ success: true, sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
