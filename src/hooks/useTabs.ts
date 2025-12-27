import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tab, TabWithDetails, TabItem, TabPayment } from "@/types/tabs";

export function useTabs(establishmentId: string | null) {
  const [tabs, setTabs] = useState<TabWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTabs = useCallback(async (status?: 'open' | 'closed' | 'cancelled') => {
    if (!establishmentId) return;

    setLoading(true);
    try {
      let query = supabase
        .from("tabs")
        .select(`
          *,
          professionals:professional_id(name),
          clients:client_id(name, phone)
        `)
        .eq("establishment_id", establishmentId)
        .order("opened_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTabs((data as TabWithDetails[]) || []);
    } catch (error) {
      console.error("Error fetching tabs:", error);
      toast.error("Erro ao carregar comandas");
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  const createTab = async (tabData: {
    client_name: string;
    client_id?: string;
    appointment_id?: string;
    professional_id?: string;
    notes?: string;
  }) => {
    if (!establishmentId) return null;

    try {
      const { data, error } = await supabase
        .from("tabs")
        .insert({
          establishment_id: establishmentId,
          client_name: tabData.client_name,
          client_id: tabData.client_id,
          appointment_id: tabData.appointment_id,
          professional_id: tabData.professional_id,
          notes: tabData.notes,
          status: "open",
          subtotal: 0,
          total: 0,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Comanda aberta com sucesso");
      await fetchTabs("open");
      return data as Tab;
    } catch (error) {
      console.error("Error creating tab:", error);
      toast.error("Erro ao abrir comanda");
      return null;
    }
  };

  const updateTab = async (tabId: string, updates: Partial<Tab>) => {
    try {
      const { error } = await supabase
        .from("tabs")
        .update(updates)
        .eq("id", tabId);

      if (error) throw error;
      await fetchTabs("open");
      return true;
    } catch (error) {
      console.error("Error updating tab:", error);
      toast.error("Erro ao atualizar comanda");
      return false;
    }
  };

  const closeTab = async (tabId: string, payments: Omit<TabPayment, 'id' | 'tab_id' | 'created_at'>[]) => {
    try {
      // Insert payments
      if (payments.length > 0) {
        const { error: paymentsError } = await supabase
          .from("tab_payments")
          .insert(payments.map(p => ({ ...p, tab_id: tabId })));
        if (paymentsError) throw paymentsError;
      }

      // Close tab
      const { error } = await supabase
        .from("tabs")
        .update({ 
          status: "closed",
          closed_at: new Date().toISOString()
        })
        .eq("id", tabId);

      if (error) throw error;
      toast.success("Comanda finalizada com sucesso");
      await fetchTabs("open");
      return true;
    } catch (error) {
      console.error("Error closing tab:", error);
      toast.error("Erro ao finalizar comanda");
      return false;
    }
  };

  const cancelTab = async (tabId: string) => {
    try {
      const { error } = await supabase
        .from("tabs")
        .update({ status: "cancelled" })
        .eq("id", tabId);

      if (error) throw error;
      toast.success("Comanda cancelada");
      await fetchTabs("open");
      return true;
    } catch (error) {
      console.error("Error cancelling tab:", error);
      toast.error("Erro ao cancelar comanda");
      return false;
    }
  };

  const recalculateTotal = async (tabId: string) => {
    try {
      const { data: items } = await supabase
        .from("tab_items")
        .select("total_price")
        .eq("tab_id", tabId);

      const subtotal = (items || []).reduce((acc, item) => acc + Number(item.total_price), 0);
      
      const { data: tab } = await supabase
        .from("tabs")
        .select("discount_amount, discount_type")
        .eq("id", tabId)
        .single();

      let discount = 0;
      if (tab?.discount_amount) {
        if (tab.discount_type === "percentage") {
          discount = subtotal * (Number(tab.discount_amount) / 100);
        } else {
          discount = Number(tab.discount_amount);
        }
      }

      const total = Math.max(0, subtotal - discount);

      await supabase
        .from("tabs")
        .update({ subtotal, total })
        .eq("id", tabId);

      return { subtotal, total };
    } catch (error) {
      console.error("Error recalculating total:", error);
      return null;
    }
  };

  useEffect(() => {
    if (establishmentId) {
      fetchTabs("open");
    }
  }, [establishmentId, fetchTabs]);

  return {
    tabs,
    loading,
    fetchTabs,
    createTab,
    updateTab,
    closeTab,
    cancelTab,
    recalculateTotal,
  };
}

export function useTabItems(tabId: string | null) {
  const [items, setItems] = useState<TabItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!tabId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tab_items")
        .select("*")
        .eq("tab_id", tabId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setItems((data as TabItem[]) || []);
    } catch (error) {
      console.error("Error fetching tab items:", error);
    } finally {
      setLoading(false);
    }
  }, [tabId]);

  const addItem = async (itemData: {
    name: string;
    unit_price: number;
    quantity: number;
    item_type: 'product' | 'service' | 'custom';
    product_id?: string;
    service_id?: string;
    professional_id?: string;
    description?: string;
  }) => {
    if (!tabId) return null;

    try {
      const total_price = itemData.unit_price * itemData.quantity;
      const { data, error } = await supabase
        .from("tab_items")
        .insert({
          tab_id: tabId,
          name: itemData.name,
          unit_price: itemData.unit_price,
          quantity: itemData.quantity,
          total_price,
          item_type: itemData.item_type,
          product_id: itemData.product_id,
          service_id: itemData.service_id,
          professional_id: itemData.professional_id,
          description: itemData.description,
        })
        .select()
        .single();

      if (error) throw error;
      await fetchItems();
      return data as TabItem;
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Erro ao adicionar item");
      return null;
    }
  };

  const updateItem = async (itemId: string, updates: Partial<TabItem>) => {
    try {
      const { error } = await supabase
        .from("tab_items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;
      await fetchItems();
      return true;
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Erro ao atualizar item");
      return false;
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("tab_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      await fetchItems();
      return true;
    } catch (error) {
      console.error("Error removing item:", error);
      toast.error("Erro ao remover item");
      return false;
    }
  };

  useEffect(() => {
    if (tabId) {
      fetchItems();
    }
  }, [tabId, fetchItems]);

  return {
    items,
    loading,
    fetchItems,
    addItem,
    updateItem,
    removeItem,
  };
}
