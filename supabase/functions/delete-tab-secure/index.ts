// Soft-delete a tab with full audit + role/PIN guards.
// Owner: no PIN, no limits. Manager: PIN required, 5/day + 24h since opened.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Reason = "duplicate" | "error" | "fraud" | "client_request" | "system_error" | "other";
const REASONS: Reason[] = ["duplicate", "error", "fraud", "client_request", "system_error", "other"];

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
      | { tab_id?: string; reason?: Reason; notes?: string; pin_hash?: string }
      | null;

    if (!body?.tab_id || !body.reason || !REASONS.includes(body.reason)) {
      return json({ error: "invalid_payload" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    // Load tab
    const { data: tab, error: tabErr } = await admin
      .from("tabs")
      .select("*")
      .eq("id", body.tab_id)
      .maybeSingle();
    if (tabErr) throw tabErr;
    if (!tab) return json({ error: "tab_not_found" }, 404);
    if (tab.is_deleted) return json({ error: "tab_already_deleted" }, 400);

    // Resolve role
    const { data: est } = await admin
      .from("establishments")
      .select("id, owner_id, slug, name")
      .eq("id", tab.establishment_id)
      .maybeSingle();
    if (!est) return json({ error: "establishment_not_found" }, 404);

    const isOwner = est.owner_id === user.id;
    let isManager = false;
    let managerProfId: string | null = null;
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

      // PIN required for managers
      if (!body.pin_hash || body.pin_hash !== prof.manager_pin_hash) {
        return json({ error: "invalid_pin" }, 401);
      }
      isManager = true;
      managerProfId = prof.id;
      managerName = prof.name;

      // Time limit: 24h since opened
      const ageMs = Date.now() - new Date(tab.opened_at).getTime();
      if (ageMs > 24 * 60 * 60 * 1000) {
        return json({ error: "tab_too_old", message: "Gerente só pode excluir comandas dentro de 24h da abertura." }, 400);
      }

      // Daily quota: 5/day
      const startOfDayUtc = new Date();
      startOfDayUtc.setUTCHours(0, 0, 0, 0);
      const { count: deletedToday } = await admin
        .from("tab_deletions")
        .select("id", { count: "exact", head: true })
        .eq("deleted_by_user_id", user.id)
        .eq("deleted_by_role", "manager")
        .gte("created_at", startOfDayUtc.toISOString());

      if ((deletedToday ?? 0) >= 5) {
        return json({ error: "daily_limit_exceeded", message: "Limite diário de 5 exclusões atingido." }, 400);
      }
    }

    // Snapshot
    const [{ data: items }, { data: payments }] = await Promise.all([
      admin.from("tab_items").select("*").eq("tab_id", tab.id),
      admin.from("tab_payments").select("*").eq("tab_id", tab.id),
    ]);
    const snapshot = { tab, items: items ?? [], payments: payments ?? [] };

    // Record deletion
    const { error: insErr } = await admin.from("tab_deletions").insert({
      tab_id: tab.id,
      establishment_id: est.id,
      deleted_by_user_id: user.id,
      deleted_by_role: isOwner ? "owner" : "manager",
      deletion_reason: body.reason,
      deletion_notes: body.notes ?? null,
      original_tab_data: snapshot,
      pin_verified: isManager,
      ip_address: req.headers.get("x-forwarded-for") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    });
    if (insErr) throw insErr;

    // Soft delete tab
    const { error: updErr } = await admin
      .from("tabs")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: user.id,
        deletion_reason: body.reason,
      })
      .eq("id", tab.id);
    if (updErr) throw updErr;

    // Notify owner when manager deleted
    if (isManager) {
      await admin.from("notifications").insert({
        recipient_type: "establishment",
        recipient_id: est.id,
        sender_type: "system",
        title: "Comanda excluída por gerente",
        body: `${managerName ?? "Gerente"} excluiu a comanda de ${tab.client_name} (motivo: ${body.reason}).${body.notes ? ` Obs: ${body.notes}` : ""}`,
        link: `/interno/${est.slug}/comandas`,
        data: {
          category: "tab_deleted",
          tab_id: tab.id,
          manager_professional_id: managerProfId,
          reason: body.reason,
        },
      });
    }

    return json({
      ok: true,
      role: isOwner ? "owner" : "manager",
      tab_id: tab.id,
    });
  } catch (e: unknown) {
    console.error("delete-tab-secure error:", e);
    const msg = e instanceof Error ? e.message : "internal_error";
    return json({ error: msg }, 500);
  }
});
