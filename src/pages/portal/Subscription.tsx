import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerEstablishment } from "@/hooks/useOwnerEstablishment";
import { useAuth } from "@/contexts/AuthContext";
import { Check, CreditCard, Loader2, Crown, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CouponInput } from "@/components/checkout/CouponInput";
import { ValidatedCoupon } from "@/hooks/useCouponValidation";

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
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
}

interface Establishment {
  id: string;
  name: string;
  subscription_plan: string;
  stripe_subscription_id: string | null;
}

export default function PortalSubscription() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { guard } = useOwnerEstablishment(slug);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_type: string;
    discount_value: number;
  } | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  useEffect(() => {
    if (user && slug) {
      fetchData();
    }
  }, [user, slug]);

  const fetchData = async () => {
    try {
      // Fetch establishment
      const { data: estData, error: estError } = await supabase
        .from("establishments")
        .select("id, name, subscription_plan, stripe_subscription_id")
        .eq("slug", slug)
        .single();

      if (estError) throw estError;
      setEstablishment(estData);

      // Fetch plans
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("id, slug, name, description, price_monthly, price_yearly, features, is_highlighted, badge, stripe_price_id_monthly, stripe_price_id_yearly")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (plansError) throw plansError;
      
      const parsedPlans = (plansData || []).map((plan: any) => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : [],
      }));
      setPlans(parsedPlans);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const calculateSavings = (monthly: number, yearly: number | null) => {
    if (!yearly) return 0;
    const annualFromMonthly = monthly * 12;
    const savings = annualFromMonthly - yearly;
    return Math.round((savings / annualFromMonthly) * 100);
  };

  const formatPrice = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getDisplayPrice = (plan: Plan) => {
    if (isYearly && plan.price_yearly) {
      return plan.price_yearly / 12;
    }
    return plan.price_monthly;
  };

  const getFinalPrice = (plan: Plan) => {
    let price = getDisplayPrice(plan);
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === "percentage") {
        price = price * (1 - appliedCoupon.discount_value / 100);
      } else {
        price = Math.max(0, price - appliedCoupon.discount_value);
      }
    }
    return price;
  };

  const handleSubscribe = async (plan: Plan) => {
    const priceId = isYearly ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;
    
    if (!priceId) {
      toast.error("Este plano não está disponível para assinatura no momento");
      return;
    }

    setProcessingPlan(plan.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Sessão expirada. Por favor, faça login novamente.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId,
          planSlug: plan.slug,
          couponCode: appliedCoupon?.code || null,
          billingCycle: isYearly ? "yearly" : "monthly",
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL de checkout não recebida");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Erro ao iniciar checkout");
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      
      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      console.error("Portal error:", error);
      toast.error("Erro ao abrir portal de gerenciamento");
    }
  };

  
  const isCurrentPlan = (planSlug: string) => establishment?.subscription_plan === planSlug;
  const hasActiveSubscription = !!establishment?.stripe_subscription_id;

  if (loading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-primary" />
            Assinatura
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seu plano e forma de pagamento
          </p>
        </div>

        {/* No active subscription notice */}
        {!hasActiveSubscription && (
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <p className="font-medium text-foreground">
                  Você ainda não possui uma assinatura ativa. Escolha um plano abaixo para liberar todas as funcionalidades.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Plan Info */}
        {hasActiveSubscription && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Crown className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle>Plano Atual: {establishment?.subscription_plan}</CardTitle>
                    <CardDescription>Sua assinatura está ativa</CardDescription>
                  </div>
                </div>
                <Button variant="outline" onClick={handleManageSubscription}>
                  Gerenciar Assinatura
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Coupon Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Cupom de Desconto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CouponInput
              onCouponApplied={(coupon, amount) => {
                if (coupon) {
                  setAppliedCoupon({
                    code: coupon.code,
                    discount_type: coupon.discount_type,
                    discount_value: coupon.discount_value,
                  });
                  setDiscountAmount(amount);
                } else {
                  setAppliedCoupon(null);
                  setDiscountAmount(0);
                }
              }}
            />
          </CardContent>
        </Card>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4">
          <span className={cn(
            "text-sm font-medium transition-colors",
            !isYearly ? "text-foreground" : "text-muted-foreground"
          )}>
            Mensal
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={cn(
              "relative w-14 h-7 rounded-full transition-colors duration-300",
              isYearly ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300",
                isYearly ? "translate-x-8" : "translate-x-1"
              )}
            />
          </button>
          <span className={cn(
            "text-sm font-medium transition-colors",
            isYearly ? "text-foreground" : "text-muted-foreground"
          )}>
            Anual
          </span>
          {isYearly && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/30">
              Economize até 20%
            </Badge>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const savings = calculateSavings(plan.price_monthly, plan.price_yearly);
            const displayPrice = getDisplayPrice(plan);
            const finalPrice = getFinalPrice(plan);
            const hasDiscount = appliedCoupon && finalPrice < displayPrice;
            const isCurrent = isCurrentPlan(plan.slug);
            
            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative transition-all duration-300",
                  plan.is_highlighted 
                    ? "bg-gradient-primary border-transparent shadow-xl scale-105" 
                    : "hover:border-primary/30 hover:shadow-lg",
                  isCurrent && "ring-2 ring-primary"
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold">
                    {plan.badge}
                  </div>
                )}
                
                {isCurrent && (
                  <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    Seu Plano
                  </div>
                )}

                <CardHeader className={plan.is_highlighted ? "text-white" : ""}>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription className={plan.is_highlighted ? "text-white/80" : ""}>
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className={plan.is_highlighted ? "text-white" : ""}>
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      {hasDiscount && (
                        <span className="text-lg line-through opacity-60">
                          R${formatPrice(displayPrice)}
                        </span>
                      )}
                      <span className="text-4xl font-bold">
                        R${formatPrice(finalPrice)}
                      </span>
                      <span className={cn(
                        "text-sm",
                        plan.is_highlighted ? "text-white/80" : "text-muted-foreground"
                      )}>
                        /mês
                      </span>
                    </div>
                    {isYearly && plan.price_yearly && savings > 0 && (
                      <div className={cn(
                        "mt-1 text-sm",
                        plan.is_highlighted ? "text-white/80" : "text-muted-foreground"
                      )}>
                        <span className="line-through opacity-60">R${formatPrice(plan.price_monthly)}/mês</span>
                        <span className={cn(
                          "ml-2 font-semibold",
                          plan.is_highlighted ? "text-white" : "text-green-600"
                        )}>
                          -{savings}%
                        </span>
                      </div>
                    )}
                    {isYearly && plan.price_yearly && (
                      <p className={cn(
                        "text-xs mt-1",
                        plan.is_highlighted ? "text-white/60" : "text-muted-foreground"
                      )}>
                        Cobrado R${formatPrice(plan.price_yearly)}/ano
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check
                          size={18}
                          className={cn(
                            "mt-0.5 flex-shrink-0",
                            plan.is_highlighted ? "text-white" : "text-primary"
                          )}
                        />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={cn(
                      "w-full h-12 font-semibold",
                      plan.is_highlighted
                        ? "bg-white text-primary hover:bg-white/90"
                        : "bg-gradient-primary text-white hover:opacity-90"
                    )}
                    onClick={() => handleSubscribe(plan)}
                    disabled={processingPlan === plan.id || isCurrent}
                  >
                    {processingPlan === plan.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processando...
                      </>
                    ) : isCurrent ? (
                      "Plano Atual"
                    ) : (
                      "Assinar Agora"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
}
