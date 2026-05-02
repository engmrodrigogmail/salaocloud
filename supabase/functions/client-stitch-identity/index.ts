// Cria um registro local de cliente em outro salão (stitch),
// copiando dados do cadastro global do mesmo e-mail. Usa service role
// para evitar bloqueios de RLS no fluxo público de portal.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { establishment_id, source_client_id, email } = await req.json();

    if (!establishment_id || !source_client_id || !email) {
      return json({ error: "missing_params" }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Carrega cadastro fonte
    const { data: source, error: srcErr } = await supabase
      .from("clients")
      .select("id, name, phone, cpf, shared_history_consent, notes")
      .eq("id", source_client_id)
      .maybeSingle();

    if (srcErr || !source) {
      console.error("source lookup error", srcErr);
      return json({ error: "source_not_found" }, 404);
    }

    // 2) Verifica se já existe registro neste salão para este e-mail
    const { data: existing } = await supabase
      .from("clients")
      .select("id, name, phone, cpf, email, global_identity_email, establishment_id, shared_history_consent, notes")
      .eq("establishment_id", establishment_id)
      .or(`email.eq.${normalizedEmail},global_identity_email.eq.${normalizedEmail}`)
      .maybeSingle();

    if (existing) {
      return json({ status: "already_linked", client: existing }, 200);
    }

    // 3) Se houver CPF, valida que não existe outro cliente com mesmo CPF neste salão
    if (source.cpf) {
      const { data: cpfDup } = await supabase
        .from("clients")
        .select("id")
        .eq("establishment_id", establishment_id)
        .eq("cpf", source.cpf)
        .maybeSingle();
      if (cpfDup) {
        return json({ error: "cpf_already_in_salon" }, 409);
      }
    }

    const now = new Date().toISOString();
    const insertPayload = {
      establishment_id,
      name: source.name,
      phone: source.phone,
      cpf: source.cpf,
      email: normalizedEmail,
      global_identity_email: normalizedEmail,
      terms_accepted_at: now,
      shared_history_consent: source.shared_history_consent ?? false,
      user_id: null as string | null,
      notes: source.notes ?? null,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("clients")
      .insert(insertPayload)
      .select("id, name, phone, cpf, email, global_identity_email, establishment_id, shared_history_consent, notes, created_at, updated_at")
      .single();

    if (insErr) {
      console.error("stitch insert error", insErr);
      return json({ error: insErr.message, code: insErr.code }, 500);
    }

    return json({ status: "ok", client: inserted }, 200);
  } catch (err) {
    console.error("client-stitch-identity exception", err);
    return json({ error: (err as Error).message }, 500);
  }
});
