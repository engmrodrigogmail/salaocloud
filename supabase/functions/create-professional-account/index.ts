// Cria conta de profissional: auth.users + professionals.user_id + user_roles.
// Apenas o owner do estabelecimento (ou super_admin) pode chamar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateProfessionalRequest {
  establishment_id: string;
  professional_id: string; // Já criado em professionals (sem user_id)
  email: string;
  password: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Validar JWT do chamador
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const token = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "invalid_token" }, 401);
    }
    const callerId = userData.user.id;

    // 2. Body
    const body = (await req.json()) as Partial<CreateProfessionalRequest>;
    const { establishment_id, professional_id, email, password } = body;

    if (!establishment_id || !professional_id || !email || !password) {
      return json({ error: "missing_fields" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "password_too_short" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "invalid_email" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 3. Verificar se chamador é dono do estabelecimento OU super_admin
    const { data: est, error: estErr } = await admin
      .from("establishments")
      .select("id, owner_id")
      .eq("id", establishment_id)
      .maybeSingle();

    if (estErr || !est) {
      return json({ error: "establishment_not_found" }, 404);
    }

    const isOwner = est.owner_id === callerId;
    let isSuperAdmin = false;
    if (!isOwner) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId);
      isSuperAdmin = !!roles?.some((r: any) => r.role === "super_admin");
    }
    if (!isOwner && !isSuperAdmin) {
      return json({ error: "forbidden" }, 403);
    }

    // 4. Verificar profissional existe e pertence ao establishment
    const { data: prof, error: profErr } = await admin
      .from("professionals")
      .select("id, user_id, establishment_id, name")
      .eq("id", professional_id)
      .maybeSingle();

    if (profErr || !prof) return json({ error: "professional_not_found" }, 404);
    if (prof.establishment_id !== establishment_id) {
      return json({ error: "professional_mismatch" }, 400);
    }
    if (prof.user_id) {
      return json({ error: "already_linked" }, 409);
    }

    // 5. Criar usuário no auth (auto-confirmado para evitar fluxo de email)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: prof.name, kind: "professional" },
    });

    if (createErr || !created?.user) {
      console.error("createUser failed", createErr);
      return json({ error: createErr?.message || "create_user_failed" }, 400);
    }

    const newUserId = created.user.id;

    // 6. Vincular professional + must_change_password=true
    const { error: linkErr } = await admin
      .from("professionals")
      .update({
        user_id: newUserId,
        must_change_password: true,
        email: email.trim().toLowerCase(),
      })
      .eq("id", professional_id);

    if (linkErr) {
      console.error("link prof failed; rollback user", linkErr);
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: "link_failed" }, 500);
    }

    // 7. Inserir role
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "professional" });

    if (roleErr && !roleErr.message?.includes("duplicate")) {
      console.error("role insert failed; rollback", roleErr);
      await admin.from("professionals")
        .update({ user_id: null, must_change_password: false })
        .eq("id", professional_id);
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: "role_failed" }, 500);
    }

    return json({ success: true, user_id: newUserId }, 200);
  } catch (err) {
    console.error("create-professional-account exception", err);
    return json({ error: (err as Error).message || "unknown_error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
