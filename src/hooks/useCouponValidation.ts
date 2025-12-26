import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CouponValidationResult {
  isValid: boolean;
  coupon: ValidatedCoupon | null;
  error: string | null;
  discountAmount: number;
  discountPercentage: number;
}

export interface ValidatedCoupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  applies_to: string;
  applicable_plans: string[];
  applicable_features: string[];
  min_months: number | null;
}

interface ValidationParams {
  selectedPlan?: string;
  selectedFeatures?: string[];
  purchaseValue?: number;
  subscriptionMonths?: number;
}

export function useCouponValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<CouponValidationResult | null>(null);

  const validateCoupon = async (
    code: string,
    params: ValidationParams = {}
  ): Promise<CouponValidationResult> => {
    setIsValidating(true);

    const { selectedPlan, selectedFeatures = [], purchaseValue = 0, subscriptionMonths = 1 } = params;

    try {
      // Fetch the coupon from the database
      const { data: coupon, error } = await supabase
        .from("platform_coupons")
        .select("*")
        .eq("code", code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (error || !coupon) {
        const result: CouponValidationResult = {
          isValid: false,
          coupon: null,
          error: "Cupom não encontrado ou inativo",
          discountAmount: 0,
          discountPercentage: 0,
        };
        setValidationResult(result);
        setIsValidating(false);
        return result;
      }

      // Check valid date range
      const now = new Date();
      const validFrom = new Date(coupon.valid_from);
      const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;

      if (now < validFrom) {
        const result: CouponValidationResult = {
          isValid: false,
          coupon: null,
          error: "Este cupom ainda não está ativo",
          discountAmount: 0,
          discountPercentage: 0,
        };
        setValidationResult(result);
        setIsValidating(false);
        return result;
      }

      if (validUntil && now > validUntil) {
        const result: CouponValidationResult = {
          isValid: false,
          coupon: null,
          error: "Este cupom expirou",
          discountAmount: 0,
          discountPercentage: 0,
        };
        setValidationResult(result);
        setIsValidating(false);
        return result;
      }

      // Check max redemptions
      if (coupon.max_redemptions && coupon.current_redemptions >= coupon.max_redemptions) {
        const result: CouponValidationResult = {
          isValid: false,
          coupon: null,
          error: "Este cupom atingiu o limite de usos",
          discountAmount: 0,
          discountPercentage: 0,
        };
        setValidationResult(result);
        setIsValidating(false);
        return result;
      }

      // Check minimum months requirement
      if (coupon.min_months && subscriptionMonths < coupon.min_months) {
        const result: CouponValidationResult = {
          isValid: false,
          coupon: null,
          error: `Este cupom requer assinatura mínima de ${coupon.min_months} mês(es)`,
          discountAmount: 0,
          discountPercentage: 0,
        };
        setValidationResult(result);
        setIsValidating(false);
        return result;
      }

      // Check if coupon applies to the selected plan
      const applicablePlans = coupon.applicable_plans || [];
      if (selectedPlan && applicablePlans.length > 0 && !applicablePlans.includes(selectedPlan)) {
        const result: CouponValidationResult = {
          isValid: false,
          coupon: null,
          error: "Este cupom não é válido para o plano selecionado",
          discountAmount: 0,
          discountPercentage: 0,
        };
        setValidationResult(result);
        setIsValidating(false);
        return result;
      }

      // Check if coupon applies to selected features
      const applicableFeatures = coupon.applicable_features || [];
      if (applicableFeatures.length > 0 && selectedFeatures.length > 0) {
        const hasMatchingFeature = selectedFeatures.some((f) => applicableFeatures.includes(f));
        if (!hasMatchingFeature) {
          const result: CouponValidationResult = {
            isValid: false,
            coupon: null,
            error: "Este cupom não é válido para as funcionalidades selecionadas",
            discountAmount: 0,
            discountPercentage: 0,
          };
          setValidationResult(result);
          setIsValidating(false);
          return result;
        }
      }

      // Calculate discount
      let discountAmount = 0;
      let discountPercentage = 0;

      if (coupon.discount_type === "percentage") {
        discountPercentage = coupon.discount_value;
        discountAmount = (purchaseValue * coupon.discount_value) / 100;
      } else {
        discountAmount = coupon.discount_value;
        discountPercentage = purchaseValue > 0 ? (coupon.discount_value / purchaseValue) * 100 : 0;
      }

      const validatedCoupon: ValidatedCoupon = {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        applies_to: coupon.applies_to,
        applicable_plans: coupon.applicable_plans || [],
        applicable_features: coupon.applicable_features || [],
        min_months: coupon.min_months,
      };

      const result: CouponValidationResult = {
        isValid: true,
        coupon: validatedCoupon,
        error: null,
        discountAmount,
        discountPercentage,
      };

      setValidationResult(result);
      setIsValidating(false);
      return result;
    } catch (err) {
      const result: CouponValidationResult = {
        isValid: false,
        coupon: null,
        error: "Erro ao validar cupom. Tente novamente.",
        discountAmount: 0,
        discountPercentage: 0,
      };
      setValidationResult(result);
      setIsValidating(false);
      return result;
    }
  };

  const clearValidation = () => {
    setValidationResult(null);
  };

  return {
    validateCoupon,
    clearValidation,
    isValidating,
    validationResult,
  };
}
