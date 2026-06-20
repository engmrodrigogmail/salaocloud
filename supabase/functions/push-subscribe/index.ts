// Edge function: push-subscribe
// Registers a Web Push subscription for the current user/client across:
// - admin (super_admin)
// - establishment (owner)
// - professional (linked user)
// - client (identified by client_id from request body — sem auth padrão)

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SubscriptionInput {
  scope: "admin" | "establishment" | "professional" | "client";
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  user_agent?: string;
  device_type?: string;
  // For client scope (no auth):
  client_id?: string;
  establishment_id?: string;
}

function inferDeviceType(ua: string | null | undefined): string {
  const s = (ua || "").toLowerCase();
  if (!s) return "unknown";
  if (s.includes("android")) return "android";
  if (s.includes("iphone") || s.includes("ipad") || s.includes("ipod")) return "ios";
  if (s.includes("windows")) return "windows";
  if (s.includes("mac")) return "macos";
  if (s.includes("linux")) return "linux";
  return "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as SubscriptionInput;
    const { scope, subscription, user_agent, device_type } = body;

    if (!scope || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return jsonResponse({ error: "invalid_payload" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const resolvedDeviceType = device_type || inferDeviceType(user_agent);

    const baseRow = {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: user_agent ?? null,
      device_type: resolvedDeviceType,
      is_active: true,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (scope === "client") {
      const { client_id, establishment_id } = body;
      if (!client_id) return jsonResponse({ error: "client_id_required" }, 400);

      // Verifica que o cliente existe
      const { data: client, error: clientErr } = await admin
        .from("clients")
        .select("id, establishment_id")
        .eq("id", client_id)
        .maybeSingle();
      if (clientErr || !client) return jsonResponse({ error: "client_not_found" }, 404);

      const { error } = await admin.from("client_push_subscriptions").upsert(
        { ...baseRow, client_id: client.id },
        { onConflict: "client_id,endpoint" },
      );
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true });
    }

    // Para admin/establishment/professional: resolver via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return jsonResponse({ error: "unauthorized" }, 401);
    const userId = claims.claims.sub;

    if (scope === "admin") {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
      const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
      if (!isSuper) return jsonResponse({ error: "forbidden" }, 403);
      const { error } = await admin.from("admin_push_subscriptions").upsert(
        { ...baseRow, user_id: userId },
        { onConflict: "endpoint" },
      );
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true });
    }

    if (scope === "establishment") {
      const { data: ownedEstablishments, error: ownedErr } = await admin
        .from("establishments")
        .select("id")
        .eq("owner_id", userId);

      if (ownedErr) return jsonResponse({ error: ownedErr.message }, 500);
      if (!ownedEstablishments?.length) return jsonResponse({ error: "no_establishment" }, 403);

      if (body.establishment_id && !ownedEstablishments.some((e) => e.id === body.establishment_id)) {
        return jsonResponse({ error: "forbidden" }, 403);
      }

      const rows = ownedEstablishments.map((estab) => ({
        ...baseRow,
        user_id: userId,
        establishment_id: estab.id,
      }));

      const { error } = await admin.from("establishment_push_subscriptions").upsert(
        rows,
        { onConflict: "establishment_id,user_id,endpoint" },
      );
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true, synced_establishments: rows.length });
    }

    if (scope === "professional") {
      const { data: profs, error: profErr } = await admin
        .from("professionals")
        .select("id, establishment_id")
        .eq("user_id", userId)
        .eq("is_active", true);
      if (profErr) return jsonResponse({ error: profErr.message }, 500);
      if (!profs?.length) return jsonResponse({ error: "no_professional" }, 403);

      const rows = profs.map((p) => ({
        ...baseRow,
        user_id: userId,
        professional_id: p.id,
      }));

      const { error } = await admin.from("professional_push_subscriptions").upsert(
        rows,
        { onConflict: "professional_id,endpoint" },
      );
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true, synced_professionals: rows.length });
    }

    return jsonResponse({ error: "invalid_scope" }, 400);
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? "internal_error" }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
