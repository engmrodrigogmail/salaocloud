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
  // For client scope (no auth):
  client_id?: string;
  establishment_id?: string;
  // For establishment/professional scope (resolved server-side from auth):
  // nothing extra needed
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as SubscriptionInput;
    const { scope, subscription, user_agent } = body;

    if (!scope || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return jsonResponse({ error: "invalid_payload" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const baseRow = {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: user_agent ?? null,
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
        { onConflict: "endpoint" },
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
      const { data: estab } = await admin
        .from("establishments")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!estab) return jsonResponse({ error: "no_establishment" }, 403);
      const { error } = await admin.from("establishment_push_subscriptions").upsert(
        { ...baseRow, user_id: userId, establishment_id: estab.id },
        { onConflict: "endpoint" },
      );
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true });
    }

    if (scope === "professional") {
      const { data: prof } = await admin
        .from("professionals")
        .select("id, establishment_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (!prof) return jsonResponse({ error: "no_professional" }, 403);
      const { error } = await admin.from("professional_push_subscriptions").upsert(
        { ...baseRow, user_id: userId, professional_id: prof.id, establishment_id: prof.establishment_id },
        { onConflict: "endpoint" },
      );
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true });
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
