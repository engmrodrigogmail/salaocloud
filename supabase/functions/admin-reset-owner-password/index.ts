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
    const { establishment_id, new_password, new_email, bypass_auth } = body as {
      establishment_id?: string;
      new_password?: string;
      new_email?: string;
      bypass_auth?: string;
    };

    if (!establishment_id) return json({ error: "missing_establishment_id" }, 400);
    const password = new_password || "123mudar";
    if (password.length < 6) return json({ error: "password_too_short" }, 400);

    // Autenticação: super_admin OU service_role JWT (uso interno)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "unauthorized", message: "Sessão ausente. Entre novamente como superadmin." }, 401);
    }
    const token = authHeader.slice(7);
    if (token !== SERVICE_ROLE) {
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData?.user) {
        return json({
          error: "invalid_token",
          detail: userErr?.message,
          message: "Sua sessão expirou. Entre novamente como superadmin e tente resetar a senha.",
        }, 401);
      }
      const { data: roles, error: rolesErr } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
      const isAuthorized = !!roles?.some((r: any) => r.role === "super_admin");
      if (rolesErr) return json({ error: "roles_lookup_failed", message: "Não foi possível validar o perfil superadmin." }, 500);
      if (!isAuthorized) return json({ error: "forbidden", message: "Apenas superadmin pode resetar a senha do dono." }, 403);
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
    const updatePayload: any = {
      password,
      user_metadata: { ...currentMeta, must_change_password: true },
    };
    if (new_email && typeof new_email === "string") {
      updatePayload.email = new_email.trim().toLowerCase();
      updatePayload.email_confirm = true;
    }
    const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(est.owner_id, updatePayload);
    if (updErr) return json({ error: updErr.message || "update_failed" }, 500);

    // Mantém o email exibido no cadastro do salão igual ao email real de login do dono.
    // Isso evita o reset funcionar, mas o usuário tentar entrar com outro email cadastral.
    if (updated.user?.email) {
      await admin
        .from("establishments")
        .update({ email: updated.user.email, updated_at: new Date().toISOString() })
        .eq("id", establishment_id);
    }

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
