import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AptRow {
  id: string;
  client_id: string | null;
  service_id: string | null;
  professional_id: string | null;
  scheduled_at: string;
  status: string;
  created_at: string;
  tabs: { id: string }[] | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user via anon client
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { establishment_id } = await req.json();
    if (!establishment_id || typeof establishment_id !== "string") {
      return new Response(JSON.stringify({ error: "establishment_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Ownership check
    const { data: est, error: estErr } = await admin
      .from("establishments")
      .select("id, owner_id")
      .eq("id", establishment_id)
      .maybeSingle();

    if (estErr || !est || est.owner_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rows, error: rowsErr } = await admin
      .from("appointments")
      .select(`
        id, client_id, service_id, professional_id, scheduled_at, status, created_at,
        tabs(id)
      `)
      .eq("establishment_id", establishment_id)
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true });

    if (rowsErr) throw rowsErr;

    const PROTECTED_STATUSES = new Set(["in_service", "completed", "no_show", "cancelled"]);

    // Group by client+service+professional+scheduled_at
    const groups = new Map<string, AptRow[]>();
    for (const apt of (rows || []) as AptRow[]) {
      const key = `${apt.client_id ?? "null"}|${apt.service_id ?? ""}|${apt.professional_id ?? ""}|${apt.scheduled_at}`;
      const arr = groups.get(key) ?? [];
      arr.push(apt);
      groups.set(key, arr);
    }

    const toDelete: string[] = [];

    for (const arr of groups.values()) {
      if (arr.length <= 1) continue;

      // Rank: keep one that has a tab; otherwise keep oldest pending/confirmed.
      const sorted = [...arr].sort((a, b) => {
        const aTab = (a.tabs?.length ?? 0) > 0 ? 1 : 0;
        const bTab = (b.tabs?.length ?? 0) > 0 ? 1 : 0;
        if (aTab !== bTab) return bTab - aTab; // tab first
        const aProtected = PROTECTED_STATUSES.has(a.status) ? 1 : 0;
        const bProtected = PROTECTED_STATUSES.has(b.status) ? 1 : 0;
        if (aProtected !== bProtected) return bProtected - aProtected; // protected first
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); // oldest first
      });

      // Keep sorted[0]; consider others for deletion.
      for (let i = 1; i < sorted.length; i++) {
        const apt = sorted[i];
        const hasTab = (apt.tabs?.length ?? 0) > 0;
        if (hasTab) continue;
        if (PROTECTED_STATUSES.has(apt.status)) continue;
        toDelete.push(apt.id);
      }
    }

    let deleted = 0;
    if (toDelete.length > 0) {
      // Delete child rows first (appointment_services may not have cascade)
      await admin.from("appointment_services").delete().in("appointment_id", toDelete);
      const { error: delErr, count } = await admin
        .from("appointments")
        .delete({ count: "exact" })
        .in("id", toDelete);
      if (delErr) throw delErr;
      deleted = count ?? toDelete.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        groups_inspected: groups.size,
        duplicates_deleted: deleted,
        deleted_ids: toDelete,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("cleanup-duplicate-appointments error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
