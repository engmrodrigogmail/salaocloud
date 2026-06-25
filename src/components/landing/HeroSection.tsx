import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  const navigate = useNavigate();
  return (
    <section
      id="inicio"
      className="relative w-full overflow-hidden bg-background"
      style={{
        backgroundImage: `url('https://files.manuscdn.com/user_upload_by_module/session_file/310419663031638273/nTFVuUDPTmoitPgN.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center right",
        backgroundRepeat: "no-repeat",
        minHeight: "90vh",
      }}
    >
      {/* Soft cream overlay on the left half for legibility */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.75) 25%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.08) 70%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* Mobile-only subtle white overlay for legibility */}
      <div className="absolute inset-0 pointer-events-none bg-white/15 md:hidden" />

      <div className="container mx-auto px-6 lg:px-10 pt-32 md:pt-36 pb-16 relative z-10 min-h-[90vh] flex items-center">
        <div className="w-full md:max-w-[55%] lg:max-w-[50%]">
          {/* Eyebrow / trial badge */}
          <div className="flex items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-premium">
              7 dias grátis
            </span>
            <span className="text-xs uppercase tracking-premium text-primary font-semibold">
              Salão Cloud
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display font-bold leading-[1.05] tracking-tight mb-5 text-foreground text-4xl sm:text-5xl md:text-[3.5rem] lg:text-[4rem]">
            Menos preocupações.
            <br />
            Mais Clientes.
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-primary font-medium mb-3">
            O seu salão, conectado.
          </p>
          <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-lg">
            Teste todas as funcionalidades por <strong className="text-foreground">7 dias gratuitos</strong>. Sem cartão, sem compromisso. Depois, apenas <strong className="text-foreground">R$ 129,90/mês</strong> com tudo liberado.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold uppercase tracking-premium px-7 h-12 rounded-sm text-xs group"
              onClick={() => navigate("/auth?mode=signup&trial=1")}
            >
              Sou Salão — 7 dias grátis
              <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
            </Button>
          </div>

          {/* Social proof */}
          <p className="text-sm text-muted-foreground">
            O futuro chegou e é agora! 🫶🏻✂️
          </p>
        </div>
      </div>
    </section>
  );
}
