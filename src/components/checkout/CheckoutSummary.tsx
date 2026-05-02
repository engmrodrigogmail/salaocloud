import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { CouponInput } from "./CouponInput";
import { ValidatedCoupon } from "@/hooks/useCouponValidation";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  stripe_price_id_monthly: string | null;
  features: string[];
  is_highlighted: boolean;
  badge: string | null;
}

interface CheckoutSummaryProps {
  onCheckoutComplete?: (data: {
    plan: Plan;
    billingCycle: "monthly";
    coupon: ValidatedCoupon | null;
    finalPrice: number;
  }) => void;
}

const MARKETING_OLD_PRICE = 179.9;

export function CheckoutSummary({ onCheckoutComplete }: CheckoutSummaryProps) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<ValidatedCoupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    const fetchPlan = async () => {
      const { data, error } = await supabase
        .from("subscription_plans" as any)
        .select("id, slug, name, description, price_monthly, stripe_price_id_monthly, features, is_highlighted, badge")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .limit(1);

      if (!error && data && data.length > 0) {
        const p = data[0] as any;
        setPlan({ ...p, features: Array.isArray(p.features) ? p.features : [] });
      }
      setLoading(false);
    };

    fetchPlan();
  }, []);

  const basePrice = plan?.price_monthly ?? 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  const handleCouponApplied = (coupon: ValidatedCoupon | null, discount: number) => {
    setAppliedCoupon(coupon);
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

  useEffect(() => {
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === "percentage") {
        setDiscountAmount((basePrice * appliedCoupon.discount_value) / 100);
      } else {
        setDiscountAmount(appliedCoupon.discount_value);
      }
    }
  }, [basePrice, appliedCoupon]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const handleCheckout = async () => {
    if (!plan) return;

    setCheckoutLoading(true);

    try {
      const priceId = plan.stripe_price_id_monthly;

      if (!priceId) {
        toast.error("Plano não configurado para pagamento");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId,
          planSlug: plan.slug,
          couponCode: appliedCoupon?.code || null,
          billingCycle: "monthly",
        },
      });

      if (error) {
        console.error("Checkout error:", error);
        toast.error("Erro ao iniciar checkout. Tente novamente.");
        return;
      }

      if (data?.url) {
        window.open(data.url, "_blank");

        onCheckoutComplete?.({
          plan,
          billingCycle: "monthly",
          coupon: appliedCoupon,
          finalPrice,
        });

        toast.success("Redirecionando para o pagamento...");
      } else {
        toast.error("Erro ao criar sessão de checkout");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum plano disponível no momento.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </div>
          {plan.badge && <Badge variant="secondary">{plan.badge}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price */}
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg line-through text-muted-foreground">
              {formatPrice(MARKETING_OLD_PRICE)}
            </span>
            <span className="text-3xl font-bold text-primary">{formatPrice(plan.price_monthly)}</span>
            <span className="text-sm text-muted-foreground">/mês</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Oferta de lançamento • Cancele quando quiser
          </p>
        </div>

        <Separator />

        {/* Coupon */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Cupom de desconto</Label>
          <CouponInput
            selectedPlan={plan.slug}
            purchaseValue={basePrice}
            subscriptionMonths={1}
            onCouponApplied={handleCouponApplied}
          />
        </div>

        <Separator />

        {/* Summary */}
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
            <span>Total / mês</span>
            <span className="text-primary">{formatPrice(finalPrice)}</span>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Incluso no plano:</Label>
          <ul className="space-y-1">
            {plan.features.slice(0, 6).map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary" />
                {feature}
              </li>
            ))}
            {plan.features.length > 6 && (
              <li className="text-sm text-muted-foreground pl-6">
                +{plan.features.length - 6} mais...
              </li>
            )}
          </ul>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" size="lg" onClick={handleCheckout} disabled={checkoutLoading}>
          {checkoutLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Continuar para pagamento
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
