import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CouponInput } from "./CouponInput";
import { ValidatedCoupon } from "@/hooks/useCouponValidation";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";

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
}

interface CheckoutSummaryProps {
  onCheckoutComplete?: (data: {
    plan: Plan;
    billingCycle: "monthly" | "yearly";
    coupon: ValidatedCoupon | null;
    finalPrice: number;
  }) => void;
}

export function CheckoutSummary({ onCheckoutComplete }: CheckoutSummaryProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [appliedCoupon, setAppliedCoupon] = useState<ValidatedCoupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from("subscription_plans" as any)
        .select("id, slug, name, description, price_monthly, price_yearly, features, is_highlighted, badge")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (!error && data) {
        const parsedPlans = data.map((plan: any) => ({
          ...plan,
          features: Array.isArray(plan.features) ? plan.features : [],
        }));
        setPlans(parsedPlans);
        // Select highlighted plan by default, or first plan
        const defaultPlan = parsedPlans.find((p: Plan) => p.is_highlighted) || parsedPlans[0];
        if (defaultPlan) {
          setSelectedPlanSlug(defaultPlan.slug);
        }
      }
      setLoading(false);
    };

    fetchPlans();
  }, []);

  const selectedPlan = plans.find((p) => p.slug === selectedPlanSlug);

  const getBasePrice = () => {
    if (!selectedPlan) return 0;
    if (billingCycle === "yearly" && selectedPlan.price_yearly) {
      return selectedPlan.price_yearly;
    }
    return selectedPlan.price_monthly * (billingCycle === "yearly" ? 12 : 1);
  };

  const basePrice = getBasePrice();
  const finalPrice = Math.max(0, basePrice - discountAmount);

  const handleCouponApplied = (coupon: ValidatedCoupon | null, discount: number) => {
    setAppliedCoupon(coupon);
    // Recalculate discount based on current base price
    if (coupon) {
      if (coupon.discount_type === "percentage") {
        setDiscountAmount((basePrice * coupon.discount_value) / 100);
      } else {
        setDiscountAmount(coupon.discount_value);
      }
    } else {
      setDiscountAmount(0);
    }
  };

  // Recalculate discount when base price changes
  useEffect(() => {
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === "percentage") {
        setDiscountAmount((basePrice * appliedCoupon.discount_value) / 100);
      } else {
        setDiscountAmount(appliedCoupon.discount_value);
      }
    }
  }, [basePrice, appliedCoupon]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handleCheckout = () => {
    if (selectedPlan) {
      onCheckoutComplete?.({
        plan: selectedPlan,
        billingCycle,
        coupon: appliedCoupon,
        finalPrice,
      });
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Escolha seu plano</CardTitle>
        <CardDescription>
          Selecione o plano ideal para o seu negócio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Selection */}
        <RadioGroup value={selectedPlanSlug} onValueChange={setSelectedPlanSlug}>
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex items-start gap-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                  selectedPlanSlug === plan.slug
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedPlanSlug(plan.slug)}
              >
                <RadioGroupItem value={plan.slug} id={plan.slug} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={plan.slug} className="font-medium cursor-pointer">
                      {plan.name}
                    </Label>
                    {plan.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {plan.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                  <p className="text-lg font-bold text-primary mt-2">
                    {formatPrice(plan.price_monthly)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>

        {/* Billing Cycle */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Ciclo de cobrança</Label>
          <RadioGroup
            value={billingCycle}
            onValueChange={(v) => setBillingCycle(v as "monthly" | "yearly")}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="monthly" id="monthly" />
              <Label htmlFor="monthly" className="cursor-pointer">Mensal</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="yearly" id="yearly" />
              <Label htmlFor="yearly" className="cursor-pointer">
                Anual
                {selectedPlan?.price_yearly && (
                  <Badge variant="secondary" className="ml-2 bg-green-500/10 text-green-600">
                    Economize {Math.round(
                      ((selectedPlan.price_monthly * 12 - selectedPlan.price_yearly) /
                        (selectedPlan.price_monthly * 12)) *
                        100
                    )}%
                  </Badge>
                )}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        {/* Coupon Input */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Cupom de desconto</Label>
          <CouponInput
            selectedPlan={selectedPlanSlug}
            purchaseValue={basePrice}
            subscriptionMonths={billingCycle === "yearly" ? 12 : 1}
            onCouponApplied={handleCouponApplied}
          />
        </div>

        <Separator />

        {/* Price Summary */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(basePrice)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Desconto ({appliedCoupon?.code})</span>
              <span>-{formatPrice(discountAmount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-primary">{formatPrice(finalPrice)}</span>
          </div>
          {billingCycle === "yearly" && (
            <p className="text-xs text-muted-foreground text-right">
              Equivalente a {formatPrice(finalPrice / 12)}/mês
            </p>
          )}
        </div>

        {/* Features List */}
        {selectedPlan && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Incluso no plano:</Label>
            <ul className="space-y-1">
              {selectedPlan.features.slice(0, 4).map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  {feature}
                </li>
              ))}
              {selectedPlan.features.length > 4 && (
                <li className="text-sm text-muted-foreground pl-6">
                  +{selectedPlan.features.length - 4} mais...
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          size="lg"
          onClick={handleCheckout}
          disabled={!selectedPlan}
        >
          Continuar para pagamento
        </Button>
      </CardFooter>
    </Card>
  );
}
