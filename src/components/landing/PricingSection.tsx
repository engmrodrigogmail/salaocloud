import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  features: string[];
  is_highlighted: boolean;
  badge: string | null;
  cta_text: string;
  display_order: number;
}

// Fallback plans in case the database is not available
const fallbackPlans: Plan[] = [
  {
    id: "1",
    slug: "basic",
    name: "Básico",
    description: "Perfeito pra quem tá começando",
    price_monthly: 49,
    features: [
      "Até 2 profissionais",
      "Agenda online ilimitada",
      "Página de agendamento",
      "Gestão de clientes",
      "Suporte por email",
    ],
    is_highlighted: false,
    badge: null,
    cta_text: "Começar Grátis",
    display_order: 1,
  },
  {
    id: "2",
    slug: "professional",
    name: "Profissional",
    description: "O mais escolhido pelos salões",
    price_monthly: 99,
    features: [
      "Até 5 profissionais",
      "Tudo do plano Básico",
      "Lembretes por WhatsApp",
      "Relatórios completos",
      "Controle de comissões",
      "Suporte prioritário",
    ],
    is_highlighted: true,
    badge: "Mais Popular",
    cta_text: "Começar Grátis",
    display_order: 2,
  },
  {
    id: "3",
    slug: "premium",
    name: "Premium",
    description: "Para salões que querem voar",
    price_monthly: 199,
    features: [
      "Profissionais ilimitados",
      "Tudo do plano Profissional",
      "Multi-unidades",
      "API para integrações",
      "Relatórios avançados",
      "Gerente de conta dedicado",
    ],
    is_highlighted: false,
    badge: null,
    cta_text: "Falar com Vendas",
    display_order: 3,
  },
];

export function PricingSection() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from("subscription_plans" as any)
        .select("id, slug, name, description, price_monthly, features, is_highlighted, badge, cta_text, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error || !data || data.length === 0) {
        console.log("Using fallback plans");
        setPlans(fallbackPlans);
      } else {
        const parsedPlans = data.map((plan: any) => ({
          ...plan,
          features: Array.isArray(plan.features) ? plan.features : [],
        }));
        setPlans(parsedPlans);
      }
      setLoading(false);
    };

    fetchPlans();
  }, []);

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
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-8 rounded-2xl border bg-card">
                  <Skeleton className="h-6 w-24 mb-2" />
                  <Skeleton className="h-4 w-40 mb-6" />
                  <Skeleton className="h-10 w-32 mb-6" />
                  <div className="space-y-3 mb-8">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <Skeleton key={j} className="h-4 w-full" />
                    ))}
                  </div>
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </>
          ) : (
            plans.map((plan, index) => (
              <div
                key={plan.id}
                className={`relative p-8 rounded-2xl border transition-all duration-300 animate-fade-in-up ${
                  plan.is_highlighted
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

                <div className={plan.is_highlighted ? "text-white" : ""}>
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                  <p className={`text-sm mt-1 ${plan.is_highlighted ? "text-white/80" : "text-muted-foreground"}`}>
                    {plan.description}
                  </p>

                  <div className="my-6">
                    <span className="text-4xl font-bold">
                      R${plan.price_monthly.toFixed(0)}
                    </span>
                    <span className={`text-sm ${plan.is_highlighted ? "text-white/80" : "text-muted-foreground"}`}>
                      /mês
                    </span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3">
                        <Check 
                          size={18} 
                          className={`mt-0.5 flex-shrink-0 ${
                            plan.is_highlighted ? "text-white" : "text-primary"
                          }`} 
                        />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full h-12 font-semibold ${
                      plan.is_highlighted
                        ? "bg-white text-primary hover:bg-white/90"
                        : "bg-gradient-primary text-white hover:opacity-90"
                    }`}
                    asChild
                  >
                    <Link to="/auth?mode=signup">{plan.cta_text}</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
