import { Sparkles } from "lucide-react";
import eduSignature from "@/assets/edu-signature.png";

export interface EduAnalysisProfile {
  client?: { name: string } | null;
  hair_type: string | null;
  porosity_level: string | null;
  damage_level: string | null;
  identified_issues: any;
  technical_explanation: string | null;
  edu_personal_response: string | null;
  professional_correction: string | null;
  validated_at: string | null;
}

interface Props {
  profile: EduAnalysisProfile;
}

// Map damage_level (textual) to a 0-100 position on the 5-segment bar.
// 1) Saudável  2) Levemente  3) Comprometido  4) Bastante  5) Severamente
function damageToHealth(level: string | null): { pct: number; label: string; segment: number } {
  const v = (level || "").toLowerCase();
  if (v.includes("saud") || v.includes("ótim") || v.includes("otim") || v.includes("nenhum")) {
    return { pct: 10, label: "SAUDÁVEL", segment: 1 };
  }
  if (v.includes("lev")) return { pct: 30, label: "LEVEMENTE COMPROMETIDO", segment: 2 };
  if (v.includes("mod") || v.includes("comprom")) return { pct: 50, label: "COMPROMETIDO", segment: 3 };
  if (v.includes("alt") || v.includes("bast") || v.includes("grave")) {
    return { pct: 70, label: "BASTANTE COMPROMETIDO", segment: 4 };
  }
  if (v.includes("sever") || v.includes("crít") || v.includes("crit") || v.includes("intens")) {
    return { pct: 90, label: "SEVERAMENTE COMPROMETIDO", segment: 5 };
  }
  return { pct: 50, label: (level || "AVALIAÇÃO INDISPONÍVEL").toUpperCase(), segment: 3 };
}

function scoreColor(score: number): string {
  if (score >= 4) return "text-emerald-400";
  if (score >= 3) return "text-amber-300";
  return "text-red-400";
}

function porosityToScore(p: string | null): { value: string; score: number } {
  const v = (p || "").toLowerCase();
  if (v.includes("baix")) return { value: "Baixa", score: 4 };
  if (v.includes("méd") || v.includes("med")) return { value: "Média", score: 3 };
  if (v.includes("alt")) return { value: "Alta", score: 2 };
  return { value: p || "—", score: 3 };
}

function damageToScore(d: string | null): { value: string; score: number } {
  const v = (d || "").toLowerCase();
  if (v.includes("saud") || v.includes("nenhum")) return { value: "Ótima", score: 5 };
  if (v.includes("lev")) return { value: "Boa", score: 4 };
  if (v.includes("mod")) return { value: "Moderada", score: 3 };
  if (v.includes("alt") || v.includes("bast")) return { value: "Comprometida", score: 2 };
  if (v.includes("sever") || v.includes("crit") || v.includes("crít")) return { value: "Crítica", score: 1 };
  return { value: d || "—", score: 3 };
}

export function EduAnalysisSummary({ profile }: Props) {
  const health = damageToHealth(profile.damage_level);
  const por = porosityToScore(profile.porosity_level);
  const dmg = damageToScore(profile.damage_level);

  // Derived metrics (qualitative) — based on porosity + damage signals
  const elasticity = { label: dmg.score >= 4 ? "Boa" : dmg.score >= 3 ? "Média" : "Reduzida", score: dmg.score };
  const shine = { label: dmg.score >= 4 ? "Alto" : dmg.score >= 3 ? "Médio" : "Opaco", score: dmg.score };
  const dryness = { label: por.score >= 4 ? "Leve" : por.score >= 3 ? "Moderado" : "Acentuado", score: 6 - por.score };
  const overall = Math.max(1, Math.round((por.score + dmg.score + elasticity.score + shine.score + (6 - dryness.score)) / 5));

  const recoverability = Math.min(10, Math.max(1, Math.round((overall / 5) * 10)));
  const recoverStatus = recoverability >= 7 ? "OK" : recoverability >= 4 ? "ATENÇÃO" : "CRÍTICO";
  const recoverColor = recoverability >= 7 ? "text-emerald-400" : recoverability >= 4 ? "text-amber-300" : "text-red-400";

  const metrics = [
    { name: "Porosidade", value: por.value, score: por.score },
    { name: "Elasticidade", value: elasticity.label, score: elasticity.score },
    { name: "Brilho", value: shine.label, score: shine.score },
    { name: "Ressecamento", value: dryness.label, score: 6 - dryness.score },
    { name: "Saúde Geral", value: dmg.value, score: dmg.score },
  ];

  return (
    <div className="rounded-xl border border-amber-600/50 bg-[#1A1A1A] text-gray-200 p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="text-center space-y-1 pb-3 border-b border-amber-600/30">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#E6A15C]">SalaoCloud</h2>
        <p className="text-xs sm:text-sm tracking-widest text-[#E6A15C]/80 uppercase">
          Análise Capilar Profissional
        </p>
        {profile.client?.name && (
          <p className="text-xs text-gray-400 pt-1">Cliente: {profile.client.name}</p>
        )}
      </div>

      {/* Bloco 1: Classificação */}
      <div className="space-y-2">
        <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-[#E6A15C] uppercase">
          Classificação:
        </p>
        <p className="text-sm sm:text-base text-gray-100 font-medium">
          {profile.hair_type || "Tipo capilar não identificado"}
        </p>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-4 gap-y-1 text-xs text-gray-400">
          <span>Porosidade: {por.value}</span>
          <span>Nível de dano: {dmg.value}</span>
          {profile.validated_at && (
            <span>Data: {new Date(profile.validated_at).toLocaleDateString("pt-BR")}</span>
          )}
        </div>
      </div>

      {/* Bloco 2: Barra de saúde */}
      <div className="space-y-2">
        <div className="text-center">
          <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-[#E6A15C] uppercase">
            Nível de Saúde Capilar ▾
          </p>
        </div>
        <div className="relative">
          <div className="flex h-3 rounded-full overflow-hidden">
            <div className="flex-1 bg-emerald-600" />
            <div className="flex-1 bg-lime-500" />
            <div className="flex-1 bg-amber-500" />
            <div className="flex-1 bg-orange-600" />
            <div className="flex-1 bg-red-700" />
          </div>
          <div
            className="absolute -top-1 h-5 w-1 bg-white rounded-full shadow-lg transition-all"
            style={{ left: `calc(${health.pct}% - 2px)` }}
            aria-label="Indicador de saúde"
          />
        </div>
        <div className="grid grid-cols-5 text-[8px] sm:text-[10px] text-gray-500 text-center">
          <span>Saudável</span>
          <span>Levemente</span>
          <span>Comprom.</span>
          <span>Bastante</span>
          <span>Severamente</span>
        </div>
        <p className="text-center text-xs sm:text-sm text-[#E6A15C] font-semibold tracking-wide">
          {health.label}
        </p>
      </div>

      {/* Bloco 3: Métricas */}
      <div className="space-y-1">
        {metrics.map((m, i) => (
          <div
            key={m.name}
            className={`flex items-center justify-between gap-2 py-2 ${
              i < metrics.length - 1 ? "border-b border-gray-800" : ""
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E6A15C] shrink-0" />
              <span className="text-xs sm:text-sm text-gray-200 truncate">{m.name}:</span>
            </div>
            <span className="text-xs sm:text-sm text-[#E6A15C] flex-1 text-center truncate">
              {m.value}
            </span>
            <span className={`text-xs sm:text-sm font-semibold ${scoreColor(m.score)}`}>
              {m.score}/5
            </span>
          </div>
        ))}
      </div>

      {/* Bloco 4: Índice de Recuperabilidade */}
      <div className="rounded-lg border border-amber-600/50 bg-[#252525] p-3 sm:p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-100">Índice de Recuperabilidade:</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {recoverability >= 7
              ? "Excelente potencial — dano leve concentrado nas pontas."
              : recoverability >= 4
              ? "Recuperação possível com cuidados consistentes."
              : "Requer plano intensivo e acompanhamento profissional."}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl sm:text-3xl font-bold text-[#E6A15C] leading-none">
            {recoverability}/10
          </p>
          <p className={`text-xs font-semibold ${recoverColor}`}>{recoverStatus}</p>
        </div>
      </div>

      {/* Bloco 5: Edu e Você (substitui Marcas Recomendadas) */}
      <div className="rounded-lg border border-amber-600/40 bg-[#1f1f1f] p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#E6A15C]" />
          <p className="text-xs sm:text-sm font-semibold tracking-widest text-[#E6A15C] uppercase">
            Edu e Você
          </p>
        </div>
        <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed">
          {profile.edu_personal_response ||
            "Sua análise foi registrada. Em breve seu profissional irá conversar com você sobre o melhor plano de cuidados personalizado."}
        </p>
        {profile.professional_correction && (
          <div className="pt-2 border-t border-gray-800">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
              Observação do profissional
            </p>
            <p className="text-xs text-gray-300 whitespace-pre-line">
              {profile.professional_correction}
            </p>
          </div>
        )}
      </div>

      {/* Assinatura do Edu */}
      <div className="flex flex-col items-end pt-2">
        <img
          src={eduSignature}
          alt="Assinatura de Edu Valentim"
          className="h-14 object-contain opacity-90 invert"
        />
        <p className="text-[10px] text-gray-500 mt-1">Edu Valentim — Consultor Capilar IA</p>
      </div>
    </div>
  );
}
