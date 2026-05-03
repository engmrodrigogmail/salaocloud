// Cadastro Balcão com "Identity Stitching" invisível por TELEFONE.
// O salão envia { establishment_id, name, phone, email? } e a função:
//  1) verifica duplicidade local (mesmo telefone/e-mail no salão atual);
//  2) verifica silenciosamente se já existe identidade global (phone) na rede;
//  3) cria registro local SEM sobrescrever os dados digitados pela recepcionista,
//     apenas vinculando global_identity_phone (e global_identity_email se houver).
// Nunca expõe ao salão se o cliente já existia em outros estabelecimentos.
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

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

function formatPhoneBR(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const establishment_id: string | undefined = body?.establishment_id;
    const rawName: string = String(body?.name || "").trim();
    const rawPhone: string = String(body?.phone || "");
    const rawEmail: string | null = body?.email ? String(body.email).trim().toLowerCase() : null;

    if (!establishment_id || !rawName || onlyDigits(rawPhone).length < 10) {
      return json({ error: "missing_or_invalid_params" }, 400);
    }
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return json({ error: "invalid_email" }, 400);
    }

    const phoneDigits = onlyDigits(rawPhone);
    const phoneFormatted = formatPhoneBR(rawPhone);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Duplicado local (no mesmo salão)
    const orParts: string[] = [
      `global_identity_phone.eq.${phoneDigits}`,
      `phone.eq.${phoneFormatted}`,
    ];
    if (rawEmail) {
      orParts.push(`email.eq.${rawEmail}`);
      orParts.push(`global_identity_email.eq.${rawEmail}`);
    }
    const { data: localDup } = await supabase
      .from("clients")
      .select("id, name, phone, email")
      .eq("establishment_id", establishment_id)
      .or(orParts.join(","))
      .limit(1)
      .maybeSingle();

    if (localDup) {
      return json({ error: "already_in_salon", client: localDup }, 409);
    }

    // 2) Stitching silencioso: existe identidade global (phone) em outro salão?
    //    Não retornamos NADA dessa busca — uso interno apenas.
    const { data: globalMatch } = await supabase
      .from("clients")
      .select("id, global_identity_phone, global_identity_email")
      .eq("global_identity_phone", phoneDigits)
      .neq("establishment_id", establishment_id)
      .limit(1)
      .maybeSingle();

    // 3) Insere localmente — sempre usando os dados digitados pelo salão
    const insertPayload: Record<string, unknown> = {
      establishment_id,
      name: rawName,
      phone: phoneFormatted,
      email: rawEmail,
      global_identity_phone: phoneDigits,
      global_identity_email: rawEmail ?? globalMatch?.global_identity_email ?? null,
    };

    const { data: created, error: insErr } = await supabase
      .from("clients")
      .insert(insertPayload)
      .select("id, name, phone, email")
      .single();

    if (insErr) {
      console.error("balcao insert error", insErr);
      return json({ error: insErr.message, code: insErr.code }, 500);
    }

    // Resposta neutra: nunca informamos se houve match global
    return json({ status: "ok", client: created }, 200);
  } catch (err) {
    console.error("client-create-balcao exception", err);
    return json({ error: (err as Error).message }, 500);
  }
});
