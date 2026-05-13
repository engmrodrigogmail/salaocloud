// Idempotent safety-net: re-evaluates training progress per profile and inserts
// any missing certificates for the authenticated sales_trainee. Returns the
// full list of the user's certificates so the client can detect new ones.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify caller via anon client + JWT
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Service-role client to bypass RLS for evaluation/insert
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: modules } = await admin
      .from("training_modules")
      .select("id, profile")
      .eq("is_active", true);

    const { data: progress } = await admin
      .from("training_user_progress")
      .select("module_id, status")
      .eq("user_id", userId);

    const completedSet = new Set(
      (progress ?? []).filter((p: any) => p.status === "completed").map((p: any) => p.module_id),
    );

    const byProfile = new Map<string, { total: number; done: number }>();
    for (const m of (modules ?? []) as any[]) {
      const stat = byProfile.get(m.profile) ?? { total: 0, done: 0 };
      stat.total += 1;
      if (completedSet.has(m.id)) stat.done += 1;
      byProfile.set(m.profile, stat);
    }

    const newlyIssued: string[] = [];
    for (const [profile, { total, done }] of byProfile.entries()) {
      if (total > 0 && done >= total) {
        const { data: existing } = await admin
          .from("training_certificates")
          .select("id")
          .eq("user_id", userId)
          .eq("profile", profile)
          .maybeSingle();
        if (!existing) {
          const { error: insErr } = await admin
            .from("training_certificates")
            .insert({ user_id: userId, profile });
          if (!insErr) newlyIssued.push(profile);
        }
      }
    }

    const { data: certs } = await admin
      .from("training_certificates")
      .select("profile, issued_at, code")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false });

    return new Response(JSON.stringify({ certificates: certs ?? [], newly_issued: newlyIssued }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
