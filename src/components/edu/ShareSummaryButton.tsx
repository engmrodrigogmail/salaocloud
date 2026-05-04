import { useState, RefObject } from "react";
import { Share2, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";

interface Props {
  targetRef: RefObject<HTMLElement>;
  fileName?: string;
  shareText?: string;
}

export function ShareSummaryButton({ targetRef, fileName = "analise-capilar.png", shareText = "Sua análise capilar — SalaoCloud" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    if (!targetRef.current) return;
    setLoading(true);
    try {
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: "#1A1A1A",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png", 0.95)
      );
      if (!blob) throw new Error("Falha ao gerar imagem");

      const file = new File([blob], fileName, { type: "image/png" });

      // Tenta Web Share API com arquivo (mobile moderno)
      const navAny = navigator as any;
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        try {
          await navAny.share({
            files: [file],
            title: shareText,
            text: shareText,
          });
          setLoading(false);
          return;
        } catch (err: any) {
          if (err?.name === "AbortError") {
            setLoading(false);
            return;
          }
        }
      }

      // Fallback: baixa o PNG e abre o WhatsApp para o usuário escolher contato
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      window.open(
        `https://wa.me/?text=${encodeURIComponent(shareText + " (anexe a imagem que acabou de baixar)")}`,
        "_blank"
      );
      toast.success("Imagem baixada. Anexe no WhatsApp para enviar.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar a imagem. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      aria-label="Compartilhar no WhatsApp"
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#E6A15C] text-[#1A1A1A] shadow-2xl shadow-amber-900/50 hover:bg-[#d4914f] active:scale-95 transition-all flex items-center justify-center disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Share2 className="h-6 w-6" />}
    </button>
  );
}
