import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { toast } from "sonner";
import eduSignature from "@/assets/edu-signature.png";
import { salonInlineReference } from "@/lib/salonReference";
import type { EduAnalysisProfile } from "./EduAnalysisSummary";

interface Props {
  profile: EduAnalysisProfile;
  establishmentName?: string | null;
  slug?: string | null;
  fileName?: string;
}

// ---- Local helpers (mirroring EduAnalysisSummary) ----
function damageToHealth(level: string | null) {
  const v = (level || "").toLowerCase();
  if (v.includes("saud") || v.includes("ótim") || v.includes("otim") || v.includes("nenhum"))
    return { pct: 10, label: "SAUDÁVEL", segment: 1 };
  if (v.includes("lev")) return { pct: 30, label: "LEVEMENTE COMPROMETIDO", segment: 2 };
  if (v.includes("mod") || v.includes("comprom")) return { pct: 50, label: "COMPROMETIDO", segment: 3 };
  if (v.includes("alt") || v.includes("bast") || v.includes("grave"))
    return { pct: 70, label: "BASTANTE COMPROMETIDO", segment: 4 };
  if (v.includes("sever") || v.includes("crít") || v.includes("crit") || v.includes("intens"))
    return { pct: 90, label: "SEVERAMENTE COMPROMETIDO", segment: 5 };
  return { pct: 50, label: (level || "AVALIAÇÃO INDISPONÍVEL").toUpperCase(), segment: 3 };
}
function porosityToScore(p: string | null) {
  const v = (p || "").toLowerCase();
  if (v.includes("baix")) return { value: "Baixa", score: 4 };
  if (v.includes("méd") || v.includes("med")) return { value: "Média", score: 3 };
  if (v.includes("alt")) return { value: "Alta", score: 2 };
  return { value: p || "—", score: 3 };
}
function damageToScore(d: string | null) {
  const v = (d || "").toLowerCase();
  if (v.includes("saud") || v.includes("nenhum")) return { value: "Ótima", score: 5 };
  if (v.includes("lev")) return { value: "Boa", score: 4 };
  if (v.includes("mod")) return { value: "Moderada", score: 3 };
  if (v.includes("alt") || v.includes("bast")) return { value: "Comprometida", score: 2 };
  if (v.includes("sever") || v.includes("crit") || v.includes("crít")) return { value: "Crítica", score: 1 };
  return { value: d || "—", score: 3 };
}

async function loadImageAsDataURL(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function ShareSummaryButton({ profile, establishmentName, slug, fileName = "analise-capilar.pdf" }: Props) {
  const [loading, setLoading] = useState(false);

  async function buildPdf(): Promise<Blob> {
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "p" });
    const PW = 210;
    const PH = 297;
    const M = 14;
    const W = PW - M * 2;

    // Brand colors
    const AMBER: [number, number, number] = [230, 161, 92];
    const AMBER_DARK: [number, number, number] = [160, 100, 40];
    const TEXT: [number, number, number] = [40, 40, 45];
    const MUTED: [number, number, number] = [120, 120, 130];
    const SUBTLE_BG: [number, number, number] = [250, 245, 238];
    const BORDER: [number, number, number] = [230, 215, 195];

    // Header band
    pdf.setFillColor(...AMBER);
    pdf.rect(0, 0, PW, 22, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("Salão Cloud", M, 11);
    if (establishmentName) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(establishmentName, M, 17);
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("ANÁLISE CAPILAR POR IA", PW - M, 13, { align: "right" });
    if (profile.validated_at) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(new Date(profile.validated_at).toLocaleDateString("pt-BR"), PW - M, 18, { align: "right" });
    }

    let y = 30;
    pdf.setTextColor(...TEXT);

    // Client name
    if (profile.client?.name) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text(`Cliente: ${profile.client.name}`, M, y);
      y += 7;
    }

    const health = damageToHealth(profile.damage_level);
    const por = porosityToScore(profile.porosity_level);
    const dmg = damageToScore(profile.damage_level);
    const elasticity = { label: dmg.score >= 4 ? "Boa" : dmg.score >= 3 ? "Média" : "Reduzida", score: dmg.score };
    const shine = { label: dmg.score >= 4 ? "Alto" : dmg.score >= 3 ? "Médio" : "Opaco", score: dmg.score };
    const dryness = { label: por.score >= 4 ? "Leve" : por.score >= 3 ? "Moderado" : "Acentuado", score: 6 - por.score };
    const overall = Math.max(1, Math.round((por.score + dmg.score + elasticity.score + shine.score + (6 - dryness.score)) / 5));
    const recoverability = Math.min(10, Math.max(1, Math.round((overall / 5) * 10)));
    const recoverStatus = recoverability >= 7 ? "OK" : recoverability >= 4 ? "ATENÇÃO" : "CRÍTICO";

    // Section: Classificação
    const sectionTitle = (label: string) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...AMBER_DARK);
      pdf.text(label.toUpperCase(), M, y);
      pdf.setDrawColor(...AMBER);
      pdf.setLineWidth(0.3);
      pdf.line(M, y + 1.2, PW - M, y + 1.2);
      y += 5;
      pdf.setTextColor(...TEXT);
    };

    sectionTitle("Classificação");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(profile.hair_type || "Tipo capilar não identificado", M, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text(`Porosidade: ${por.value}    •    Nível de dano: ${dmg.value}`, M, y);
    y += 7;
    pdf.setTextColor(...TEXT);

    // Section: Saúde Capilar (5-segment bar)
    sectionTitle("Nível de Saúde Capilar");
    const barY = y;
    const barH = 4;
    const segW = W / 5;
    const segs: [number, number, number][] = [
      [16, 185, 129],
      [132, 204, 22],
      [245, 158, 11],
      [234, 88, 12],
      [185, 28, 28],
    ];
    segs.forEach((c, i) => {
      pdf.setFillColor(...c);
      pdf.rect(M + i * segW, barY, segW, barH, "F");
    });
    // Indicator
    const indX = M + (W * health.pct) / 100;
    pdf.setFillColor(20, 20, 20);
    pdf.triangle(indX - 1.5, barY - 1.2, indX + 1.5, barY - 1.2, indX, barY + 0.5, "F");
    // Labels
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    ["Saudável", "Levemente", "Comprom.", "Bastante", "Severamente"].forEach((l, i) => {
      pdf.text(l, M + i * segW + segW / 2, barY + barH + 3, { align: "center" });
    });
    y = barY + barH + 6;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...AMBER_DARK);
    pdf.text(health.label, PW / 2, y, { align: "center" });
    y += 6;
    pdf.setTextColor(...TEXT);

    // Section: Métricas (compact rows with score bars)
    sectionTitle("Métricas");
    const metrics = [
      { name: "Porosidade", value: por.value, score: por.score },
      { name: "Elasticidade", value: elasticity.label, score: elasticity.score },
      { name: "Brilho", value: shine.label, score: shine.score },
      { name: "Ressecamento", value: dryness.label, score: 6 - dryness.score },
      { name: "Saúde Geral", value: dmg.value, score: dmg.score },
    ];
    metrics.forEach((m) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...TEXT);
      pdf.text(m.name, M, y);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...MUTED);
      pdf.text(m.value, M + 45, y);
      // mini bar
      const barX = M + 95;
      const bW = 55;
      pdf.setFillColor(235, 230, 220);
      pdf.rect(barX, y - 2.5, bW, 2.5, "F");
      const fillC: [number, number, number] =
        m.score >= 4 ? [16, 185, 129] : m.score >= 3 ? [245, 158, 11] : [220, 60, 60];
      pdf.setFillColor(...fillC);
      pdf.rect(barX, y - 2.5, (bW * m.score) / 5, 2.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...AMBER_DARK);
      pdf.text(`${m.score}/5`, PW - M, y, { align: "right" });
      y += 5.5;
    });
    y += 2;

    // Recoverability box
    pdf.setFillColor(...SUBTLE_BG);
    pdf.setDrawColor(...AMBER);
    pdf.setLineWidth(0.4);
    const recH = 16;
    pdf.roundedRect(M, y, W, recH, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...TEXT);
    pdf.text("Índice de Recuperabilidade", M + 4, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    const recDesc =
      recoverability >= 7
        ? "Excelente potencial — dano leve concentrado nas pontas."
        : recoverability >= 4
        ? "Recuperação possível com cuidados consistentes."
        : "Requer plano intensivo e acompanhamento profissional.";
    pdf.text(recDesc, M + 4, y + 11, { maxWidth: W - 35 });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(...AMBER_DARK);
    pdf.text(`${recoverability}/10`, PW - M - 4, y + 8, { align: "right" });
    pdf.setFontSize(7);
    pdf.text(recoverStatus, PW - M - 4, y + 13, { align: "right" });
    y += recH + 5;

    // Two-column section: Relato + Edu e Você
    pdf.setTextColor(...TEXT);
    const colW = (W - 4) / 2;
    const colStartY = y;

    // Left: Seu Relato
    if (profile.client_self_assessment || profile.client_expected_result) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...AMBER_DARK);
      pdf.text("SEU RELATO", M, y);
      y += 4;
      pdf.setTextColor(...TEXT);
      if (profile.client_self_assessment) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...MUTED);
        pdf.text("COMO VOCÊ VÊ SEU CABELO HOJE", M, y);
        y += 3.5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(...TEXT);
        const lines = pdf.splitTextToSize(profile.client_self_assessment, colW);
        pdf.text(lines, M, y);
        y += lines.length * 3.6 + 2;
      }
      if (profile.client_expected_result) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...MUTED);
        pdf.text("RESULTADO QUE VOCÊ ESPERA", M, y);
        y += 3.5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(...TEXT);
        const lines = pdf.splitTextToSize(profile.client_expected_result, colW);
        pdf.text(lines, M, y);
        y += lines.length * 3.6;
      }
    }
    const leftEndY = y;

    // Right: Edu e Você
    let yR = colStartY;
    const xR = M + colW + 4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...AMBER_DARK);
    pdf.text("✦  EDU E VOCÊ", xR, yR);
    yR += 4;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...TEXT);
    const eduText =
      profile.edu_personal_response ||
      "Sua análise foi registrada. Em breve seu profissional irá conversar com você sobre o melhor plano de cuidados personalizado.";
    const eduLines = pdf.splitTextToSize(eduText, colW);
    pdf.text(eduLines, xR, yR);
    yR += eduLines.length * 3.6;

    y = Math.max(leftEndY, yR) + 6;

    // Signature
    try {
      const sig = await loadImageAsDataURL(eduSignature);
      pdf.addImage(sig, "PNG", PW - M - 38, y, 38, 12);
    } catch {
      /* noop */
    }
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text("Edu Valentim — IA Hair Expert", PW - M, y + 15, { align: "right" });
    y += 20;

    // Convite Sílvia + QR Code (substitui o botão da versão tela)
    if (slug) {
      const bookingUrl = `${window.location.origin}/${slug}`;
      const qrSize = 32; // mm
      // Garante espaço; se não couber, adiciona página
      if (y + qrSize + 14 > PH - 22) {
        pdf.addPage();
        y = 20;
      }
      try {
        const qrDataUrl = await QRCode.toDataURL(bookingUrl, {
          margin: 1,
          width: 512,
          color: { dark: "#1A1A1A", light: "#FFFFFF" },
        });
        pdf.addImage(qrDataUrl, "PNG", M, y, qrSize, qrSize);
      } catch {
        /* noop */
      }
      const tx = M + qrSize + 5;
      const tw = W - qrSize - 5;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...AMBER_DARK);
      pdf.text("Continue com a Sílvia", tx, y + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...TEXT);
      const inviteText = `Posso te direcionar para a Sílvia, minha colega de atendimento virtual do ${salonInlineReference(
        establishmentName,
      )}, para que ela agende rapidinho a continuação dessa experiência que adorei ter tido com você!`;
      const inviteLines = pdf.splitTextToSize(inviteText, tw);
      pdf.text(inviteLines, tx, y + 10);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTED);
      pdf.text(
        "Escaneie este QR Code para falar com a Sílvia.",
        tx,
        y + 10 + inviteLines.length * 3.6 + 4,
      );
      y += qrSize + 4;
    }

    // Footer disclaimers
    const footY = PH - 18;
    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.2);
    pdf.line(M, footY - 2, PW - M, footY - 2);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(
      "* A qualidade da análise pode sofrer alterações por variáveis externas como qualidade da foto, iluminação, ângulo, entre outros.",
      M,
      footY + 2,
      { maxWidth: W }
    );
    pdf.text(
      "** Nenhuma análise computacional substitui a avaliação de um profissional.",
      M,
      footY + 8,
      { maxWidth: W }
    );

    return pdf.output("blob");
  }

  async function handleShare() {
    setLoading(true);
    try {
      const blob = await buildPdf();
      const file = new File([blob], fileName, { type: "application/pdf" });
      const shareText = "Sua análise capilar — Salão Cloud";

      const navAny = navigator as any;
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        try {
          await navAny.share({ files: [file], title: shareText, text: shareText });
          setLoading(false);
          return;
        } catch (err: any) {
          if (err?.name === "AbortError") {
            setLoading(false);
            return;
          }
        }
      }

      // Fallback desktop: baixa o PDF e abre WhatsApp Web genérico
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      window.open(
        `https://wa.me/?text=${encodeURIComponent(shareText + " (anexe o PDF que acabou de baixar)")}`,
        "_blank"
      );
      toast.success("PDF baixado. Anexe no WhatsApp para enviar.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      aria-label="Compartilhar PDF no WhatsApp"
      className="inline-flex items-center gap-2 rounded-full bg-[#E6A15C] text-[#1A1A1A] px-4 py-2 text-sm font-semibold shadow-lg hover:bg-[#d4914f] active:scale-95 transition-all disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      {loading ? "Gerando PDF..." : "Compartilhar PDF"}
    </button>
  );
}
