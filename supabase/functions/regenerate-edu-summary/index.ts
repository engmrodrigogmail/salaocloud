import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_MODELS = ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"];

const SYSTEM_PROMPT = `Você é o Edu, especialista em tricologia. Você receberá:
- A análise técnica original gerada pela IA (tipo, porosidade, dano, problemas)
- A auto-percepção e o resultado esperado da cliente
- A OBSERVAÇÃO DO PROFISSIONAL HUMANO que revisou o caso

Sua tarefa: reescrever a seção "Edu e Você" (3 a 6 frases, tom empático e direto à cliente em 2ª pessoa).
REGRAS CRÍTICAS:
1. A observação do profissional PREVALECE sobre a análise da IA em qualquer divergência.
2. Incorpore naturalmente as observações no texto, refazendo a avaliação para eliminar inconsistências.
3. NÃO mencione que houve revisão profissional, nem cite "profissional", "humano", "correção" ou similares. Apenas escreva como se fosse a avaliação final do Edu.
4. Conecte estado atual + resultado esperado da cliente com o diagnóstico final consolidado, com orientações práticas.
Retorne APENAS um JSON: {"edu_personal_response": "texto..."}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
    if (!CLAUDE_API_KEY) return json({ error: "CLAUDE_API_KEY missing" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "invalid_token" }, 401);
    const userId = userData.user.id;

    const { profile_id } = await req.json();
    if (!profile_id) return json({ error: "profile_id required" }, 400);

    const { data: profile } = await admin
      .from("client_hair_profiles")
      .select("*")
      .eq("id", profile_id)
      .maybeSingle();
    if (!profile) return json({ error: "not_found" }, 404);

    const { data: est } = await admin
      .from("establishments")
      .select("owner_id")
      .eq("id", profile.establishment_id)
      .maybeSingle();
    if (!est || est.owner_id !== userId) return json({ error: "forbidden" }, 403);

    if (!profile.professional_correction) {
      return json({ skipped: true, reason: "no_correction" }, 200);
    }

    const userMsg = `Análise técnica original (IA):
- Tipo: ${profile.hair_type ?? "—"}
- Porosidade: ${profile.porosity_level ?? "—"}
- Nível de dano: ${profile.damage_level ?? "—"}
- Problemas identificados: ${JSON.stringify(profile.identified_issues ?? [])}
- Explicação técnica: ${profile.technical_explanation ?? "—"}

Auto-percepção da cliente: ${profile.client_self_assessment ?? "(não respondido)"}
Resultado esperado pela cliente: ${profile.client_expected_result ?? "(não respondido)"}

OBSERVAÇÃO DO PROFISSIONAL (PREVALECE):
${profile.professional_correction}

Reescreva a seção "Edu e Você" consolidando tudo conforme as regras.`;

    let res: Response | null = null;
    let lastErr = "";
    for (const model of ANTHROPIC_MODELS) {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
      if (res.ok) break;
      lastErr = await res.text();
      if (!(res.status === 404 && lastErr.toLowerCase().includes("model"))) break;
    }
    if (!res?.ok) {
      return json({ error: "claude_error", detail: lastErr.slice(0, 500) }, 502);
    }
    const data = await res.json();
    const raw: string = data?.content?.[0]?.text ?? "";
    let parsed: any = null;
    try {
      const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
      const m = cleaned.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : JSON.parse(cleaned);
    } catch {
      return json({ error: "parse_failed", raw }, 502);
    }
    const newText = (parsed.edu_personal_response || "").toString().trim();
    if (!newText) return json({ error: "empty_response" }, 502);

    const { error: upErr } = await admin
      .from("client_hair_profiles")
      .update({ edu_personal_response: newText })
      .eq("id", profile_id);
    if (upErr) return json({ error: "update_failed", detail: upErr.message }, 500);

    return json({ success: true, edu_personal_response: newText }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
