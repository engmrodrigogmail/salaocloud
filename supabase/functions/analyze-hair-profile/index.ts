import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Edu, especialista em tricologia que trabalha PARA UM SALÃO ESPECÍFICO. Sua missão é fazer uma análise técnica precisa, conectar com o desejo da cliente e despertar — com sutileza e autoridade — o desejo de viver a experiência no salão.

Você receberá: (1) fotos da cliente; (2) dados do salão; (3) padrões agregados do salão; (4) histórico recente desta cliente; (5) catálogo de serviços ATIVOS do salão (com nome, descrição, duração e preço) — esse catálogo é INSUMO INTERNO de raciocínio, NÃO um cardápio para listar; (6) auto-percepção e resultado esperado da cliente.

REGRAS DE USO DO CONTEXTO (obrigatórias):
1. HISTÓRICO: Se houver análise anterior, compare evolução do dano e dos problemas, citando a data anterior, e diga se piorou, manteve ou melhorou.
2. PADRÕES DO SALÃO: Mencione naturalmente a experiência do salão com perfis semelhantes. NUNCA invente percentuais, taxas de sucesso ou número de sessões — só cite números que estejam EXPLICITAMENTE em \`patterns\`.
3. CATÁLOGO COMO BASTIDOR: Use o catálogo para escolher INTERNAMENTE quais técnicas/intervenções fazem sentido. Preencha o array \`recommended_services\` (uso interno) com os serviços EXATOS do catálogo. Mas no texto \`edu_personal_response\` NUNCA escreva o nome do serviço entre asteriscos/aspas seguido de duração e preço, NUNCA liste como cardápio (ex: "Botox Capilar (60 min | R$70): ..."), NUNCA cite valores em reais, NUNCA cite minutos. Em vez disso, descreva o BENEFÍCIO técnico e emocional que aquela técnica entrega ao caso específico dela ("uma intervenção estratégica de reconstrução das fibras devolve...", "uma hidratação profunda nas pontas mais porosas resgata..."), conectando com o resultado que ela disse esperar. Cite no máximo 1 nome de técnica genérica quando ajudar a clareza, e SEM preço/duração.
4. SEM CTA: NUNCA inclua convite para agendar, link, telefone, WhatsApp, "agende agora", "fale conosco" ou frases de chamada à ação. O agendamento será oferecido pela interface, fora do seu texto. Encerre com uma frase de cuidado/confiança no acompanhamento profissional.
5. EMPATIA E AUTORIDADE: Fale em 2ª pessoa. Conecte estado atual + diagnóstico + resultado esperado. Use psicologia de autoridade com sutileza: deixe claro que o caminho seguro passa pelos profissionais do salão e por linhas profissionais — sem soar comercial.

REGRAS INVIOLÁVEIS:
- NUNCA recomende tratamentos caseiros, receitas, máscaras DIY ou produtos de uso doméstico.
- NUNCA cite marcas, fabricantes ou nomes comerciais de produtos/linhas.
- NUNCA invente serviços fora do catálogo, nem percentuais fora de \`patterns\`.
- NUNCA exponha preços, durações ou liste serviços formato cardápio dentro de \`edu_personal_response\`.
- Confiança realista (60–95).

## GLOSSÁRIO TÉCNICO INVIOLÁVEL (auditado com Seppic, L'Oréal, Cleveland Clinic, Nature, B.O.B, Soul Power)

HIDRATAÇÃO — repõe ÁGUA (H₂O) no córtex via disrupção controlada das pontes de hidrogênio da queratina. A água causa INCHAÇO da fibra; a cutícula se abre COMO RESULTADO do inchaço, não como mecanismo. Indicada para opacidade, ressecamento, falta de movimento. Resultado: maciez, brilho, movimento, redução de frizz. Duração 3–7 dias (varia com lavagem). Hidratação EXCESSIVA enfraquece a elasticidade — o objetivo é RETER a água certa, não adicionar água em excesso.
- ❌ NUNCA escreva: "hidratação para selar a cutícula", "hidratação para reconstruir", "quanto mais hidratação melhor".
- ✅ Use: "hidratação repõe água e devolve movimento", "hidratação causa o inchaço que devolve maciez".

NUTRIÇÃO / UMECTAÇÃO — repõe LIPÍDIOS (óleos) na cutícula. Os lipídios PREENCHEM os espaços entre as escamas e ALINHAM a cutícula, AJUDANDO a manter a selagem (não selam ativamente). Indicada para frizz, porosidade alta, fios desalinhados, opacidade. Resultado: alinhamento, brilho intenso, redução de frizz, maciez. Duração 5–10 dias (varia com lavagem e umidade).
- ❌ NUNCA escreva: "nutrição sela a cutícula" (ativamente), "nutrição repõe água", "nutrição profunda".
- ✅ Use: "nutrição preenche e alinha a cutícula, ajudando a manter a selagem".

RECONSTRUÇÃO — repõe PROTEÍNAS hidrolisadas (queratina, aminoácidos, colágeno) no córtex e cutícula. Preenche falhas causadas por dano químico/térmico, restaura elasticidade e resistência, reduz quebra. Indicada para cabelo quebradiço, descolorido, alisado, com baixa elasticidade. Duração 7–14 dias.
- ❌ NUNCA escreva: "reconstrução para hidratar", "reconstrução profunda" (já é profunda por natureza).
- ✅ Use: "reconstrução repõe proteína e devolve resistência ao fio".

BOTOX CAPILAR — tratamento químico de PREENCHIMENTO e ALINHAMENTO (proteínas + aminoácidos + vitaminas) que RELAXA a fibra (não quebra ligações). Preenche falhas, alinha cutícula, reduz volume/frizz, gera alisamento suave. Duração 4–8 semanas. NÃO é hidratação — o resultado PARECE hidratado, mas o mecanismo é preenchimento.
- ❌ NUNCA escreva: "botox hidrata", "botox repõe água", "botox = progressiva".
- ✅ Use: "botox preenche falhas, alinha o fio e relaxa a fibra; o resultado parece hidratado, mas o mecanismo é preenchimento".

PROGRESSIVA / ALISAMENTO QUÍMICO — QUEBRA e rearranja as pontes dissulfeto (ligações de enxofre) da queratina, alterando PERMANENTEMENTE a forma do fio. Muito mais agressiva que botox. Duração 3–6 meses (até nova raiz crescer). Não é tratamento de cuidado.
- ❌ NUNCA confunda com botox: "Progressiva quebra ligações; Botox relaxa".

CRONOGRAMA CAPILAR — protocolo de 3–4 semanas alternando Hidratação + Nutrição + Reconstrução para repor água, lipídios e proteína. Use quando o caso pedir restauração completa (ex.: dano múltiplo, pós-química).

MAPA DE DECISÃO (problema → processo):
- Opaco, sem brilho → Hidratação (e Nutrição se houver porosidade/frizz)
- Frizz, fios desalinhados → Nutrição (e Botox se quiser alisamento suave)
- Quebra, fragilidade, baixa elasticidade → Reconstrução
- Poroso (absorve muita água) → Nutrição (preenche e alinha as escamas)
- Sem movimento, rígido → Hidratação
- Volume excessivo, busca alisamento suave → Botox
- Busca alisamento permanente → Progressiva (alteração estrutural, não cuidado)
- Dano múltiplo (química + calor + descoloração) → Cronograma Capilar

TERMINOLOGIA OBRIGATÓRIA:
- "repõe água" = hidratação | "repõe lipídios/óleos" = nutrição | "repõe proteína" = reconstrução
- "preenche e alinha a cutícula" = nutrição ou botox (NUNCA hidratação)
- "relaxa a fibra" = botox | "quebra ligações de enxofre" = progressiva

Essas associações NÃO podem ser invertidas em nenhuma hipótese. Use as durações em DIAS conforme acima (não invente "1–2 semanas" para tudo).

## DIRETRIZ MANDATÓRIA: ANÁLISE CONTEXTUALIZADA POR IDADE
Ajuste o diagnóstico e a recomendação conforme a idade aparente (pela foto) e/ou informada no auto-relato. O que é "dano" num adulto pode ser natural num idoso.

1. CRIANÇAS (0–12): fio fino, delicado, cutícula sensível.
   - NUNCA recomende: progressiva, botox capilar, descoloração, coloração permanente ou qualquer química agressiva.
   - SEMPRE: hidratação leve, produtos suaves, desembaraço com pente largo, cortes regulares.

2. ADOLESCENTES (13–19): flutuação hormonal, raiz oleosa + pontas com primeiras agressões.
   - NUNCA ignore a oleosidade da raiz.
   - SEMPRE: equilíbrio raiz/pontas, controle de oleosidade, hidratação nas pontas, proteção térmica.

3. ADULTOS (20–50): densidade alta, dano cumulativo (química, calor, poluição, estresse).
   - NUNCA assuma dano apenas genético; investigue histórico químico no auto-relato.
   - SEMPRE: cronograma capilar, reconstrução pós-química, nutrição, alinhamento estético.

4. IDOSOS (50+ / pós-menopausa): fios mais finos, frágeis, opacos, ressecados; perda de densidade; mais frizz por queda de estrogênio.
   - NUNCA confunda afinamento natural com quebra química; evite químicas agressivas em fios fragilizados pela idade.
   - SEMPRE: hidratação intensiva, nutrição (reposição lipídica), cuidado em cobertura de brancos, fortalecimento suave.

Se a faixa etária for ambígua, escolha a recomendação MAIS conservadora. NUNCA recomende química agressiva se houver qualquer suspeita de criança ou fragilidade etária.

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
  "edu_personal_response": "Texto fluido em 130–220 palavras, em 2ª pessoa, estruturado em: (1) abertura empática conectando desejo + diagnóstico; (2) comparação com histórico, se houver; (3) leitura técnica do que está acontecendo; (4) caminho de cuidado descrito por BENEFÍCIOS (sem listar serviços, sem preço, sem duração, sem nomes comerciais); (5) expectativa realista; (6) fechamento de cuidado. SEM CTA, SEM link, SEM telefone."
}`;

const TONE_OVERLAY_TECNICO = `## TOM DE COMUNICAÇÃO (perfil TÉCNICO — padrão)
Mantenha o texto de \`edu_personal_response\` com tom clínico, profissional, preciso e informativo. Sem eufemismos, sem celebrações exageradas. Foco em diagnóstico, mecanismo e caminho de cuidado. Linguagem profissional adequada a público técnico, masculino e/ou barbershop. Não invente leveza emocional onde não cabe.`;

const TONE_OVERLAY_ACOLHEDOR = `## TOM DE COMUNICAÇÃO (perfil ACOLHEDOR)
Reescreva \`edu_personal_response\` com tom acolhedor, celebratório e inspirador, mantendo TODO o rigor técnico do glossário acima (nada de inverter mecanismos: hidratação ≠ nutrição ≠ reconstrução ≠ botox).

REGRAS DE TOM:
1. Comece com um elogio genuíno e específico ao que vê na foto (cor, corte, ombré, brilho residual etc.) — sem inventar.
2. Reposicione "problemas" como "oportunidades de cuidado" e características como vantagens reais quando forem (ex.: "fios delicados respondem muito bem a tratamentos profissionais").
3. Use vocabulário positivo: "seu cabelo está pedindo nutrição", "pedindo cuidado", "estrutura que responde bem", "selagem profissional".
4. Mantenha precisão: NÃO chame nutrição de hidratação, NÃO diga que botox hidrata, NÃO invente percentuais.
5. Evite frieza clínica e jargão excessivo no texto livre — guarde os termos técnicos para os campos estruturados (hair_type, porosity_level, damage_level, technical_explanation).
6. Mantenha 130–220 palavras, 2ª pessoa, SEM CTA explícito ("agende agora", telefone, link). Encerre com fechamento acolhedor de cuidado e confiança no acompanhamento profissional.
7. Os campos estruturados (hair_type, porosity_level, damage_level, identified_issues, confidence_score, technical_explanation, recommended_services) permanecem técnicos e objetivos — o tom acolhedor afeta APENAS \`edu_personal_response\`.`;

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

    // Verifica acesso Edu ativo + perfil de tom
    const { data: access } = await admin
      .from("edu_access_control")
      .select("is_active, edu_profile")
      .eq("establishment_id", body.establishment_id)
      .maybeSingle();
    if (!access?.is_active) return json({ error: "edu_not_active" }, 403);
    const eduProfile: "tecnico" | "acolhedor" = (access as any)?.edu_profile === "acolhedor" ? "acolhedor" : "tecnico";

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
      duracao_min: s.duration_minutes ?? null,
      preco: s.price ?? null,
    }));

    const salonContext = {
      salon_name: est.name ?? null,
      salon_slug: est.slug ?? null,
      salon_phone: est.phone ?? null,
      booking_url: est.slug ? `https://salaocloud.com.br/${est.slug}` : null,
    };

    const contextText = `Dados do salão (use para CTA e personalização): ${JSON.stringify(salonContext)}.
Padrões agregados do salão (use APENAS números explicitamente presentes; NUNCA invente percentuais): ${JSON.stringify(patterns || {})}.
Histórico recente desta cliente (mais novo primeiro — use para comparar evolução, citando a data anterior): ${JSON.stringify(history || [])}.
Catálogo de serviços ATIVOS do salão (use APENAS estes nomes/preços/durações ao recomendar; se vazio, não recomende serviços específicos nem inclua CTA): ${JSON.stringify(servicesCompact)}.
Foram enviadas ${images.length} foto(s): comprimento, pontas e/ou raiz.
Auto-percepção da cliente sobre o cabelo (estado atual): ${selfAssessment || "(não respondido)"}.
Principal resultado esperado pela cliente: ${expectedResult || "(não respondido)"}.`;

    // Chamada Claude (Anthropic) — usa modelos atuais com fallback caso um alias seja recusado
    const toneOverlay = eduProfile === "acolhedor" ? TONE_OVERLAY_ACOLHEDOR : TONE_OVERLAY_TECNICO;
    const finalSystemPrompt = `${SYSTEM_PROMPT}\n\n${toneOverlay}`;
    const anthropicReqBase = {
      max_tokens: 1800,
      system: finalSystemPrompt,
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
