import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PaymentMethod } from "@/types/tabs";

export function usePaymentMethods(establishmentId: string | null) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPaymentMethods = useCallback(async () => {
    if (!establishmentId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("establishment_id", establishmentId)
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      setPaymentMethods((data as PaymentMethod[]) || []);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  const createPaymentMethod = async (methodData: {
    name: string;
    type: PaymentMethod['type'];
    allows_installments?: boolean;
    max_installments?: number;
    has_interest?: boolean;
    interest_rate?: number;
  }) => {
    if (!establishmentId) return null;

    try {
      const { data, error } = await supabase
        .from("payment_methods")
        .insert({
          establishment_id: establishmentId,
          name: methodData.name,
          type: methodData.type,
          allows_installments: methodData.allows_installments || false,
          max_installments: methodData.max_installments || 1,
          has_interest: methodData.has_interest || false,
          interest_rate: methodData.interest_rate || 0,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Forma de pagamento criada");
      await fetchPaymentMethods();
      return data as PaymentMethod;
    } catch (error) {
      console.error("Error creating payment method:", error);
      toast.error("Erro ao criar forma de pagamento");
      return null;
    }
  };

  const updatePaymentMethod = async (methodId: string, updates: Partial<PaymentMethod>) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update(updates)
        .eq("id", methodId);

      if (error) throw error;
      toast.success("Forma de pagamento atualizada");
      await fetchPaymentMethods();
      return true;
    } catch (error) {
      console.error("Error updating payment method:", error);
      toast.error("Erro ao atualizar forma de pagamento");
      return false;
    }
  };

  const deletePaymentMethod = async (methodId: string) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_active: false })
        .eq("id", methodId);

      if (error) throw error;
      toast.success("Forma de pagamento removida");
      await fetchPaymentMethods();
      return true;
    } catch (error) {
      console.error("Error deleting payment method:", error);
      toast.error("Erro ao remover forma de pagamento");
      return false;
    }
  };

  useEffect(() => {
    if (establishmentId) {
      fetchPaymentMethods();
    }
  }, [establishmentId, fetchPaymentMethods]);

  return {
    paymentMethods,
    loading,
    fetchPaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
  };
}
