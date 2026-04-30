import { supabase } from "@/integrations/supabase/client";
import type { TabItem } from "@/types/tabs";

interface CommissionRule {
  id: string;
  name: string;
  commission_type: "fixed" | "percentage";
  commission_value: number;
  applies_to: string;
  applicable_service_ids: string[] | null;
  applicable_product_ids: string[] | null;
  is_active: boolean;
  is_challenge: boolean;
}

interface ProfessionalServiceCommission {
  professional_id: string;
  service_id: string;
  commission_type: "fixed" | "percentage";
  commission_value: number;
}

interface CalculatedCommission {
  professional_id: string;
  commission_rule_id: string | null;
  tab_item_id: string;
  reference_value: number;
  commission_amount: number;
  description: string;
}

export function useCommissionCalculator(establishmentId: string | null) {
  
  const fetchActiveRules = async (): Promise<CommissionRule[]> => {
    if (!establishmentId) return [];

    const { data, error } = await supabase
      .from("commission_rules")
      .select("*")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .eq("is_challenge", false);

    if (error) {
      console.error("Error fetching commission rules:", error);
      return [];
    }

    return (data || []) as CommissionRule[];
  };

  const fetchProfessionalServiceCommissions = async (
    professionalIds: string[]
  ): Promise<ProfessionalServiceCommission[]> => {
    if (professionalIds.length === 0) return [];

    const { data, error } = await supabase
      .from("professional_services")
      .select("professional_id, service_id, commission_type, commission_value")
      .in("professional_id", professionalIds);

    if (error) {
      console.error("Error fetching professional service commissions:", error);
      return [];
    }

    return (data || []).map(ps => ({
      professional_id: ps.professional_id,
      service_id: ps.service_id,
      commission_type: ps.commission_type as "fixed" | "percentage",
      commission_value: ps.commission_value,
    }));
  };

  const findApplicableRule = (
    item: TabItem,
    rules: CommissionRule[],
    itemProfessionalId: string | null
  ): CommissionRule | null => {
    // Priority order: specific_services/products > own_services > all_services > products
    
    // 1. Check specific services
    if (item.service_id) {
      const specificServiceRule = rules.find(
        (r) =>
          r.applies_to === "specific_services" &&
          r.applicable_service_ids?.includes(item.service_id!)
      );
      if (specificServiceRule) return specificServiceRule;
    }

    // 2. Check specific products
    if (item.product_id) {
      const specificProductRule = rules.find(
        (r) =>
          r.applies_to === "specific_products" &&
          r.applicable_product_ids?.includes(item.product_id!)
      );
      if (specificProductRule) return specificProductRule;
    }

    // 3. Check own_services (professional's own services)
    if (item.service_id && item.professional_id && itemProfessionalId === item.professional_id) {
      const ownServicesRule = rules.find((r) => r.applies_to === "own_services");
      if (ownServicesRule) return ownServicesRule;
    }

    // 4. Check all_services
    if (item.service_id) {
      const allServicesRule = rules.find((r) => r.applies_to === "all_services");
      if (allServicesRule) return allServicesRule;
    }

    // 5. Check products
    if (item.product_id) {
      const productsRule = rules.find((r) => r.applies_to === "products");
      if (productsRule) return productsRule;
    }

    return null;
  };

  const calculateCommission = (
    type: "fixed" | "percentage",
    value: number,
    referenceValue: number
  ): number => {
    if (type === "fixed") {
      return value;
    } else {
      return (referenceValue * value) / 100;
    }
  };

  const calculateCommissionsForTab = async (
    tabId: string,
    items: TabItem[]
  ): Promise<CalculatedCommission[]> => {
    // Get unique professional IDs from items
    const professionalIds = [...new Set(items
      .filter(item => item.professional_id)
      .map(item => item.professional_id!)
    )];

    // Fetch tab with new granular flags
    const { data: tab } = await supabase
      .from("tabs")
      .select("discount_amount, discount_type, subtotal, coupon_id, commission_discount_on_manual, commission_discount_on_coupon, commission_discount_on_loyalty")
      .eq("id", tabId)
      .maybeSingle();

    // Coupon scope (target + ids) drives pro-rata base
    let couponTarget: 'total' | 'services' | 'products' = 'total';
    let couponServiceIds: string[] = [];
    let couponProductIds: string[] = [];
    if ((tab as any)?.coupon_id) {
      const { data: coupon } = await supabase
        .from("discount_coupons")
        .select("discount_target, applicable_service_ids, applicable_product_ids")
        .eq("id", (tab as any).coupon_id)
        .maybeSingle();
      if (coupon) {
        couponTarget = (coupon.discount_target as any) || 'total';
        couponServiceIds = coupon.applicable_service_ids || [];
        couponProductIds = coupon.applicable_product_ids || [];
      }
    }

    const totalDiscount = Number((tab as any)?.discount_amount) || 0;
    const dType: string | null = (tab as any)?.discount_type || null;

    // Decide if this discount type reduces commission, using granular flags
    const reducesByType = (() => {
      if (totalDiscount <= 0) return false;
      if (dType === 'manual') return (tab as any)?.commission_discount_on_manual === true;
      if (dType === 'coupon') return (tab as any)?.commission_discount_on_coupon === true;
      if (dType === 'loyalty') return (tab as any)?.commission_discount_on_loyalty === true;
      // fallback (mixed/unknown): conservative true if any flag enabled
      return (tab as any)?.commission_discount_on_manual === true
          || (tab as any)?.commission_discount_on_coupon === true
          || (tab as any)?.commission_discount_on_loyalty === true;
    })();

    // Helper: is item in coupon scope?
    const itemInCouponScope = (item: TabItem): boolean => {
      if (couponTarget === 'total') return true;
      if (couponTarget === 'services') {
        if (!item.service_id) return false;
        return couponServiceIds.length === 0 || couponServiceIds.includes(item.service_id);
      }
      if (couponTarget === 'products') {
        if (!item.product_id) return false;
        return couponProductIds.length === 0 || couponProductIds.includes(item.product_id);
      }
      return true;
    };

    // Compute the eligible base for the discount (pro-rata over scope only)
    const eligibleBase = items.reduce((s, it) => {
      // Manual/loyalty discounts always apply on full subtotal (no scope)
      const inScope = dType === 'coupon' ? itemInCouponScope(it) : true;
      return s + (inScope ? Number(it.total_price) : 0);
    }, 0);

    const discountFactorScoped = reducesByType && eligibleBase > 0
      ? Math.max(0, 1 - totalDiscount / eligibleBase)
      : 1;

    // Fetch both commission rules and professional-specific commissions in parallel
    const [rules, psCommissions] = await Promise.all([
      fetchActiveRules(),
      fetchProfessionalServiceCommissions(professionalIds),
    ]);

    const commissions: CalculatedCommission[] = [];

    for (const item of items) {
      // Only calculate for items with a professional
      if (!item.professional_id) continue;

      const fullPrice = Number(item.total_price);
      const inScope = dType === 'coupon' ? itemInCouponScope(item) : true;
      const itemFactor = (reducesByType && inScope) ? discountFactorScoped : 1;
      const referenceValue = +(fullPrice * itemFactor).toFixed(2);
      let commissionAmount = 0;
      let description = "";
      let ruleId: string | null = null;

      // PRIORITY 1: Check for professional-specific service commission (from matrix)
      if (item.service_id) {
        const psCommission = psCommissions.find(
          ps => ps.professional_id === item.professional_id && ps.service_id === item.service_id
        );

        if (psCommission && psCommission.commission_value > 0) {
          commissionAmount = calculateCommission(
            psCommission.commission_type,
            psCommission.commission_value,
            referenceValue
          );
          description = `${item.name} (comissão específica)`;
        }
      }

      // PRIORITY 2: If no specific commission, fall back to commission rules
      if (commissionAmount === 0 && rules.length > 0) {
        const rule = findApplicableRule(item, rules, item.professional_id);
        if (rule) {
          commissionAmount = calculateCommission(
            rule.commission_type,
            rule.commission_value,
            referenceValue
          );
          description = `${item.name} (${rule.name})`;
          ruleId = rule.id;
        }
      }

      if (commissionAmount > 0) {
        commissions.push({
          professional_id: item.professional_id,
          commission_rule_id: ruleId,
          tab_item_id: item.id,
          reference_value: referenceValue,
          commission_amount: commissionAmount,
          description: reduces
            ? `${description} — base após desconto`
            : description,
        });
      }
    }

    return commissions;
  };

  const saveCommissions = async (
    commissions: CalculatedCommission[]
  ): Promise<boolean> => {
    if (!establishmentId || commissions.length === 0) return true;

    try {
      const commissionsToInsert = commissions.map((c) => ({
        establishment_id: establishmentId,
        professional_id: c.professional_id,
        commission_rule_id: c.commission_rule_id,
        tab_item_id: c.tab_item_id,
        reference_value: c.reference_value,
        commission_amount: c.commission_amount,
        description: c.description,
        status: "pending",
      }));

      const { error } = await supabase
        .from("professional_commissions")
        .insert(commissionsToInsert);

      if (error) {
        console.error("Error saving commissions:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error saving commissions:", error);
      return false;
    }
  };

  const processTabCommissions = async (
    tabId: string,
    items: TabItem[]
  ): Promise<{ success: boolean; count: number; total: number }> => {
    const commissions = await calculateCommissionsForTab(tabId, items);
    
    if (commissions.length === 0) {
      return { success: true, count: 0, total: 0 };
    }

    const success = await saveCommissions(commissions);
    const total = commissions.reduce((sum, c) => sum + c.commission_amount, 0);

    return {
      success,
      count: commissions.length,
      total,
    };
  };

  return {
    calculateCommissionsForTab,
    saveCommissions,
    processTabCommissions,
  };
}
