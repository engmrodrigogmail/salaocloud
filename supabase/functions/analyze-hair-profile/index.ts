import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Edu, um especialista em tricologia e análise capilar avançada.
Analise as 3 fotos fornecidas (comprimento, pontas e raiz), o contexto histórico do salão e, quando houver, a auto-percepção da cliente e o resultado esperado por ela.
Retorne APENAS um JSON válido com a seguinte estrutura, sem markdown ou texto adicional:
{
  "hair_type": "ex: 3B",
  "porosity_level": "baixa|media|alta",
  "damage_level": "leve|moderado|severo",
  "identified_issues": ["ex: quebra química", "ex: ressecamento"],
  "confidence_score": 85.5,
  "technical_explanation": "Explicação técnica curta",
  "edu_personal_response": "Seção 'Edu e você': resposta empática e personalizada (3 a 6 frases) conectando o que a cliente relatou (estado atual + resultado esperado) com o diagnóstico técnico, com orientações práticas. Se a cliente não respondeu, retorne string vazia."
}`;

const ANTHROPIC_MODELS = ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"];

interface AnalyzeBody {
  client_id: string;
  establishment_id: string;
  photo_paths: string[]; // [comprimento, pontas, raiz] em temp-analysis
  client_self_assessment?: string | null;
  client_expected_result?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
    if (!CLAUDE_API_KEY) return json({ error: "CLAUDE_API_KEY missing" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "invalid_token" }, 401);
    const userId = userData.user.id;

    const body = (await req.json()) as AnalyzeBody;
    if (!body.client_id || !body.establishment_id || !Array.isArray(body.photo_paths) || body.photo_paths.length < 1) {
      return json({ error: "invalid_payload" }, 400);
    }

    // Verifica que o usuário é dono do estabelecimento
    const { data: est } = await admin
      .from("establishments")
      .select("id, owner_id")
      .eq("id", body.establishment_id)
      .maybeSingle();
    if (!est || est.owner_id !== userId) return json({ error: "forbidden" }, 403);

    // Verifica acesso Edu ativo
    const { data: access } = await admin
      .from("edu_access_control")
      .select("is_active")
      .eq("establishment_id", body.establishment_id)
      .maybeSingle();
    if (!access?.is_active) return json({ error: "edu_not_active" }, 403);

    // Baixa as fotos do bucket privado e converte para base64
    const images: { mime: string; b64: string }[] = [];
    for (const path of body.photo_paths.slice(0, 3)) {
      const { data: file, error: dlErr } = await admin.storage.from("temp-analysis").download(path);
      if (dlErr || !file) {
        console.error("download error", path, dlErr);
        return json({ error: "photo_download_failed", path }, 500);
      }
      const buf = await file.arrayBuffer();
      const b64 = base64Encode(new Uint8Array(buf));
      images.push({ mime: file.type || "image/jpeg", b64 });
    }

    // Contexto: padrões agregados do salão + histórico do cliente
    const [{ data: patterns }, { data: history }] = await Promise.all([
      admin.from("salon_learning_patterns").select("*").eq("establishment_id", body.establishment_id).maybeSingle(),
      admin
        .from("client_hair_profiles")
        .select("hair_type,porosity_level,damage_level,identified_issues,professional_correction,is_validated,created_at")
        .eq("client_id", body.client_id)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const selfAssessment = (body.client_self_assessment || "").toString().slice(0, 2000).trim();
    const expectedResult = (body.client_expected_result || "").toString().slice(0, 2000).trim();

    const contextText = `Contexto do salão (padrões agregados): ${JSON.stringify(patterns || {})}.
Histórico recente da cliente: ${JSON.stringify(history || [])}.
Foram enviadas ${images.length} foto(s): comprimento, pontas e/ou raiz.
Auto-percepção da cliente sobre o cabelo (estado atual): ${selfAssessment || "(não respondido)"}.
Principal resultado esperado pela cliente: ${expectedResult || "(não respondido)"}.`;

    // Chamada Claude (Anthropic) — usa modelos atuais com fallback caso um alias seja recusado
    const anthropicReqBase = {
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image",
              source: { type: "base64", media_type: img.mime, data: img.b64 },
            })),
            { type: "text", text: contextText },
          ],
        },
      ],
    };

    let claudeRes: Response | null = null;
    let lastErrText = "";
    let attemptedModel = ANTHROPIC_MODELS[0];

    for (const model of ANTHROPIC_MODELS) {
      attemptedModel = model;
      claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ ...anthropicReqBase, model }),
      });

      if (claudeRes.ok) break;

      lastErrText = await claudeRes.text();
      const lower = lastErrText.toLowerCase();
      const modelNotFound = claudeRes.status === 404 && lower.includes("model");
      console.error("Claude error", claudeRes.status, model, lastErrText);
      if (!modelNotFound) break;
    }

    if (!claudeRes?.ok) {
      const errText = lastErrText || "Claude request failed without response body";
      console.error("Claude final error", claudeRes?.status, attemptedModel, errText);

      // Detecta problemas de crédito/cota da Anthropic e notifica super admins
      const lower = errText.toLowerCase();
      const isCredit =
        claudeRes.status === 402 ||
        claudeRes.status === 429 ||
        lower.includes("credit balance") ||
        lower.includes("insufficient") ||
        lower.includes("quota") ||
        lower.includes("rate limit");

      try {
        const { data: estInfo } = await admin
          .from("establishments")
          .select("name, slug")
          .eq("id", body.establishment_id)
          .maybeSingle();

        const { data: admins } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin");

        const title = isCredit
          ? "⚠️ Edu IA: créditos esgotados (Anthropic)"
          : "⚠️ Edu IA: erro na API Claude";
        const bodyMsg =
          `Salão: ${estInfo?.name ?? body.establishment_id} • Status ${claudeRes.status}. ` +
          `Detalhe: ${errText.slice(0, 400)}`;

        for (const a of admins ?? []) {
          await admin.from("notifications").insert({
            sender_type: "system",
            recipient_type: "admin",
            recipient_id: a.user_id,
            title,
            body: bodyMsg,
            link: "/admin/edu",
            data: {
              category: "edu_ai_failure",
              establishment_id: body.establishment_id,
              establishment_slug: estInfo?.slug ?? null,
              status: claudeRes?.status ?? null,
              model: attemptedModel,
              detail: errText.slice(0, 1000),
              is_credit_issue: isCredit,
            },
          });
        }
      } catch (notifyErr) {
        console.error("notify super admins failed", notifyErr);
      }

      return json(
        {
          error: "claude_error",
          status: claudeRes?.status ?? 502,
          user_message:
            "A IA usada pelo Edu está enfrentando instabilidades. Tente novamente mais tarde.",
          detail: errText,
        },
        502,
      );
    }

    const claudeData = await claudeRes.json();
    const rawText: string = claudeData?.content?.[0]?.text ?? "";

    // Tenta parsear JSON (remove cercas se vier markdown)
    let parsed: any = null;
    try {
      const cleaned = rawText.replace(/```json\s*|\s*```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON parse error", rawText);
      return json({ error: "ai_parse_failed", raw: rawText }, 502);
    }

    // Gera signed URLs (24h) para o profissional revisar as fotos no painel
    const signedUrls: string[] = [];
    for (const path of body.photo_paths) {
      const { data: signed } = await admin.storage.from("temp-analysis").createSignedUrl(path, 60 * 60 * 24);
      if (signed?.signedUrl) signedUrls.push(signed.signedUrl);
    }

    const { data: profile, error: insErr } = await admin
      .from("client_hair_profiles")
      .insert({
        client_id: body.client_id,
        establishment_id: body.establishment_id,
        photo_urls: signedUrls,
        photo_paths: body.photo_paths,
        ai_diagnosis: parsed,
        hair_type: parsed.hair_type ?? null,
        porosity_level: parsed.porosity_level ?? null,
        damage_level: parsed.damage_level ?? null,
        identified_issues: parsed.identified_issues ?? [],
        technical_explanation: parsed.technical_explanation ?? null,
        confidence_score: typeof parsed.confidence_score === "number" ? parsed.confidence_score : null,
        client_self_assessment: selfAssessment || null,
        client_expected_result: expectedResult || null,
        edu_personal_response: typeof parsed.edu_personal_response === "string" ? parsed.edu_personal_response : null,
      })
      .select()
      .single();

    if (insErr) {
      console.error("insert error", insErr);
      return json({ error: "insert_failed", detail: insErr.message }, 500);
    }

    // Atualiza contadores agregados
    await admin.rpc; // noop placeholder
    await admin
      .from("salon_learning_patterns")
      .upsert(
        {
          establishment_id: body.establishment_id,
          total_analyses: ((patterns?.total_analyses as number) ?? 0) + 1,
        },
        { onConflict: "establishment_id" },
      );

    return json({ success: true, profile }, 200);
  } catch (e) {
    console.error("analyze-hair-profile error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
