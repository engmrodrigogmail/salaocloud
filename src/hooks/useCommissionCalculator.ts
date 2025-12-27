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
    rule: CommissionRule,
    referenceValue: number
  ): number => {
    if (rule.commission_type === "fixed") {
      return rule.commission_value;
    } else {
      return (referenceValue * rule.commission_value) / 100;
    }
  };

  const calculateCommissionsForTab = async (
    tabId: string,
    items: TabItem[]
  ): Promise<CalculatedCommission[]> => {
    const rules = await fetchActiveRules();
    if (rules.length === 0) return [];

    const commissions: CalculatedCommission[] = [];

    for (const item of items) {
      // Only calculate for items with a professional
      if (!item.professional_id) continue;

      const rule = findApplicableRule(item, rules, item.professional_id);
      if (!rule) continue;

      const referenceValue = item.total_price;
      const commissionAmount = calculateCommission(rule, referenceValue);

      if (commissionAmount > 0) {
        commissions.push({
          professional_id: item.professional_id,
          commission_rule_id: rule.id,
          tab_item_id: item.id,
          reference_value: referenceValue,
          commission_amount: commissionAmount,
          description: `${item.name} (${rule.name})`,
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
