// Recover (un-soft-delete) a tab. Owner-only. Marks tab as recovered_by_owner.
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
    const body = await req.json().catch(() => null) as { tab_id?: string } | null;
    if (!body?.tab_id) return json({ error: "invalid_payload" }, 400);

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
      .select("id, establishment_id, is_deleted")
      .eq("id", body.tab_id)
      .maybeSingle();
    if (tabErr) throw tabErr;
    if (!tab) return json({ error: "tab_not_found" }, 404);
    if (!tab.is_deleted) return json({ error: "tab_not_deleted" }, 400);

    const { data: est } = await admin
      .from("establishments")
      .select("owner_id")
      .eq("id", tab.establishment_id)
      .maybeSingle();
    if (est?.owner_id !== user.id) return json({ error: "forbidden_only_owner" }, 403);

    const nowIso = new Date().toISOString();

    const { error: updErr } = await admin
      .from("tabs")
      .update({
        is_deleted: false,
        recovered_at: nowIso,
        deletion_mark: "recovered_by_owner",
      })
      .eq("id", tab.id);
    if (updErr) throw updErr;

    // Regenerate pending commissions (paid ones are preserved by the RPC)
    try {
      await admin.rpc("recalculate_tab_commissions", { _tab_id: tab.id });
    } catch (e) {
      console.error("recalculate_tab_commissions failed:", e);
    }

    // Stamp most recent deletion record
    const { data: lastDel } = await admin
      .from("tab_deletions")
      .select("id")
      .eq("tab_id", tab.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastDel?.id) {
      await admin
        .from("tab_deletions")
        .update({ recovered_at: nowIso, recovered_by_user_id: user.id })
        .eq("id", lastDel.id);
    }

    return json({ ok: true, tab_id: tab.id });
  } catch (e: unknown) {
    console.error("recover-deleted-tab error:", e);
    const msg = e instanceof Error ? e.message : "internal_error";
    return json({ error: msg }, 500);
  }
});
