// Reopen a closed tab with role/PIN guards.
// Owner: no PIN. Manager: PIN required + 24h since closed.
// Blocks if any commission for this tab is already marked as 'paid'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => null) as
      | { tab_id?: string; reason?: string; pin_hash?: string }
      | null;

    if (!body?.tab_id || !body.reason || body.reason.trim().length < 3) {
      return json({ error: "invalid_payload", message: "Informe um motivo (mín. 3 caracteres)." }, 400);
    }

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    const { data: tab, error: tabErr } = await admin
      .from("tabs")
      .select("*")
      .eq("id", body.tab_id)
      .maybeSingle();
    if (tabErr) throw tabErr;
    if (!tab) return json({ error: "tab_not_found" }, 404);
    if (tab.is_deleted) return json({ error: "tab_deleted", message: "Comanda excluída. Recupere antes de reabrir." }, 400);
    if (tab.status !== "closed") {
      return json({ error: "tab_not_closed", message: "Apenas comandas fechadas podem ser reabertas." }, 400);
    }

    const { data: est } = await admin
      .from("establishments")
      .select("id, owner_id, slug")
      .eq("id", tab.establishment_id)
      .maybeSingle();
    if (!est) return json({ error: "establishment_not_found" }, 404);

    const isOwner = est.owner_id === user.id;
    let isManager = false;
    let managerName: string | null = null;

    if (!isOwner) {
      const { data: prof } = await admin
        .from("professionals")
        .select("id, name, manager_pin_hash, is_manager, is_active")
        .eq("establishment_id", est.id)
        .eq("user_id", user.id)
        .eq("is_manager", true)
        .eq("is_active", true)
        .maybeSingle();
      if (!prof) return json({ error: "forbidden" }, 403);
      if (!body.pin_hash || body.pin_hash !== prof.manager_pin_hash) {
        return json({ error: "invalid_pin", message: "PIN incorreto." }, 401);
      }
      isManager = true;
      managerName = prof.name;

      if (tab.closed_at) {
        const ageMs = Date.now() - new Date(tab.closed_at).getTime();
        if (ageMs > 24 * 60 * 60 * 1000) {
          return json({ error: "tab_too_old", message: "Gerente só pode reabrir comandas fechadas há menos de 24h." }, 400);
        }
      }
    }

    // Block if any commission already paid
    const { data: paidComms, error: commErr } = await admin
      .from("professional_commissions")
      .select("id")
      .eq("tab_id", tab.id)
      .eq("status", "paid")
      .limit(1);
    if (commErr) throw commErr;
    if ((paidComms ?? []).length > 0) {
      return json({
        error: "commission_already_paid",
        message: "Comissão desta comanda já foi paga ao profissional. Reabertura bloqueada.",
      }, 400);
    }

    // Snapshot before mutations
    const [{ data: payments }, { data: commissions }] = await Promise.all([
      admin.from("tab_payments").select("*").eq("tab_id", tab.id),
      admin.from("professional_commissions").select("*").eq("tab_id", tab.id),
    ]);

    // Wipe pending commissions, payments and coupon usage
    await admin.from("professional_commissions").delete().eq("tab_id", tab.id).neq("status", "paid");
    await admin.from("tab_payments").delete().eq("tab_id", tab.id);
    if (tab.coupon_id) {
      await admin.from("coupon_usage").delete().eq("tab_id", tab.id);
    }

    // Reopen tab
    const { error: updErr } = await admin
      .from("tabs")
      .update({
        status: "open",
        closed_at: null,
        closed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tab.id);
    if (updErr) throw updErr;

    // Revert linked appointment from completed back to in_service
    if (tab.appointment_id) {
      await admin
        .from("appointments")
        .update({ status: "in_service" })
        .eq("id", tab.appointment_id)
        .eq("status", "completed");
    }

    // Audit log via notification to the establishment owner
    await admin.from("notifications").insert({
      recipient_type: "establishment",
      recipient_id: est.id,
      sender_type: "system",
      title: isManager ? "Comanda reaberta por gerente" : "Comanda reaberta",
      body: `${isManager ? managerName ?? "Gerente" : "Dono"} reabriu a comanda de ${tab.client_name}. Motivo: ${body.reason}.`,
      link: `/interno/${est.slug}/comandas`,
      data: {
        category: "tab_reopened",
        tab_id: tab.id,
        reason: body.reason,
        role: isOwner ? "owner" : "manager",
        snapshot: { payments: payments ?? [], commissions: commissions ?? [] },
      },
    });

    return json({ ok: true, role: isOwner ? "owner" : "manager", tab_id: tab.id });
  } catch (e: unknown) {
    console.error("reopen-tab-secure error:", e);
    const msg = e instanceof Error ? e.message : "internal_error";
    return json({ error: msg }, 500);
  }
});
