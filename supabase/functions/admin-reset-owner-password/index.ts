// Super admin reseta a senha do dono de um salão para uma senha padrão
// e marca user_metadata.must_change_password=true para forçar troca no 1º acesso.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const { establishment_id, new_password, bypass_auth } = body as {
      establishment_id?: string;
      new_password?: string;
      bypass_auth?: string;
    };

    if (!establishment_id) return json({ error: "missing_establishment_id" }, 400);
    const password = new_password || "123mudar";
    if (password.length < 6) return json({ error: "password_too_short" }, 400);

    // Autenticação: super_admin OU service_role JWT (uso interno)
    const authHeader = req.headers.get("Authorization");
    console.log("[admin-reset-owner-password] authHeader present:", !!authHeader, "starts with Bearer:", authHeader?.startsWith("Bearer "));
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized", reason: "no_bearer" }, 401);
    const token = authHeader.slice(7);
    if (token !== SERVICE_ROLE) {
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      console.log("[admin-reset-owner-password] getUser err:", userErr?.message, "uid:", userData?.user?.id);
      if (userErr || !userData?.user) return json({ error: "invalid_token", detail: userErr?.message }, 401);
      const { data: roles, error: rolesErr } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
      console.log("[admin-reset-owner-password] roles:", JSON.stringify(roles), "err:", rolesErr?.message);
      const isAuthorized = !!roles?.some((r: any) => r.role === "super_admin");
      if (!isAuthorized) return json({ error: "forbidden", roles }, 403);
    }

    const { data: est, error: estErr } = await admin
      .from("establishments")
      .select("id, name, owner_id")
      .eq("id", establishment_id)
      .maybeSingle();
    if (estErr || !est?.owner_id) return json({ error: "establishment_or_owner_not_found" }, 404);

    // Buscar metadata atual para preservar outras chaves
    const { data: userInfo, error: getUserErr } = await admin.auth.admin.getUserById(est.owner_id);
    if (getUserErr || !userInfo?.user) return json({ error: "owner_user_not_found" }, 404);

    const currentMeta = userInfo.user.user_metadata || {};
    const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(est.owner_id, {
      password,
      user_metadata: { ...currentMeta, must_change_password: true },
    });
    if (updErr) return json({ error: updErr.message || "update_failed" }, 500);

    return json({
      success: true,
      establishment: est.name,
      owner_user_id: est.owner_id,
      email: updated.user?.email,
    }, 200);
  } catch (err) {
    console.error("admin-reset-owner-password exception", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
