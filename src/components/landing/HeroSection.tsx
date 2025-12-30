import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Sparkles, Play, X } from "lucide-react";
import { useTrialDays } from "@/hooks/useTrialDays";
import { useState, useRef } from "react";
import demoVideo from "@/assets/demo-video.mp4";

export function HeroSection() {
  const { trialDays } = useTrialDays();
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleOpenVideo = () => {
    setIsVideoOpen(true);
    setTimeout(() => {
      videoRef.current?.play();
    }, 100);
  };

  const handleCloseVideo = () => {
    setIsVideoOpen(false);
    videoRef.current?.pause();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

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

          <div className="mt-16 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
            <div 
              className="relative max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-card cursor-pointer group"
              onClick={handleOpenVideo}
            >
              {/* Video Thumbnail Preview */}
              <div className="aspect-video relative">
                <video 
                  className="w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                  autoPlay
                >
                  <source src={demoVideo} type="video/mp4" />
                </video>
                
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
                  0:05
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
          onClick={handleCloseVideo}
        >
          <div 
            className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl bg-card border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={handleCloseVideo}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
            >
              <X size={20} />
            </button>
            <div className="aspect-video bg-muted">
              <video 
                ref={videoRef}
                className="w-full h-full object-cover"
                controls
                playsInline
              >
                <source src={demoVideo} type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
