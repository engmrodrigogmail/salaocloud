import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Tag, Check, X, Percent, DollarSign } from "lucide-react";
import { useCouponValidation, ValidatedCoupon } from "@/hooks/useCouponValidation";
import { cn } from "@/lib/utils";

interface CouponInputProps {
  selectedPlan?: string;
  selectedFeatures?: string[];
  purchaseValue?: number;
  subscriptionMonths?: number;
  onCouponApplied?: (coupon: ValidatedCoupon | null, discountAmount: number) => void;
  className?: string;
}

export function CouponInput({
  selectedPlan,
  selectedFeatures = [],
  purchaseValue = 0,
  subscriptionMonths = 1,
  onCouponApplied,
  className,
}: CouponInputProps) {
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<ValidatedCoupon | null>(null);
  const { validateCoupon, isValidating, validationResult, clearValidation } = useCouponValidation();

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    const result = await validateCoupon(couponCode, {
      selectedPlan,
      selectedFeatures,
      purchaseValue,
      subscriptionMonths,
    });

    if (result.isValid && result.coupon) {
      setAppliedCoupon(result.coupon);
      onCouponApplied?.(result.coupon, result.discountAmount);
    } else {
      setAppliedCoupon(null);
      onCouponApplied?.(null, 0);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode("");
    setAppliedCoupon(null);
    clearValidation();
    onCouponApplied?.(null, 0);
  };

  const formatDiscount = (coupon: ValidatedCoupon) => {
    if (coupon.discount_type === "percentage") {
      return `${coupon.discount_value}%`;
    }
    return `R$ ${coupon.discount_value.toFixed(2)}`;
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="Código do cupom"
            className="pl-10 uppercase"
            disabled={!!appliedCoupon || isValidating}
            onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
          />
        </div>
        {appliedCoupon ? (
          <Button
            variant="outline"
            size="icon"
            onClick={handleRemoveCoupon}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleApplyCoupon}
            disabled={!couponCode.trim() || isValidating}
            className="shrink-0"
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Aplicar"
            )}
          </Button>
        )}
      </div>

      {/* Success State */}
      {appliedCoupon && validationResult?.isValid && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <Check className="h-4 w-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-700">
              Cupom aplicado: {appliedCoupon.name}
            </p>
            <p className="text-xs text-green-600/80">
              {appliedCoupon.discount_type === "percentage" ? (
                <span className="flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  {appliedCoupon.discount_value}% de desconto
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  R$ {appliedCoupon.discount_value.toFixed(2)} de desconto
                </span>
              )}
            </p>
          </div>
          <Badge variant="secondary" className="bg-green-500/20 text-green-700 shrink-0">
            -{formatDiscount(appliedCoupon)}
          </Badge>
        </div>
      )}

      {/* Error State */}
      {validationResult && !validationResult.isValid && validationResult.error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <X className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{validationResult.error}</p>
        </div>
      )}

      {/* Coupon Info */}
      {appliedCoupon && (
        <div className="text-xs text-muted-foreground space-y-1">
          {appliedCoupon.applicable_plans.length > 0 && (
            <p>
              Válido para planos:{" "}
              {appliedCoupon.applicable_plans
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join(", ")}
            </p>
          )}
          {appliedCoupon.applicable_features.length > 0 && (
            <p>
              Válido para funcionalidades:{" "}
              {appliedCoupon.applicable_features
                .map((f) => {
                  const featureLabels: Record<string, string> = {
                    whatsapp_reminders: "WhatsApp",
                    reports: "Relatórios",
                    commissions: "Comissões",
                    api_access: "API",
                    multi_units: "Multi-unidades",
                  };
                  return featureLabels[f] || f;
                })
                .join(", ")}
            </p>
          )}
          {appliedCoupon.min_months && appliedCoupon.min_months > 1 && (
            <p>Requer assinatura mínima de {appliedCoupon.min_months} meses</p>
          )}
        </div>
      )}
    </div>
  );
}
