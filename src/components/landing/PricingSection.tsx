import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Básico",
    price: "49",
    description: "Perfeito pra quem tá começando",
    features: [
      "Até 2 profissionais",
      "Agenda online ilimitada",
      "Página de agendamento",
      "Gestão de clientes",
      "Suporte por email",
    ],
    highlighted: false,
    cta: "Começar Grátis",
  },
  {
    name: "Profissional",
    price: "99",
    description: "O mais escolhido pelos salões",
    features: [
      "Até 5 profissionais",
      "Tudo do plano Básico",
      "Lembretes por WhatsApp",
      "Relatórios completos",
      "Controle de comissões",
      "Suporte prioritário",
    ],
    highlighted: true,
    cta: "Começar Grátis",
    badge: "Mais Popular",
  },
  {
    name: "Premium",
    price: "199",
    description: "Para salões que querem voar",
    features: [
      "Profissionais ilimitados",
      "Tudo do plano Profissional",
      "Multi-unidades",
      "API para integrações",
      "Relatórios avançados",
      "Gerente de conta dedicado",
    ],
    highlighted: false,
    cta: "Falar com Vendas",
  },
];

export function PricingSection() {
  return (
    <section id="planos" className="py-24">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">
            Planos
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-6">
            Escolha o plano ideal pro{" "}
            <span className="text-gradient-gold">seu momento</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Comece grátis por 14 dias. Sem cartão de crédito. Cancele quando quiser.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative p-8 rounded-2xl border transition-all duration-300 animate-fade-in-up ${
                plan.highlighted
                  ? "bg-gradient-primary border-transparent shadow-xl scale-105"
                  : "bg-card border-border hover:border-primary/30 hover:shadow-lg"
              }`}
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-accent text-accent-foreground text-sm font-semibold">
                  {plan.badge}
                </div>
              )}

              <div className={plan.highlighted ? "text-white" : ""}>
                <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                <p className={`text-sm mt-1 ${plan.highlighted ? "text-white/80" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>

                <div className="my-6">
                  <span className="text-4xl font-bold">R${plan.price}</span>
                  <span className={`text-sm ${plan.highlighted ? "text-white/80" : "text-muted-foreground"}`}>
                    /mês
                  </span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check 
                        size={18} 
                        className={`mt-0.5 flex-shrink-0 ${
                          plan.highlighted ? "text-white" : "text-primary"
                        }`} 
                      />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full h-12 font-semibold ${
                    plan.highlighted
                      ? "bg-white text-primary hover:bg-white/90"
                      : "bg-gradient-primary text-white hover:opacity-90"
                  }`}
                  asChild
                >
                  <Link to="/auth?mode=signup">{plan.cta}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
