import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Sparkles } from "lucide-react";
import { useTrialDays } from "@/hooks/useTrialDays";
import heroModels from "@/assets/hero-models.png";

export function HeroSection() {
  const { trialDays } = useTrialDays();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-background">
      {/* Subtle decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 pt-28 pb-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: text content */}
          <div className="text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/20 mb-8 animate-fade-in">
              <Sparkles size={16} />
              <span className="text-sm font-medium tracking-wide">{trialDays} dias grátis para testar</span>
            </div>

            {/* Main Headline - serif elegant */}
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6 animate-fade-in-up uppercase" style={{ animationDelay: "0.2s" }}>
              <span className="text-foreground">SALÃO CLOUD:</span>
              <br />
              <span className="text-gradient-copper">O SEU SALÃO,</span>
              <br />
              <span className="text-foreground">CONECTADO.</span>
            </h1>

            {/* Bullets */}
            <ul className="space-y-2 mb-8 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <li className="flex items-center gap-2 text-base sm:text-lg text-foreground/90">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Agendamento Inteligente
              </li>
              <li className="flex items-center gap-2 text-base sm:text-lg text-foreground/90">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Gestão Financeira Sem Esforço
              </li>
              <li className="flex items-center gap-2 text-base sm:text-lg text-foreground/90">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Conquista de Clientes
              </li>
            </ul>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
              <Button
                size="lg"
                className="bg-gradient-gold hover:opacity-90 text-secondary font-semibold px-8 h-14 text-base glow-gold group tracking-wide uppercase"
                asChild
              >
                <Link to="/auth?mode=signup">
                  Descubra o futuro
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-base border-foreground/20 uppercase tracking-wide"
                asChild
              >
                <a href="#funcionalidades">
                  <Calendar className="mr-2" size={18} />
                  Teste Grátis
                </a>
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-10 pt-8 border-t border-border grid grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
              <div>
                <p className="font-display text-2xl md:text-3xl font-bold text-gradient-copper">10+</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Anos de Experiência</p>
              </div>
              <div>
                <p className="font-display text-2xl md:text-3xl font-bold text-gradient-copper">2.5K</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Salões Atendidos</p>
              </div>
              <div>
                <p className="font-display text-2xl md:text-3xl font-bold text-gradient-copper">10K+</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Clientes Satisfeitos</p>
              </div>
            </div>
          </div>

          {/* Right: hero image */}
          <div className="relative animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <div className="absolute -inset-4 bg-gradient-gold opacity-20 blur-3xl rounded-full" />
            <img
              src={heroModels}
              alt="Profissionais de beleza e modelos do Salão Cloud"
              className="relative w-full h-auto rounded-2xl shadow-2xl object-cover"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
