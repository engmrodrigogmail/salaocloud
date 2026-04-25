import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Twitter, Facebook } from "lucide-react";
import heroModels from "@/assets/hero-models.png";
import heroSalonBg from "@/assets/hero-salon-bg.jpg";

export function HeroSection() {
  return (
    <section
      id="inicio"
      className="relative min-h-screen overflow-hidden bg-[hsl(40_30%_96%)] text-[hsl(0_0%_12%)]"
    >
      {/* Salon background — full width, height matches models image, with left-to-right transparency gradient */}
      <div className="absolute left-0 right-0 top-28 md:top-32 pointer-events-none">
        <div className="relative w-full" style={{ aspectRatio: "1920 / 1024" }}>
          <img
            src={heroSalonBg}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
          {/* Transparency gradient: stronger on the left half (still visible), fading toward the right */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, hsl(40 30% 96% / 0.85) 0%, hsl(40 30% 96% / 0.7) 35%, hsl(40 30% 96% / 0.45) 60%, hsl(40 30% 96% / 0.2) 85%, hsl(40 30% 96% / 0.05) 100%)",
            }}
          />
        </div>
      </div>

      {/* Models image: right side, top aligned with "SALÃO CLOUD" headline, in front of salon bg */}
      <div className="absolute right-0 top-28 md:top-32 w-[45%] md:w-[40%] lg:w-[38%] pointer-events-none z-[5]">
        <img
          src={heroModels}
          alt="Profissionais do Salão Cloud — equipe diversa de cabeleireiros e maquiadores"
          className="w-full h-auto object-contain object-top"
          loading="eager"
        />
      </div>

      <div className="container mx-auto px-6 lg:px-10 pt-28 md:pt-32 pb-16 relative z-10 min-h-screen flex flex-col">
        <div className="grid md:grid-cols-2 gap-8 flex-1 items-center">
          {/* Left: text content */}
          <div className="text-left max-w-xl">
            {/* Headline */}
            <h1 className="font-display font-bold leading-[0.95] tracking-tight mb-7 uppercase text-[hsl(0_0%_10%)] text-[2.5rem] sm:text-5xl md:text-[3.25rem] lg:text-[4rem]">
              SALÃO CLOUD:
              <br />
              <span className="text-[hsl(22_55%_40%)]">O SEU SALÃO,</span>
              <br />
              CONECTADO.
            </h1>

            {/* Bullets */}
            <ul className="space-y-2.5 mb-8 text-[hsl(0_0%_25%)]">
              <li className="flex items-start gap-2.5 text-base sm:text-lg">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[hsl(22_55%_40%)] flex-shrink-0" />
                Agendamento Inteligente
              </li>
              <li className="flex items-start gap-2.5 text-base sm:text-lg">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[hsl(22_55%_40%)] flex-shrink-0" />
                Gestão Financeira Sem Esforço
              </li>
              <li className="flex items-start gap-2.5 text-base sm:text-lg">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[hsl(22_55%_40%)] flex-shrink-0" />
                Conquista de Clientes
              </li>
            </ul>

            {/* Primary CTA: solid copper */}
            <Button
              size="lg"
              className="bg-[hsl(22_55%_45%)] hover:bg-[hsl(22_55%_50%)] text-white font-semibold uppercase tracking-wider px-7 h-12 rounded-md text-sm group shadow-md"
              asChild
            >
              <Link to="/auth?mode=signup">
                Descubra o Futuro
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
              </Link>
            </Button>

            {/* Outline CTAs */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-6 text-xs uppercase tracking-wider rounded-md bg-transparent border-[hsl(0_0%_15%)] text-[hsl(0_0%_12%)] hover:bg-[hsl(0_0%_12%)] hover:text-white"
                asChild
              >
                <a href="#funcionalidades">Descubra Mais</a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-6 text-xs uppercase tracking-wider rounded-md bg-transparent border-[hsl(0_0%_15%)] text-[hsl(0_0%_12%)] hover:bg-[hsl(0_0%_12%)] hover:text-white"
                asChild
              >
                <Link to="/auth?mode=signup">Teste Grátis</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats footer */}
        <div className="relative z-10 mt-auto pt-10">
          <div className="border-t border-[hsl(22_55%_45%)]/50 max-w-md pt-5 space-y-1.5">
            <p className="text-sm sm:text-base text-[hsl(0_0%_25%)]">
              Anos de Experiência:{" "}
              <span className="font-semibold text-[hsl(22_55%_40%)]">10+</span>
            </p>
            <p className="text-sm sm:text-base text-[hsl(0_0%_25%)]">
              Salões Atendidos:{" "}
              <span className="font-semibold text-[hsl(22_55%_40%)]">2.5K</span>
            </p>
            <p className="text-sm sm:text-base text-[hsl(0_0%_25%)]">
              Clientes Satisfeitos:{" "}
              <span className="font-semibold text-[hsl(22_55%_40%)]">10K+</span>
            </p>
          </div>
        </div>

        {/* Social icons bottom right */}
        <div className="absolute bottom-6 right-6 flex items-center gap-2 z-20">
          <a
            href="#"
            aria-label="X"
            className="w-8 h-8 rounded-full bg-[hsl(0_0%_12%)] text-white flex items-center justify-center hover:bg-[hsl(22_55%_40%)] transition-colors"
          >
            <Twitter size={14} />
          </a>
          <a
            href="#"
            aria-label="WhatsApp"
            className="w-8 h-8 rounded-full bg-[hsl(142_70%_45%)] text-white flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
          </a>
          <a
            href="#"
            aria-label="Facebook"
            className="w-8 h-8 rounded-full bg-[hsl(0_0%_12%)] text-white flex items-center justify-center hover:bg-[hsl(22_55%_40%)] transition-colors"
          >
            <Facebook size={14} fill="currentColor" />
          </a>
        </div>
      </div>
    </section>
  );
}
