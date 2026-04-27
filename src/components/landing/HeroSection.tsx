import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
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
          {/* Eyebrow */}
          <p className="text-xs uppercase tracking-premium text-primary font-semibold mb-5">
            Salão Cloud
          </p>

          {/* Headline */}
          <h1 className="font-display font-bold leading-[1.05] tracking-tight mb-5 text-foreground text-4xl sm:text-5xl md:text-[3.5rem] lg:text-[4rem]">
            Menos preocupações.
            <br />
            Mais Clientes.
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-primary font-medium mb-10">
            O seu salão, conectado.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold uppercase tracking-premium px-7 h-12 rounded-sm text-xs group"
              asChild
            >
              <Link to="/auth?mode=signup">
                Sou Salão
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent font-semibold uppercase tracking-premium px-7 h-12 rounded-sm text-xs"
              asChild
            >
              <Link to="/cliente">Sou Cliente do Salão</Link>
            </Button>
          </div>

          {/* Social proof */}
          <p className="text-sm text-muted-foreground">
            +200 salões já confiam no Salão Cloud
          </p>
        </div>
      </div>
    </section>
  );
}
