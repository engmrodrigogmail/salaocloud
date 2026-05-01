// Edge function: notifications-broadcast
// Envia notificações em massa de forma autenticada.
//
// Usuários:
// - Owner do estabelecimento: pode enviar para 'all_professionals', 'all_clients' ou
//   'specific_clients'/'specific_professionals' (limitados ao próprio estabelecimento).
// - Super Admin: pode enviar para 'all_establishments', 'active_establishments',
//   'inactive_establishments' ou 'specific_establishments'.
//
// Segurança: valida JWT do chamador via getClaims; checa role/ownership antes de inserir.

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWebPush, type PushPayload } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EstablishmentTarget =
  | "all_establishments"
  | "active_establishments"
  | "inactive_establishments"
  | "specific_establishments";

type SalonTarget =
  | "all_professionals"
  | "all_clients"
  | "specific_clients"
  | "specific_professionals";

interface BroadcastInput {
  scope: "admin" | "establishment";
  target: EstablishmentTarget | SalonTarget;
  ids?: string[];           // for *specific_*
  establishment_id?: string; // required when scope='establishment'
  title: string;
  body: string;
  link?: string | null;
  category?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.slice(7);
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const input = (await req.json()) as BroadcastInput;
    if (!input?.title || !input?.body || !input?.scope || !input?.target) {
      return json({ error: "invalid_payload" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let recipients: { type: "client" | "professional" | "establishment"; id: string }[] = [];
    let sender_type: "establishment" | "admin";
    let sender_id: string | null = null;

    if (input.scope === "establishment") {
      // Verifica que o usuário é dono do estabelecimento informado
      if (!input.establishment_id) return json({ error: "establishment_required" }, 400);
      const { data: est } = await admin
        .from("establishments")
        .select("id, owner_id")
        .eq("id", input.establishment_id)
        .maybeSingle();
      if (!est || est.owner_id !== userId) return json({ error: "forbidden" }, 403);
      sender_type = "establishment";
      sender_id = est.id;

      if (input.target === "all_clients") {
        const { data } = await admin
          .from("clients")
          .select("id")
          .eq("establishment_id", est.id);
        recipients = (data ?? []).map((r) => ({ type: "client" as const, id: r.id }));
      } else if (input.target === "specific_clients") {
        if (!input.ids?.length) return json({ error: "ids_required" }, 400);
        const { data } = await admin
          .from("clients")
          .select("id")
          .in("id", input.ids)
          .eq("establishment_id", est.id);
        recipients = (data ?? []).map((r) => ({ type: "client" as const, id: r.id }));
      } else if (input.target === "all_professionals") {
        const { data } = await admin
          .from("professionals")
          .select("id")
          .eq("establishment_id", est.id)
          .eq("is_active", true);
        recipients = (data ?? []).map((r) => ({ type: "professional" as const, id: r.id }));
      } else if (input.target === "specific_professionals") {
        if (!input.ids?.length) return json({ error: "ids_required" }, 400);
        const { data } = await admin
          .from("professionals")
          .select("id")
          .in("id", input.ids)
          .eq("establishment_id", est.id);
        recipients = (data ?? []).map((r) => ({ type: "professional" as const, id: r.id }));
      } else {
        return json({ error: "invalid_target" }, 400);
      }
    } else {
      // scope === 'admin'
      const { data: roleRows } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isSuperAdmin = (roleRows ?? []).some((r) => r.role === "super_admin");
      if (!isSuperAdmin) return json({ error: "forbidden" }, 403);
      sender_type = "admin";
      sender_id = userId;

      let q = admin.from("establishments").select("id, status");
      if (input.target === "active_establishments") q = q.eq("status", "active");
      if (input.target === "inactive_establishments") q = q.neq("status", "active");
      if (input.target === "specific_establishments") {
        if (!input.ids?.length) return json({ error: "ids_required" }, 400);
        q = q.in("id", input.ids);
      }
      // 'all_establishments' = no filter
      const { data } = await q;
      recipients = (data ?? []).map((r) => ({ type: "establishment" as const, id: r.id }));
    }

    if (recipients.length === 0) {
      return json({ ok: true, total: 0, sent: 0, failed: 0, notifications_created: 0 });
    }

    // 1. Insere notificações em lote
    const rows = recipients.map((r) => ({
      recipient_type: r.type,
      recipient_id: r.id,
      sender_type,
      sender_id,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      data: input.category ? { category: input.category } : {},
    }));
    const { data: inserted, error: insertErr } = await admin
      .from("notifications")
      .insert(rows)
      .select("id, recipient_type, recipient_id");
    if (insertErr) return json({ error: insertErr.message }, 500);

    // 2. Envia push para subscriptions ativas
    const tableMap: Record<string, { table: string; col: string }> = {
      client: { table: "client_push_subscriptions", col: "client_id" },
      professional: { table: "professional_push_subscriptions", col: "professional_id" },
      establishment: { table: "establishment_push_subscriptions", col: "establishment_id" },
    };

    let sent = 0;
    let failed = 0;
    for (const grp of ["client", "professional", "establishment"] as const) {
      const idsForGrp = recipients.filter((r) => r.type === grp).map((r) => r.id);
      if (!idsForGrp.length) continue;
      const { data: subs } = await admin
        .from(tableMap[grp].table)
        .select("id, endpoint, p256dh, auth, " + tableMap[grp].col)
        .in(tableMap[grp].col, idsForGrp)
        .eq("is_active", true);
      if (!subs?.length) continue;
      const goneIds: string[] = [];
      for (const sub of subs) {
        const payload: PushPayload = {
          title: input.title,
          body: input.body,
          url: input.link ?? undefined,
          tag: input.category,
          data: { category: input.category },
        };
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
      if (goneIds.length) {
        await admin.from(tableMap[grp].table).update({ is_active: false }).in("id", goneIds);
      }
    }

    return json({
      ok: true,
      total: recipients.length,
      notifications_created: inserted?.length ?? 0,
      sent,
      failed,
    });
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
