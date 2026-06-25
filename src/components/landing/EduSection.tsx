import { Button } from "@/components/ui/button";
import { ArrowRight, Camera, Sparkles, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import eduPhoto from "@/assets/edu-valentim.png.asset.json";

const steps = [
  {
    icon: Camera,
    title: "Envie a foto",
    description: "O profissional fotografa o cabelo do cliente direto pelo app.",
  },
  {
    icon: Sparkles,
    title: "Edu analisa",
    description:
      "Porosidade, danos, elasticidade, brilho, ressecamento e potencial de recuperação — em segundos.",
  },
  {
    icon: FileText,
    title: "Receba o laudo",
    description:
      "Relatório técnico assinado pelo Edu, pronto para guiar o atendimento, a venda e a fidelização.",
  },
];

export function EduSection() {
  return (
    <section
      id="edu"
      className="relative py-24 bg-[#0e0d0b] text-white overflow-hidden"
    >
      {/* Subtle gold gradient accents */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#c9a86a]/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#c9a86a]/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center max-w-6xl mx-auto">
          {/* Photo */}
          <div className="order-1 lg:order-1">
            <div className="relative mx-auto max-w-sm lg:max-w-none">
              <div className="absolute -inset-2 bg-gradient-to-br from-[#c9a86a]/30 to-transparent rounded-sm blur-lg" />
              <img
                src={eduPhoto.url}
                alt="Edu Valentim — Especialista em análise capilar"
                className="relative w-full h-auto rounded-sm shadow-2xl object-cover"
                loading="lazy"
              />
            </div>
          </div>

          {/* Text */}
          <div className="order-2 lg:order-2">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.25em] text-[#c9a86a] mb-5 border border-[#c9a86a]/40 px-3 py-1 rounded-sm">
              Exclusivo Salão Cloud
            </span>

            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.1] mb-5">
              Conheça o <span className="text-[#c9a86a]">Edu</span> — o único consultor virtual especializado em análise capilar
            </h2>

            <p className="text-base md:text-lg text-white/75 leading-relaxed mb-8">
              O Edu analisa cabelos em segundos com índice técnico pronto para atendimento,
              venda e fidelização. Uma inteligência treinada exclusivamente para o universo dos salões — não existe nada igual no mercado.
            </p>

            <div className="space-y-5 mb-8">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-sm bg-[#c9a86a]/15 border border-[#c9a86a]/30 flex items-center justify-center">
                    <step.icon size={18} className="text-[#c9a86a]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{step.title}</h3>
                    <p className="text-sm text-white/65 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <blockquote className="border-l-2 border-[#c9a86a] pl-4 italic text-white/80 mb-8 text-sm md:text-base">
              "Cada detalhe revela sua essência. Seu cabelo, seu estilo, sua identidade."
              <footer className="not-italic text-xs text-[#c9a86a] mt-2 tracking-wider uppercase">
                — Edu Valentim
              </footer>
            </blockquote>

            <div className="bg-white/5 border border-[#c9a86a]/20 rounded-sm p-5 mb-6">
              <p className="text-sm md:text-base text-white/90 leading-relaxed">
                Só o Edu já vale o cadastro. <strong className="text-[#c9a86a]">Experimente 7 dias totalmente grátis</strong> e conheça o sistema — e claro, o Edu 😉
              </p>
            </div>

            <Button
              asChild
              size="lg"
              className="bg-[#c9a86a] hover:bg-[#b89456] text-[#0e0d0b] font-semibold uppercase tracking-premium px-7 h-12 rounded-sm text-xs group"
            >
              <Link to="/auth?mode=signup">
                Começar meus 7 dias grátis
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
              </Link>
            </Button>

            <p className="text-xs text-white/50 mt-4">
              Sem cartão de crédito. Acesso completo ao sistema durante o período de teste.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
