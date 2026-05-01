// Edge function: push-process-pending
// - Lê notifications recentes com delivered_push=false
// - Envia Web Push para os endpoints ativos do destinatário
// - Marca delivered_push=true
// - Lê appointments cujo lembrete está dentro da janela e dispara push para o cliente
//
// Invocada por cron (a cada 1 minuto) via pg_cron + pg_net.

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWebPush, type PushPayload } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function tableForRecipient(type: string): { table: string; column: string } | null {
  switch (type) {
    case "admin":
      return { table: "admin_push_subscriptions", column: "user_id" };
    case "establishment":
      return { table: "establishment_push_subscriptions", column: "establishment_id" };
    case "professional":
      return { table: "professional_push_subscriptions", column: "professional_id" };
    case "client":
      return { table: "client_push_subscriptions", column: "client_id" };
    default:
      return null;
  }
}

async function sendToRecipient(
  admin: ReturnType<typeof createClient>,
  recipient_type: string,
  recipient_id: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; total: number }> {
  const target = tableForRecipient(recipient_type);
  if (!target) return { sent: 0, failed: 0, total: 0 };

  const { data: subs } = await admin
    .from(target.table)
    .select("id, endpoint, p256dh, auth")
    .eq(target.column, recipient_id)
    .eq("is_active", true);

  let sent = 0;
  let failed = 0;
  const goneIds: string[] = [];
  for (const s of subs ?? []) {
    const r = await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
    if (r.ok) sent++;
    else {
      failed++;
      if (r.gone) goneIds.push(s.id);
    }
  }
  if (goneIds.length) {
    await admin.from(target.table).update({ is_active: false }).in("id", goneIds);
  }
  return { sent, failed, total: subs?.length ?? 0 };
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const result = { notifications_processed: 0, reminders_processed: 0 };

  // ============ 1) NOTIFICATIONS PENDENTES ============
  const { data: pending } = await admin
    .from("notifications")
    .select("id, recipient_type, recipient_id, title, body, link, data")
    .eq("delivered_push", false)
    .order("created_at", { ascending: true })
    .limit(50);

  for (const n of pending ?? []) {
    const payload: PushPayload = {
      title: n.title,
      body: n.body,
      url: n.link ?? undefined,
      data: { notification_id: n.id, ...((n.data as Record<string, unknown>) ?? {}) },
    };
    await sendToRecipient(admin, n.recipient_type, n.recipient_id, payload);
    await admin.from("notifications").update({ delivered_push: true }).eq("id", n.id);
    result.notifications_processed++;
  }

  // ============ 2) LEMBRETES DE AGENDAMENTO ============
  // Janela: agendamentos cujo (scheduled_at - lead_minutes) está entre agora-90s e agora+60s
  // Tolerância para garantir que o cron de 1min sempre pegue. Marca reminder_sent_at para idempotência.
  const now = new Date();
  const horizonMin = 24 * 60; // checa até 24h à frente
  const horizonAhead = new Date(now.getTime() + horizonMin * 60 * 1000).toISOString();

  const { data: appts } = await admin
    .from("appointments")
    .select(
      "id, establishment_id, client_id, client_name, scheduled_at, service_id, professional_id",
    )
    .is("reminder_sent_at", null)
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", horizonAhead)
    .limit(200);

  for (const a of appts ?? []) {
    if (!a.client_id) continue;

    // Settings do estabelecimento
    const { data: settings } = await admin
      .from("notification_settings")
      .select("appointment_reminder_enabled, appointment_reminder_minutes_before, appointment_reminder_template")
      .eq("establishment_id", a.establishment_id)
      .maybeSingle();

    const enabled = settings?.appointment_reminder_enabled ?? true;
    const lead = settings?.appointment_reminder_minutes_before ?? 120;
    const template =
      settings?.appointment_reminder_template ??
      "Olá {cliente}! Lembrete do seu agendamento de {servico} às {hora}. Te esperamos!";

    if (!enabled) continue;

    const fireAt = new Date(new Date(a.scheduled_at).getTime() - lead * 60 * 1000);
    // Janela: dispara se já passou do horário ou está dentro de 60s
    if (fireAt.getTime() > now.getTime() + 60 * 1000) continue;

    // Resolve nomes
    const [{ data: service }, { data: prof }, { data: estab }] = await Promise.all([
      admin.from("services").select("name").eq("id", a.service_id).maybeSingle(),
      a.professional_id
        ? admin.from("professionals").select("name").eq("id", a.professional_id).maybeSingle()
        : Promise.resolve({ data: null as { name: string } | null }),
      admin.from("establishments").select("slug, name").eq("id", a.establishment_id).maybeSingle(),
    ]);

    const horaFmt = new Date(a.scheduled_at).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });

    const body = renderTemplate(template, {
      cliente: a.client_name ?? "Cliente",
      servico: service?.name ?? "seu serviço",
      hora: horaFmt,
      profissional: prof?.name ?? "",
    });

    // Cria notification para o cliente + envia push
    const { data: notif } = await admin
      .from("notifications")
      .insert({
        recipient_type: "client",
        recipient_id: a.client_id,
        sender_type: "system",
        title: estab?.name ? `Lembrete — ${estab.name}` : "Lembrete de agendamento",
        body,
        link: estab?.slug ? `/${estab.slug}` : null,
        data: { appointment_id: a.id, category: "appointment_reminder" },
        delivered_push: true, // já vamos enviar agora
      })
      .select("id")
      .single();

    await sendToRecipient(admin, "client", a.client_id, {
      title: estab?.name ? `Lembrete — ${estab.name}` : "Lembrete de agendamento",
      body,
      url: estab?.slug ? `/${estab.slug}` : "/",
      data: { notification_id: notif?.id, appointment_id: a.id, category: "appointment_reminder" },
    });

    await admin
      .from("appointments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", a.id);

    result.reminders_processed++;
  }

  return new Response(JSON.stringify({ ok: true, ...result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
