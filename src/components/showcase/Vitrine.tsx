import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
const VITRINE_BG = "/vitrine-bg.jpg";

export interface ShowcaseImage {
  id: string;
  image_url: string;
  caption: string | null;
}

interface VitrineProps {
  images: ShowcaseImage[];
  /** Quando definido, renderiza a vitrine como overlay full-screen com botão para fechar/agendar. */
  onClose?: () => void;
}

function renderCaptionWithLinks(text: string, onLinkClick: (url: string) => void) {
  // Regex sem flag global para evitar estado lastIndex compartilhado entre renders
  const urlRegex = /(https?:\/\/[^\s)]+)/i;
  const splitRegex = /(https?:\/\/[^\s)]+)/i;
  const parts = text.split(splitRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <button
          key={i}
          type="button"
          onClick={() => onLinkClick(part)}
          className="inline-flex items-center gap-1 text-brand-gold underline underline-offset-2 hover:opacity-80 break-all"
        >
          {part}
          <ExternalLink className="h-3 w-3" />
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function Vitrine({ images, onClose }: VitrineProps) {
  const [index, setIndex] = useState(0);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const current = images[index];
  const total = images.length;

  // se a lista mudar (ex: agendamento entrou no ar), evita índice fora de range
  useEffect(() => {
    if (index >= images.length) setIndex(0);
  }, [images.length, index]);

  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  const handleLinkClick = (url: string) => setPendingUrl(url);
  const confirmRedirect = () => {
    if (pendingUrl) {
      window.open(pendingUrl, "_blank", "noopener,noreferrer");
      setPendingUrl(null);
    }
  };

  if (!current) return null;

  const isOverlay = typeof onClose === "function";

  return (
    <section
      className={
        isOverlay
          ? "fixed inset-0 z-[60] overflow-y-auto py-8 px-4"
          : "relative min-h-[60vh] py-8 px-4"
      }
      style={{
        backgroundImage: `url(${VITRINE_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      aria-label="Vitrine do salão"
      role={isOverlay ? "dialog" : undefined}
      aria-modal={isOverlay ? true : undefined}
    >
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {isOverlay && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar vitrine"
          className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-black/60 border border-brand-copper/60 text-brand-gold hover:bg-black/80 flex items-center justify-center transition"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div className="relative max-w-3xl mx-auto">
        {/* Carousel */}
        <div className="relative rounded-2xl overflow-hidden bg-black/40 backdrop-blur-sm border border-brand-copper/40 shadow-2xl">
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="Ampliar imagem"
            className="aspect-[4/3] sm:aspect-[16/10] w-full bg-black flex items-center justify-center cursor-zoom-in"
          >
            <img
              src={current.image_url}
              alt={current.caption || `Imagem ${index + 1} de ${total}`}
              className="max-h-full max-w-full object-contain"
            />
          </button>

          {/* Arrows */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Imagem anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 border border-brand-copper/60 text-brand-gold hover:bg-black/70 flex items-center justify-center transition"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Próxima imagem"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 border border-brand-copper/60 text-brand-gold hover:bg-black/70 flex items-center justify-center transition"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Counter */}
          {total > 1 && (
            <div className="absolute bottom-2 right-3 text-xs px-2 py-1 rounded-md bg-black/60 text-brand-gold border border-brand-copper/40">
              {index + 1} de {total}
            </div>
          )}
        </div>

        {/* Caption */}
        {current.caption && (
          <div
            className="mt-4 rounded-xl bg-black/55 backdrop-blur-md border border-brand-copper/40 p-4 max-h-40 overflow-y-auto text-white text-sm leading-relaxed"
          >
            {renderCaptionWithLinks(current.caption, handleLinkClick)}
          </div>
        )}

        {/* Dots */}
        {total > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ir para imagem ${i + 1}`}
                className={`h-2 w-2 rounded-full transition ${
                  i === index ? "bg-brand-gold w-6" : "bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}

        {isOverlay && (
          <div className="mt-6 flex justify-center">
            <Button
              size="lg"
              onClick={onClose}
              className="bg-brand-copper hover:bg-brand-copper/90 text-white shadow-xl"
            >
              <Calendar className="h-5 w-5 mr-2" />
              Agendar agora
            </Button>
          </div>
        )}
      </div>

      {/* Zoom overlay */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
            aria-label="Fechar ampliação"
            className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/60 border border-brand-copper/60 text-brand-gold hover:bg-black/80 flex items-center justify-center transition"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={current.image_url}
            alt={current.caption || `Imagem ${index + 1} ampliada`}
            className="max-h-full max-w-full object-contain cursor-zoom-out"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* External link confirmation */}
      <AlertDialog open={!!pendingUrl} onOpenChange={(o) => !o && setPendingUrl(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do SalãoCloud?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está sendo redirecionado para uma página fora do SalãoCloud.
              O conteúdo é de responsabilidade do salão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRedirect}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
