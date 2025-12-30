import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Sparkles, Play } from "lucide-react";
import { useTrialDays } from "@/hooks/useTrialDays";
import { useState } from "react";

export function HeroSection() {
  const { trialDays } = useTrialDays();
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden hero-pattern">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "-3s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/20 mb-8 animate-fade-in">
            <Sparkles size={16} />
            <span className="text-sm font-medium">{trialDays} dias grátis para testar</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <span className="text-gradient-primary">Menos preocupação.</span>
            <br />
            <span className="text-foreground">Mais clientes.</span>
          </h1>

          {/* Announcement */}
          <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-gradient-gold mb-2">
              Agora somos Salão Cloud!
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
              Tudo que você já gostava, mas agora com uma gestão que entende de seu negócio!
            </p>
          </div>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            Gerencie seu salão ou barbearia de forma simples e inteligente. 
            Agendamentos, profissionais e clientes — tudo em um só lugar.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <Button
              size="lg"
              className="bg-gradient-gold hover:opacity-90 text-foreground font-semibold px-8 h-14 text-base glow-gold group"
              asChild
            >
              <Link to="/auth?mode=signup">
                Começar Agora — É Grátis
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 text-base border-border/50"
              asChild
            >
              <a href="#funcionalidades">
                <Calendar className="mr-2" size={20} />
                Ver Funcionalidades
              </a>
            </Button>
          </div>

          {/* Video Demo Section */}
          <div className="mt-16 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
            <div 
              className="relative max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-card cursor-pointer group"
              onClick={() => setIsVideoOpen(true)}
            >
              {/* Video Thumbnail/Placeholder */}
              <div className="aspect-video bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 flex items-center justify-center relative">
                {/* Mock Interface Preview */}
                <div className="absolute inset-4 rounded-lg bg-background/90 backdrop-blur-sm border border-border/30 overflow-hidden">
                  <div className="h-8 bg-muted/50 border-b border-border/30 flex items-center px-3 gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    <span className="ml-2 text-xs text-muted-foreground">Salão Cloud - Agenda</span>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-3">
                    <div className="col-span-1 space-y-2">
                      <div className="h-6 bg-primary/20 rounded animate-pulse" />
                      <div className="h-4 bg-muted/50 rounded w-3/4" />
                      <div className="h-4 bg-muted/50 rounded w-1/2" />
                      <div className="h-20 bg-accent/10 rounded mt-4" />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 7 }).map((_, i) => (
                          <div key={i} className="h-4 bg-muted/30 rounded text-[8px] flex items-center justify-center text-muted-foreground">
                            {["D", "S", "T", "Q", "Q", "S", "S"][i]}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 14 }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`h-6 rounded text-[8px] flex items-center justify-center ${
                              i === 5 ? "bg-primary text-primary-foreground" : "bg-muted/20"
                            }`}
                          >
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1 mt-2">
                        <div className="h-8 bg-primary/20 rounded flex items-center px-2 gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <div className="h-2 bg-muted/50 rounded w-20" />
                        </div>
                        <div className="h-8 bg-accent/20 rounded flex items-center px-2 gap-2">
                          <div className="w-2 h-2 rounded-full bg-accent" />
                          <div className="h-2 bg-muted/50 rounded w-24" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-background/20 group-hover:bg-background/10 transition-colors">
                  <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="text-primary-foreground ml-1" size={32} fill="currentColor" />
                  </div>
                </div>
              </div>
              
              {/* Video Label */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full">
                  Veja o Salão Cloud em ação
                </span>
                <span className="text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full">
                  2:30
                </span>
              </div>
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex flex-col items-center gap-4 animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
            <div className="flex -space-x-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white text-sm font-medium border-2 border-background"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">+200</span> salões já confiam no Salão Cloud
            </p>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {isVideoOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setIsVideoOpen(false)}
        >
          <div 
            className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl bg-card border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
            >
              ✕
            </button>
            <div className="aspect-video bg-muted flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Play className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">Vídeo em breve!</h3>
                <p className="text-muted-foreground max-w-md">
                  Estamos preparando um vídeo demonstrativo completo do Salão Cloud. 
                  Enquanto isso, experimente grátis e descubra na prática!
                </p>
                <Button className="mt-6" asChild>
                  <Link to="/auth?mode=signup">Começar Agora</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
