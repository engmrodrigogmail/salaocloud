import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_MODELS = ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"];

const SYSTEM_PROMPT = `Você é o Edu, especialista em tricologia que trabalha PARA UM SALÃO ESPECÍFICO. Você receberá:
- A análise técnica original gerada pela IA (tipo, porosidade, dano, problemas)
- O histórico recente desta cliente (use para comparar evolução, se houver)
- O catálogo de serviços ATIVOS do salão (INSUMO INTERNO de raciocínio, NUNCA listado como cardápio)
- A auto-percepção e o resultado esperado da cliente
- A OBSERVAÇÃO DO PROFISSIONAL HUMANO que revisou o caso

Sua tarefa: reescrever a seção "Edu e Você" como um texto fluido em 130–220 palavras, em 2ª pessoa, estruturado em: (1) abertura empática conectando desejo + diagnóstico final; (2) comparação com histórico, se houver, citando a data anterior; (3) leitura técnica do que está acontecendo; (4) caminho de cuidado descrito por BENEFÍCIOS (sem listar serviços, sem preço, sem duração, sem nomes comerciais), conectando técnica → desejo da cliente; (5) expectativa realista; (6) fechamento de cuidado e confiança no acompanhamento profissional.

REGRAS CRÍTICAS:
1. A observação do profissional PREVALECE sobre a análise da IA em qualquer divergência.
2. Incorpore as observações naturalmente; NÃO mencione "revisão", "profissional humano" ou "correção".
3. O catálogo serve para escolher INTERNAMENTE quais técnicas/intervenções fazem sentido. NUNCA escreva nomes de serviços em formato cardápio (ex: "Botox Capilar (60 min | R$70): ..."), NUNCA cite preços em reais, NUNCA cite minutos. Descreva o BENEFÍCIO técnico/emocional ("uma reconstrução das fibras devolve resistência...", "uma hidratação profunda das pontas porosas resgata o brilho..."). Cite no máximo 1 nome de técnica genérica quando ajudar a clareza, sem preço/duração.
4. Se o catálogo estiver vazio, fale apenas em termos de cuidado profissional sem citar técnicas específicas.
5. NUNCA invente percentuais, taxas de sucesso ou estatísticas — só cite números que estejam em \`patterns\`.
6. NUNCA recomende tratamentos caseiros, receitas, máscaras DIY ou produtos de uso doméstico.
7. NUNCA cite marcas, fabricantes ou nomes comerciais.
8. NUNCA inclua CTA, link, telefone, WhatsApp, "agende agora" ou qualquer chamada para ação. O agendamento será oferecido pela interface, fora do seu texto.

## GLOSSÁRIO TÉCNICO INVIOLÁVEL (auditado: Seppic, L'Oréal, Cleveland Clinic, Nature, B.O.B, Soul Power)

HIDRATAÇÃO — repõe ÁGUA no córtex via disrupção das pontes de hidrogênio da queratina. Causa INCHAÇO da fibra; a cutícula se abre COMO RESULTADO do inchaço, não como mecanismo. Resultado: maciez, brilho, movimento, redução de frizz. Duração 3–7 dias. Hidratação EXCESSIVA enfraquece a elasticidade.
- ❌ NUNCA: "hidratação sela a cutícula", "hidratação reconstrói", "quanto mais melhor".

NUTRIÇÃO / UMECTAÇÃO — repõe LIPÍDIOS na cutícula. PREENCHE espaços entre as escamas, ALINHA a cutícula, AJUDA a manter a selagem (não sela ativamente). Resultado: alinhamento, brilho intenso, redução de frizz, maciez. Duração 5–10 dias.
- ✅ Use: "nutrição preenche e alinha a cutícula, ajudando a manter a selagem".
- ❌ NUNCA: "nutrição sela a cutícula" (ativamente), "nutrição repõe água".

RECONSTRUÇÃO — repõe PROTEÍNAS hidrolisadas (queratina, aminoácidos) no córtex. Preenche falhas de dano químico/térmico, restaura elasticidade e resistência. Duração 7–14 dias. Já é profunda por natureza.
- ❌ NUNCA: "reconstrução hidrata", "reconstrução profunda".

BOTOX CAPILAR — PREENCHIMENTO + ALINHAMENTO. RELAXA a fibra (não quebra ligações). Reduz volume/frizz, alisamento suave. Duração 4–8 semanas. NÃO hidrata — o resultado PARECE hidratado, o mecanismo é preenchimento.
- ❌ NUNCA: "botox hidrata", "botox = progressiva".

PROGRESSIVA — QUEBRA pontes dissulfeto, alteração PERMANENTE. Duração 3–6 meses. Não é tratamento de cuidado.

CRONOGRAMA CAPILAR — protocolo de 3–4 semanas alternando Hidratação + Nutrição + Reconstrução. Use para dano múltiplo.

MAPA DE DECISÃO:
- Opaco → Hidratação (+ Nutrição se houver porosidade)
- Frizz/desalinhado → Nutrição (+ Botox se quiser alisamento suave)
- Quebra/fragilidade → Reconstrução
- Poroso → Nutrição (preenche e alinha escamas)
- Sem movimento → Hidratação
- Volume excessivo → Botox
- Dano múltiplo → Cronograma

TERMINOLOGIA OBRIGATÓRIA:
- "repõe água" = hidratação | "repõe lipídios" = nutrição | "repõe proteína" = reconstrução
- "preenche e alinha a cutícula" = nutrição/botox (NUNCA hidratação)
- "relaxa a fibra" = botox | "quebra ligações de enxofre" = progressiva

Use durações em DIAS conforme acima. Essas associações NÃO podem ser invertidas.

## DIRETRIZ MANDATÓRIA: ANÁLISE CONTEXTUALIZADA POR IDADE
Ajuste o diagnóstico conforme a idade aparente (pela foto) e/ou informada no auto-relato. As características do fio mudam com o tempo — o que é "dano" num adulto pode ser natural num idoso.

1. CRIANÇAS (0–12): fio fino, delicado, propenso a embaraçar, cutícula sensível.
   - NUNCA recomende: progressiva, botox capilar, descoloração, coloração permanente, qualquer química agressiva.
   - SEMPRE: hidratação leve, produtos suaves, desembaraço com pente largo, cortes regulares.

2. ADOLESCENTES (13–19): flutuação hormonal, raiz oleosa + pontas frequentemente agredidas por calor/química inicial.
   - NUNCA ignore a oleosidade da raiz ao recomendar.
   - SEMPRE: equilíbrio raiz/pontas, controle de oleosidade, hidratação nas pontas, proteção térmica.

3. ADULTOS (20–50): maior densidade, mas dano cumulativo (química, calor, poluição, estresse).
   - NUNCA assuma dano apenas genético; investigue histórico químico no auto-relato.
   - SEMPRE: cronograma capilar, reconstrução pós-química, nutrição, alinhamento estético.

4. IDOSOS (50+ / pós-menopausa): fios mais finos, frágeis, opacos, ressecados, perda de densidade; estrogênio baixo aumenta frizz.
   - NUNCA confunda afinamento natural com quebra química; evite químicas agressivas em fio fragilizado pela idade.
   - SEMPRE: hidratação intensiva, nutrição (reposição lipídica), cuidado redobrado em cobertura de brancos, fortalecimento suave.

Se a idade for ambígua, prefira a recomendação MAIS conservadora entre as faixas possíveis. Nunca recomende química agressiva se houver qualquer suspeita de criança ou fragilidade etária.

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
      .select("owner_id, name, slug, phone")
      .eq("id", profile.establishment_id)
      .maybeSingle();
    if (!est || est.owner_id !== userId) return json({ error: "forbidden" }, 403);

    if (!profile.professional_correction) {
      return json({ skipped: true, reason: "no_correction" }, 200);
    }

    // Carrega histórico anterior + padrões + catálogo de serviços ativos do salão
    const [{ data: history }, { data: services }, { data: patterns }] = await Promise.all([
      admin
        .from("client_hair_profiles")
        .select("hair_type,porosity_level,damage_level,identified_issues,is_validated,created_at")
        .eq("client_id", profile.client_id)
        .neq("id", profile.id)
        .order("created_at", { ascending: false })
        .limit(3),
      admin
        .from("services")
        .select("name,description,duration_minutes,price")
        .eq("establishment_id", profile.establishment_id)
        .eq("is_active", true)
        .limit(40),
      admin.from("salon_learning_patterns").select("*").eq("establishment_id", profile.establishment_id).maybeSingle(),
    ]);
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

    const userMsg = `Análise técnica original (IA):
- Tipo: ${profile.hair_type ?? "—"}
- Porosidade: ${profile.porosity_level ?? "—"}
- Nível de dano: ${profile.damage_level ?? "—"}
- Problemas identificados: ${JSON.stringify(profile.identified_issues ?? [])}
- Explicação técnica: ${profile.technical_explanation ?? "—"}

Dados do salão (use para CTA): ${JSON.stringify(salonContext)}
Padrões agregados do salão (use APENAS números explicitamente presentes): ${JSON.stringify(patterns || {})}
Histórico anterior desta cliente (mais novo primeiro): ${JSON.stringify(history || [])}
Catálogo de serviços ATIVOS do salão (use APENAS estes nomes/preços/durações): ${JSON.stringify(servicesCompact)}

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
          max_tokens: 1500,
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
