import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Edu, especialista em tricologia que trabalha PARA UM SALÃO ESPECÍFICO. Seu objetivo é ANALISAR + RECOMENDAR + CONVERTER (agendamento).

Você receberá: (1) fotos da cliente; (2) dados do salão (nome, slug, telefone, URL de agendamento); (3) padrões agregados do salão; (4) histórico recente desta cliente; (5) catálogo de serviços ATIVOS do salão (com nome, descrição, duração e preço); (6) auto-percepção e resultado esperado.

REGRAS DE USO DO CONTEXTO (obrigatórias):
1. HISTÓRICO: Se houver análise anterior, COMPARE evolução do dano e dos problemas. Cite a data anterior e diga se piorou, manteve ou melhorou.
2. PADRÕES DO SALÃO: Mencione naturalmente a experiência do salão com perfis semelhantes. NUNCA invente percentuais, taxas de sucesso, número de sessões médias ou estatísticas — só cite números que estejam EXPLICITAMENTE em \`patterns\`.
3. CATÁLOGO: Recomende um protocolo de 1 a 3 etapas usando APENAS nomes de serviços que existem no catálogo recebido. Inclua duração e preço EXATOS do catálogo. Se o catálogo estiver vazio, NÃO recomende serviços específicos — oriente consulta presencial.
4. CTA: Se houver \`booking_url\`, finalize com convite para agendar (link). Se houver \`salon_phone\`, ofereça também o WhatsApp do salão.
5. EMPATIA: Conecte estado atual + resultado esperado da cliente com o diagnóstico final, em 2ª pessoa.

REGRAS INVIOLÁVEIS:
- NUNCA recomende tratamentos caseiros, receitas, máscaras DIY ou produtos de uso doméstico.
- NUNCA cite marcas, fabricantes ou nomes comerciais de produtos/linhas.
- NUNCA invente serviços que não estão no catálogo, nem percentuais que não estão em \`patterns\`.
- Reforce que o protocolo será personalizado pelos profissionais do salão e que produtos de linhas profissionais serão essenciais.
- Glossário técnico correto (ex: hidratação ≠ botox ≠ reconstrução).
- Confiança realista (60–95).

Retorne APENAS um JSON válido (sem markdown), com a estrutura:
{
  "hair_type": "ex: 3B",
  "porosity_level": "baixa|media|alta",
  "damage_level": "leve|moderado|severo",
  "identified_issues": ["ex: quebra química", "ex: ressecamento"],
  "confidence_score": 85.5,
  "technical_explanation": "Explicação técnica curta",
  "history_comparison": "1-2 frases comparando com a análise anterior. Se não houver histórico, string vazia.",
  "recommended_services": [
    { "name": "Nome exato do serviço do catálogo", "benefit": "Para que serve no caso dela", "duration_minutes": 60, "price": 150 }
  ],
  "edu_personal_response": "Resposta final em 150–250 palavras estruturada em: (1) abertura empática conectando desejo + diagnóstico; (2) comparação com histórico, se houver; (3) padrões do salão, se houver; (4) protocolo recomendado listando os serviços com duração e preço; (5) expectativa de resultado realista; (6) CTA de agendamento com o link e/ou WhatsApp do salão. Se o catálogo estiver vazio, omitir o protocolo e o CTA e orientar consulta presencial."
}`;

const ANTHROPIC_MODELS = ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"];
const MAX_CLAUDE_IMAGE_BASE64_BYTES = 5 * 1024 * 1024;

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
      .select("id, owner_id, name, slug, phone")
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
      if (b64.length > MAX_CLAUDE_IMAGE_BASE64_BYTES) {
        return json(
          {
            error: "photo_too_large",
            user_message: "Uma das fotos ficou grande demais para análise. Remova e envie a foto novamente.",
          },
          413,
        );
      }
      images.push({ mime: file.type || "image/jpeg", b64 });
    }

    // Contexto: padrões agregados do salão + histórico do cliente + catálogo de serviços ativos
    const [{ data: patterns }, { data: history }, { data: services }] = await Promise.all([
      admin.from("salon_learning_patterns").select("*").eq("establishment_id", body.establishment_id).maybeSingle(),
      admin
        .from("client_hair_profiles")
        .select("hair_type,porosity_level,damage_level,identified_issues,professional_correction,is_validated,created_at")
        .eq("client_id", body.client_id)
        .order("created_at", { ascending: false })
        .limit(3),
      admin
        .from("services")
        .select("name,description,duration_minutes,price")
        .eq("establishment_id", body.establishment_id)
        .eq("is_active", true)
        .limit(40),
    ]);

    const selfAssessment = (body.client_self_assessment || "").toString().slice(0, 2000).trim();
    const expectedResult = (body.client_expected_result || "").toString().slice(0, 2000).trim();

    const servicesCompact = (services || []).map((s: any) => ({
      nome: s.name,
      descricao: (s.description || "").toString().slice(0, 160),
    }));

    const contextText = `Padrões agregados do salão (use para citar experiência com perfis semelhantes, sem inventar números): ${JSON.stringify(patterns || {})}.
Histórico recente desta cliente (mais novo primeiro — use para comparar evolução): ${JSON.stringify(history || [])}.
Catálogo de serviços ATIVOS do salão (use APENAS estes nomes ao recomendar; se vazio, não recomende serviços específicos): ${JSON.stringify(servicesCompact)}.
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
      for (let attempt = 1; attempt <= 2; attempt++) {
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
        const retryableOverload =
          claudeRes.status === 529 ||
          claudeRes.status === 503 ||
          lower.includes("overloaded") ||
          lower.includes("temporarily unavailable");
        console.error("Claude error", claudeRes.status, model, `attempt ${attempt}`, lastErrText);
        if (retryableOverload && attempt < 2) {
          await delay(900 * attempt);
          continue;
        }
        if (modelNotFound || retryableOverload) {
          await delay(650);
          break;
        }
        break;
      }
      if (claudeRes?.ok) break;
      const lower = lastErrText.toLowerCase();
      const shouldTryNextModel =
        (claudeRes?.status === 404 && lower.includes("model")) ||
        claudeRes?.status === 529 ||
        claudeRes?.status === 503 ||
        lower.includes("overloaded") ||
        lower.includes("temporarily unavailable");
      if (!shouldTryNextModel) break;
    }

    if (!claudeRes?.ok) {
      const errText = lastErrText || "Claude request failed without response body";
      const statusCode = claudeRes?.status ?? 502;
      console.error("Claude final error", statusCode, attemptedModel, errText);

      // Detecta problemas de crédito/cota da Anthropic e notifica super admins
      const lower = errText.toLowerCase();
      const isCredit =
        statusCode === 402 ||
        statusCode === 429 ||
        lower.includes("credit balance") ||
        lower.includes("insufficient") ||
        lower.includes("quota") ||
        lower.includes("rate limit");
      const isImageTooLarge = lower.includes("image exceeds 5 mb") || lower.includes("base64: image exceeds");
      const isOverloaded = statusCode === 529 || lower.includes("overloaded") || lower.includes("temporarily unavailable");

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
          `Salão: ${estInfo?.name ?? body.establishment_id} • Status ${statusCode}. ` +
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
              status: statusCode,
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
            isImageTooLarge
              ? "Uma das fotos ficou grande demais para análise. Remova e envie a foto novamente."
              : isOverloaded
                ? "A IA usada pelo Edu está sobrecarregada agora. Tente novamente em alguns instantes."
                : "A IA usada pelo Edu está enfrentando instabilidades. Tente novamente mais tarde.",
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
