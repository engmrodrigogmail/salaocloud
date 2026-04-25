import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  features: string[];
  is_highlighted: boolean;
  badge: string | null;
  display_order: number;
}

// Fallback plans in case the database is not available
const fallbackPlans: Plan[] = [
  {
    id: "1",
    slug: "basic",
    name: "Básico",
    description: "Ideal para pequenos negócios que estão começando",
    price_monthly: 99,
    price_yearly: 950,
    features: [
      "Até 3 profissionais",
      "Agenda básica",
      "Notificações por email",
      "Relatórios básicos",
    ],
    is_highlighted: false,
    badge: null,
    display_order: 1,
  },
  {
    id: "2",
    slug: "professional",
    name: "Profissional",
    description: "Para negócios em crescimento que precisam de mais recursos",
    price_monthly: 199,
    price_yearly: 1900,
    features: [
      "Até 10 profissionais",
      "Agenda avançada",
      "Relatórios avançados",
      "Programa de fidelidade",
      "Cupons de desconto",
    ],
    is_highlighted: true,
    badge: "Mais Popular",
    display_order: 2,
  },
  {
    id: "3",
    slug: "premium",
    name: "Premium",
    description: "Solução completa para negócios estabelecidos",
    price_monthly: 399,
    price_yearly: 3800,
    features: [
      "Profissionais ilimitados",
      "Todas as funcionalidades",
      "API de integração",
      "Suporte prioritário",
      "Multi-unidades",
      "Personalização da marca",
    ],
    is_highlighted: false,
    badge: null,
    display_order: 3,
  },
];

export function PricingSection() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isYearly, setIsYearly] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("id, slug, name, description, price_monthly, price_yearly, features, is_highlighted, badge, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (plansError || !plansData || plansData.length === 0) {
        setPlans(fallbackPlans);
      } else {
        const parsedPlans = plansData.map((plan: any) => ({
          ...plan,
          features: Array.isArray(plan.features) ? plan.features : [],
        }));
        setPlans(parsedPlans);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const calculateSavings = (monthly: number, yearly: number | null) => {
    if (!yearly) return 0;
    const annualFromMonthly = monthly * 12;
    const savings = annualFromMonthly - yearly;
    return Math.round((savings / annualFromMonthly) * 100);
  };

  const getDisplayPrice = (plan: Plan) => {
    if (isYearly && plan.price_yearly) {
      return Math.round(plan.price_yearly / 12);
    }
    return plan.price_monthly;
  };

  return (
    <section id="planos" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-semibold text-primary uppercase tracking-premium">
            Planos
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mt-5 mb-5 text-foreground">
            Escolha o plano ideal pro <span className="text-primary">seu momento</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            Selecione o plano que melhor atende às necessidades do seu negócio.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={cn(
            "text-sm font-medium uppercase tracking-wider transition-colors",
            !isYearly ? "text-foreground" : "text-muted-foreground"
          )}>
            Mensal
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={cn(
              "relative w-14 h-7 rounded-full transition-colors duration-300",
              isYearly ? "bg-primary" : "bg-muted border border-border"
            )}
            aria-label="Alternar entre plano mensal e anual"
          >
            <span
              className={cn(
                "absolute top-1 w-5 h-5 rounded-full bg-card shadow-md transition-transform duration-300",
                isYearly ? "translate-x-8" : "translate-x-1"
              )}
            />
          </button>
          <span className={cn(
            "text-sm font-medium uppercase tracking-wider transition-colors",
            isYearly ? "text-foreground" : "text-muted-foreground"
          )}>
            Anual
          </span>
          {isYearly && (
            <span className="ml-2 px-3 py-1 rounded-sm bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider animate-fade-in">
              Economize até 20%
            </span>
          )}
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-8 rounded-sm border border-border bg-card">
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
            plans.map((plan, index) => {
              const savings = calculateSavings(plan.price_monthly, plan.price_yearly);
              const displayPrice = getDisplayPrice(plan);
              const isPremium = plan.slug === "premium";

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative p-8 rounded-sm border transition-all duration-300 animate-fade-in-up bg-card",
                    plan.is_highlighted
                      ? "border-primary border-2 shadow-lg md:scale-[1.02] bg-secondary/40"
                      : "border-border hover:border-primary/40"
                  )}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-sm bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-premium">
                      {plan.badge}
                    </div>
                  )}

                  <h3 className="font-display text-xl font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm mt-1 text-muted-foreground min-h-[40px]">
                    {plan.description}
                  </p>

                  <div className="my-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        R${displayPrice}
                      </span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    {isYearly && plan.price_yearly && savings > 0 && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        <span className="line-through opacity-60">R${plan.price_monthly}/mês</span>
                        <span className="ml-2 font-semibold text-primary">-{savings}%</span>
                      </div>
                    )}
                    {isYearly && plan.price_yearly && (
                      <p className="text-xs mt-1 text-muted-foreground">
                        Cobrado R${plan.price_yearly}/ano
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3">
                        <Check
                          size={16}
                          className="mt-1 flex-shrink-0 text-primary"
                          strokeWidth={2.5}
                        />
                        <span className="text-sm text-foreground/90">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={plan.is_highlighted ? "default" : "outline"}
                    className={cn(
                      "w-full h-12 font-semibold uppercase tracking-premium text-xs rounded-sm",
                      plan.is_highlighted
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                        : "border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent"
                    )}
                    asChild
                  >
                    <Link to={isPremium ? "/auth?mode=signup&plan=premium" : `/auth?mode=signup&plan=${plan.slug}`}>
                      {isPremium ? "Falar com Vendas" : "Contratar Agora"}
                    </Link>
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
