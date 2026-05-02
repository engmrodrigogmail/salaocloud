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
  features: string[];
  is_highlighted: boolean;
  badge: string | null;
}

// Preço cheio fictício de marketing — usado como "de R$ 179,90 por R$ 129,90".
const COMPARE_PRICE = 179.9;

const fallbackPlan: Plan = {
  id: "pro-fallback",
  slug: "pro",
  name: "Pro",
  description: "Plano único com tudo liberado para o seu salão crescer.",
  price_monthly: 129.9,
  features: [
    "Profissionais ilimitados",
    "Serviços ilimitados",
    "Clientes ilimitados",
    "Comandas internas",
    "Comissões avançadas",
    "Programa de fidelidade",
    "Cupons de desconto",
    "Catálogo/portfólio",
    "Vitrine na tela de clientes",
    "Lembretes e notificações ilimitadas no próprio app",
    "Branding personalizado",
    "Relatórios avançados",
    "Suporte IA 24h/dia, 365 dias/ano",
  ],
  is_highlighted: true,
  badge: "Oferta de lançamento",
};

const formatPrice = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PricingSection() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, slug, name, description, price_monthly, features, is_highlighted, badge")
        .eq("is_active", true)
        .eq("slug", "pro")
        .maybeSingle();

      if (error || !data) {
        setPlan(fallbackPlan);
      } else {
        setPlan({
          ...data,
          features: Array.isArray(data.features) ? (data.features as string[]) : [],
        });
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <section id="planos" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-semibold text-primary uppercase tracking-premium">
            Plano único
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mt-5 mb-5 text-foreground">
            Tudo liberado por <span className="text-primary">um preço só</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            Sem pegadinha de "plano inicial". Você paga um valor fixo e usa todas as funcionalidades do Salão Cloud.
          </p>
        </div>

        {/* Single Pricing card */}
        <div className="max-w-md mx-auto">
          {loading || !plan ? (
            <div className="p-8 rounded-sm border border-border bg-card">
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
          ) : (
            <div
              className={cn(
                "relative p-8 rounded-sm border-2 transition-all duration-300 animate-fade-in-up bg-card",
                "border-primary shadow-lg bg-secondary/40",
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-sm bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-premium">
                  {plan.badge}
                </div>
              )}

              <h3 className="font-display text-2xl font-bold text-foreground">{plan.name}</h3>
              <p className="text-sm mt-1 text-muted-foreground min-h-[40px]">
                {plan.description}
              </p>

              <div className="my-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl text-muted-foreground line-through">
                    R$ {formatPrice(COMPARE_PRICE)}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-5xl font-bold text-foreground">
                    R$ {formatPrice(plan.price_monthly)}
                  </span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                <p className="text-xs mt-2 text-primary font-medium uppercase tracking-wider">
                  Cobrança mensal • Cancele quando quiser
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
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
                className="w-full h-12 font-semibold uppercase tracking-premium text-xs rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                asChild
              >
                <Link to={`/auth?mode=signup&plan=${plan.slug}`}>
                  Começar agora
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
