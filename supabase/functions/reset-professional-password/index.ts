// Reseta a senha de um profissional para uma senha definida pelo dono/gerente.
// Marca must_change_password=true para forçar troca no próximo login.
// Apenas o owner do estabelecimento (ou super_admin) pode chamar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ResetRequest {
  establishment_id: string;
  professional_id: string;
  new_password: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);
    const callerId = userData.user.id;

    const body = (await req.json()) as Partial<ResetRequest>;
    const { establishment_id, professional_id, new_password } = body;
    if (!establishment_id || !professional_id || !new_password) {
      return json({ error: "missing_fields" }, 400);
    }
    if (new_password.length < 6) return json({ error: "password_too_short" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Permissão: dono OU super_admin
    const { data: est } = await admin
      .from("establishments")
      .select("id, owner_id")
      .eq("id", establishment_id)
      .maybeSingle();
    if (!est) return json({ error: "establishment_not_found" }, 404);

    const isOwner = est.owner_id === callerId;
    let isSuperAdmin = false;
    if (!isOwner) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId);
      isSuperAdmin = !!roles?.some((r: any) => r.role === "super_admin");
    }
    if (!isOwner && !isSuperAdmin) return json({ error: "forbidden" }, 403);

    // Profissional precisa pertencer ao salão e já ter conta
    const { data: prof } = await admin
      .from("professionals")
      .select("id, user_id, establishment_id")
      .eq("id", professional_id)
      .maybeSingle();
    if (!prof) return json({ error: "professional_not_found" }, 404);
    if (prof.establishment_id !== establishment_id) return json({ error: "professional_mismatch" }, 400);
    if (!prof.user_id) return json({ error: "no_account" }, 400);

    // Atualiza a senha + força troca
    const { error: updErr } = await admin.auth.admin.updateUserById(prof.user_id, {
      password: new_password,
      user_data: undefined,
    } as any);
    if (updErr) {
      console.error("updateUserById failed", updErr);
      return json({ error: updErr.message || "update_failed" }, 500);
    }

    const { error: flagErr } = await admin
      .from("professionals")
      .update({ must_change_password: true })
      .eq("id", professional_id);
    if (flagErr) {
      console.error("flag update failed", flagErr);
      return json({ error: "flag_failed" }, 500);
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error("reset-professional-password exception", err);
    return json({ error: (err as Error).message || "unknown_error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
