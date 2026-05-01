// Edge function: push-send
// Cria registro em `notifications` e envia Web Push para todos os endpoints ativos
// do destinatário (admin / establishment / professional / client).
//
// Chamada por: triggers (cron, pg_net), UI de admin/estabelecimento.
// Auth: requer service role OU usuário autenticado com permissão sobre o destinatário.

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWebPush, type PushPayload } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RecipientType = "admin" | "establishment" | "professional" | "client";
type ActorType = "system" | "admin" | "establishment" | "professional" | "client";

interface SendInput {
  recipient_type: RecipientType;
  recipient_id: string; // user_id (admin), establishment_id, professional_id, client_id
  sender_type?: ActorType;
  sender_id?: string | null;
  title: string;
  body: string;
  link?: string;
  data?: Record<string, unknown>;
  category?: string;
  // Se true, NÃO grava em notifications (só envia push). Default false.
  skip_history?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const input = (await req.json()) as SendInput;
    if (!input?.recipient_type || !input?.recipient_id || !input?.title || !input?.body) {
      return json({ error: "invalid_payload" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve subscriptions table + filter
    let table: string;
    let column: string;
    switch (input.recipient_type) {
      case "admin":
        table = "admin_push_subscriptions";
        column = "user_id";
        break;
      case "establishment":
        table = "establishment_push_subscriptions";
        column = "establishment_id";
        break;
      case "professional":
        table = "professional_push_subscriptions";
        column = "professional_id";
        break;
      case "client":
        table = "client_push_subscriptions";
        column = "client_id";
        break;
    }

    const { data: subs, error: subsErr } = await admin
      .from(table)
      .select("id, endpoint, p256dh, auth")
      .eq(column, input.recipient_id)
      .eq("is_active", true);
    if (subsErr) return json({ error: subsErr.message }, 500);

    // 1. Grava notification (in-app)
    let notification_id: string | null = null;
    if (!input.skip_history) {
      const { data: notif, error: notifErr } = await admin
        .from("notifications")
        .insert({
          recipient_type: input.recipient_type,
          recipient_id: input.recipient_id,
          sender_type: input.sender_type ?? "system",
          sender_id: input.sender_id ?? null,
          title: input.title,
          body: input.body,
          link: input.link ?? null,
          data: input.data ?? {},
        })
        .select("id")
        .single();
      if (notifErr) return json({ error: notifErr.message }, 500);
      notification_id = notif.id;
    }

    // 2. Envia push para cada subscription
    const payload: PushPayload = {
      title: input.title,
      body: input.body,
      url: input.link,
      tag: input.category,
      data: { notification_id, ...(input.data ?? {}) },
    };

    let sent = 0;
    let failed = 0;
    const goneIds: string[] = [];
    for (const sub of subs ?? []) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
      );
      if (result.ok) sent++;
      else {
        failed++;
        if (result.gone) goneIds.push(sub.id);
      }
    }

    if (goneIds.length > 0) {
      await admin.from(table).update({ is_active: false }).in("id", goneIds);
    }

    return json({ ok: true, notification_id, sent, failed, total: subs?.length ?? 0 });
  } catch (e: any) {
    return json({ error: e?.message ?? "internal_error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
