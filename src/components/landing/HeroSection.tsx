import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Twitter, Facebook } from "lucide-react";
import heroModels from "@/assets/hero-models.png";

export function HeroSection() {
  return (
    <section className="relative min-h-screen bg-[hsl(0_0%_4%)] text-[hsl(35_20%_92%)] overflow-hidden">
      {/* Right side: image fills full height to edge */}
      <div className="absolute inset-y-0 right-0 w-full md:w-1/2 lg:w-[58%]">
        <img
          src={heroModels}
          alt="Profissionais e modelos do Salão Cloud"
          className="w-full h-full object-cover object-center"
          loading="eager"
        />
        {/* Left fade so text remains readable on small/medium screens */}
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(0_0%_4%)] via-[hsl(0_0%_4%/0.4)] to-transparent md:from-[hsl(0_0%_4%)] md:via-transparent md:to-transparent" />
      </div>

      <div className="container mx-auto px-6 lg:px-10 pt-32 pb-16 relative z-10 min-h-screen flex flex-col">
        <div className="grid md:grid-cols-2 gap-8 flex-1 items-center">
          {/* Left: text content */}
          <div className="text-left max-w-xl">
            {/* Headline - serif maiúsculo condensado */}
            <h1 className="font-display font-bold leading-[0.95] tracking-tight mb-7 text-[hsl(35_20%_95%)] uppercase text-[2.5rem] sm:text-5xl md:text-[3.25rem] lg:text-[4rem]">
              SALÃO CLOUD:
              <br />
              O SEU SALÃO,
              <br />
              CONECTADO.
            </h1>

            {/* Bullets */}
            <ul className="space-y-2.5 mb-8 text-[hsl(35_20%_88%)]">
              <li className="flex items-start gap-2.5 text-base sm:text-lg">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[hsl(35_20%_88%)] flex-shrink-0" />
                Agendamento Inteligente
              </li>
              <li className="flex items-start gap-2.5 text-base sm:text-lg">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[hsl(35_20%_88%)] flex-shrink-0" />
                Gestão Financeira Sem Esforço
              </li>
              <li className="flex items-start gap-2.5 text-base sm:text-lg">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[hsl(35_20%_88%)] flex-shrink-0" />
                Conquista de Clientes
              </li>
            </ul>

            {/* CTA principal: dourado sólido */}
            <Button
              size="lg"
              className="bg-[hsl(35_55%_45%)] hover:bg-[hsl(35_55%_50%)] text-[hsl(0_0%_8%)] font-semibold uppercase tracking-wider px-7 h-12 rounded-md text-sm group"
              asChild
            >
              <Link to="/auth?mode=signup">
                Descubra o Futuro
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
              </Link>
            </Button>

            {/* CTAs outline */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-6 text-xs uppercase tracking-wider rounded-md bg-transparent border-[hsl(35_20%_88%)] text-[hsl(35_20%_92%)] hover:bg-[hsl(35_20%_92%)] hover:text-[hsl(0_0%_8%)]"
                asChild
              >
                <a href="#funcionalidades">Descubra Mais</a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-6 text-xs uppercase tracking-wider rounded-md bg-transparent border-[hsl(35_20%_88%)] text-[hsl(35_20%_92%)] hover:bg-[hsl(35_20%_92%)] hover:text-[hsl(0_0%_8%)]"
                asChild
              >
                <Link to="/auth?mode=signup">Teste Grátis</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats footer */}
        <div className="relative z-10 mt-auto pt-10">
          <div className="border-t border-[hsl(35_55%_45%)]/40 max-w-md pt-5 space-y-1.5">
            <p className="text-sm sm:text-base text-[hsl(35_20%_88%)]">
              Anos de Experiência: <span className="font-semibold text-[hsl(35_55%_55%)]">10+</span>
            </p>
            <p className="text-sm sm:text-base text-[hsl(35_20%_88%)]">
              Salões Atendidos: <span className="font-semibold text-[hsl(35_55%_55%)]">2.5K</span>
            </p>
            <p className="text-sm sm:text-base text-[hsl(35_20%_88%)]">
              Clientes Satisfeitos: <span className="font-semibold text-[hsl(35_55%_55%)]">10K+</span>
            </p>
          </div>
        </div>

        {/* Social icons bottom right */}
        <div className="absolute bottom-6 right-6 flex items-center gap-2 z-20">
          <a href="#" aria-label="X" className="w-8 h-8 rounded-full bg-[hsl(35_20%_92%)] text-[hsl(0_0%_8%)] flex items-center justify-center hover:bg-[hsl(35_55%_55%)] transition-colors">
            <Twitter size={14} />
          </a>
          <a href="#" aria-label="WhatsApp" className="w-8 h-8 rounded-full bg-[hsl(142_70%_45%)] text-white flex items-center justify-center hover:opacity-90 transition-opacity">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          </a>
          <a href="#" aria-label="Facebook" className="w-8 h-8 rounded-full bg-[hsl(35_20%_92%)] text-[hsl(220_70%_30%)] flex items-center justify-center hover:bg-[hsl(35_55%_55%)] transition-colors">
            <Facebook size={14} fill="currentColor" />
          </a>
        </div>
      </div>
    </section>
  );
}
