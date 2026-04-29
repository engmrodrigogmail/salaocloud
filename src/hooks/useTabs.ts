import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tab, TabWithDetails, TabItem, TabPayment } from "@/types/tabs";
import { useCommissionCalculator } from "./useCommissionCalculator";
import { getBrazilNow } from "@/lib/dateUtils";

export function useTabs(establishmentId: string | null) {
  const { processTabCommissions } = useCommissionCalculator(establishmentId);
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
    service_id?: string;
    notes?: string;
  }) => {
    if (!establishmentId) return null;

    try {
      let appointmentId = tabData.appointment_id;

      // Auto-create an "in_service" appointment to block the professional's agenda
      // when the tab is opened with a professional and a service selected.
      if (!appointmentId && tabData.professional_id && tabData.service_id) {
        // Fetch service info (duration + price)
        const { data: svc, error: svcError } = await supabase
          .from("services")
          .select("duration_minutes, price")
          .eq("id", tabData.service_id)
          .single();

        if (svcError || !svc) {
          toast.error("Serviço inválido. Não foi possível abrir a comanda.");
          return null;
        }

        const duration = svc.duration_minutes ?? 60;
        const price = svc.price ?? 0;

        // Use Brazil wall-clock for scheduled_at consistency
        const startBrazil = getBrazilNow();
        const endBrazil = new Date(startBrazil.getTime() + duration * 60 * 1000);

        // Conflict check: any active appointment for this professional overlapping our window?
        const { data: conflicts, error: conflictError } = await supabase
          .from("appointments")
          .select("id, scheduled_at, duration_minutes, status, client_name")
          .eq("establishment_id", establishmentId)
          .eq("professional_id", tabData.professional_id)
          .in("status", ["pending", "confirmed", "in_service"])
          .gte("scheduled_at", new Date(startBrazil.getTime() - 4 * 60 * 60 * 1000).toISOString())
          .lte("scheduled_at", endBrazil.toISOString());

        if (conflictError) {
          console.error("Error checking conflicts:", conflictError);
          toast.error("Erro ao verificar conflitos na agenda. Operação cancelada.");
          return null;
        }

        const hasConflict = (conflicts || []).some((apt: any) => {
          const aptStart = new Date(apt.scheduled_at).getTime();
          const aptEnd = aptStart + (apt.duration_minutes || 0) * 60 * 1000;
          return aptStart < endBrazil.getTime() && aptEnd > startBrazil.getTime();
        });

        if (hasConflict) {
          toast.error("Profissional já tem outro atendimento neste horário. Comanda não foi aberta.");
          return null;
        }

        // Resolve client phone: if a registered client was selected, propagate from DB
        let clientPhone = "";
        if (tabData.client_id) {
          const { data: cli } = await supabase
            .from("clients")
            .select("phone")
            .eq("id", tabData.client_id)
            .maybeSingle();
          clientPhone = cli?.phone ?? "";
        }

        const { data: appt, error: apptError } = await supabase
          .from("appointments")
          .insert({
            establishment_id: establishmentId,
            client_id: tabData.client_id ?? null,
            client_name: tabData.client_name,
            client_phone: clientPhone,
            service_id: tabData.service_id,
            professional_id: tabData.professional_id,
            scheduled_at: startBrazil.toISOString(),
            duration_minutes: duration,
            price,
            status: "in_service",
          })
          .select("id")
          .single();

        if (apptError || !appt) {
          console.error("Error creating linked appointment:", apptError);
          toast.error("Não foi possível bloquear a agenda. Comanda não foi aberta.");
          return null;
        }

        appointmentId = appt.id;
      }

      const { data, error } = await supabase
        .from("tabs")
        .insert({
          establishment_id: establishmentId,
          client_name: tabData.client_name,
          client_id: tabData.client_id,
          appointment_id: appointmentId,
          professional_id: tabData.professional_id,
          notes: tabData.notes,
          status: "open",
          subtotal: 0,
          total: 0,
        })
        .select()
        .single();

      if (error) {
        // Rollback: if we created an appointment for this tab, mark it cancelled
        if (appointmentId && !tabData.appointment_id) {
          await supabase
            .from("appointments")
            .update({ status: "cancelled" })
            .eq("id", appointmentId);
        }
        throw error;
      }
      toast.success("Comanda aberta com sucesso");
      await fetchTabs("open");
      return { ...(data as Tab), appointment_id: appointmentId } as Tab;
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

  const closeTab = async (tabId: string, payments: Omit<TabPayment, 'id' | 'tab_id' | 'created_at'>[], items: TabItem[] = []) => {
    try {
      // Insert payments
      if (payments.length > 0) {
        const { error: paymentsError } = await supabase
          .from("tab_payments")
          .insert(payments.map(p => ({ ...p, tab_id: tabId })));
        if (paymentsError) throw paymentsError;
      }

      // Calculate and save commissions automatically
      if (items.length > 0) {
        const result = await processTabCommissions(tabId, items);
        if (result.count > 0) {
          console.log(`Generated ${result.count} commission(s) totaling R$ ${result.total.toFixed(2)}`);
        }
      }

      // Close tab
      const { data: closedTab, error } = await supabase
        .from("tabs")
        .update({ 
          status: "closed",
          closed_at: new Date().toISOString()
        })
        .eq("id", tabId)
        .select("appointment_id")
        .single();

      if (error) throw error;

      // App-layer sync: mark linked appointment as completed (only if not already cancelled)
      if (closedTab?.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "completed" })
          .eq("id", closedTab.appointment_id)
          .neq("status", "cancelled");
      }

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
      const { data: cancelledTab, error } = await supabase
        .from("tabs")
        .update({ status: "cancelled" })
        .eq("id", tabId)
        .select("appointment_id")
        .single();

      if (error) throw error;

      // App-layer sync: cancel linked appointment to free the slot (only if still active)
      if (cancelledTab?.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "cancelled" })
          .eq("id", cancelledTab.appointment_id)
          .in("status", ["pending", "confirmed", "in_service"]);
      }

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

/**
 * Sync linked appointment's duration and price with the sum of service items
 * in this tab. Keeps the agenda block accurate as services are added/removed.
 */
async function syncAppointmentFromServiceItems(tabId: string) {
  try {
    const { data: tab } = await supabase
      .from("tabs")
      .select("appointment_id")
      .eq("id", tabId)
      .maybeSingle();

    if (!tab?.appointment_id) return;

    // Sum durations of all service items in this tab
    const { data: serviceItems } = await supabase
      .from("tab_items")
      .select("service_id, total_price, quantity")
      .eq("tab_id", tabId)
      .eq("item_type", "service");

    if (!serviceItems || serviceItems.length === 0) return;

    const serviceIds = Array.from(
      new Set(serviceItems.map((it: any) => it.service_id).filter(Boolean))
    );
    if (serviceIds.length === 0) return;

    const { data: services } = await supabase
      .from("services")
      .select("id, duration_minutes")
      .in("id", serviceIds);

    const durationById = new Map(
      (services || []).map((s: any) => [s.id, s.duration_minutes ?? 0])
    );

    let totalDuration = 0;
    let totalPrice = 0;
    for (const it of serviceItems as any[]) {
      const qty = Number(it.quantity) || 1;
      totalDuration += (durationById.get(it.service_id) ?? 0) * qty;
      totalPrice += Number(it.total_price) || 0;
    }

    if (totalDuration <= 0) return;

    await supabase
      .from("appointments")
      .update({
        duration_minutes: totalDuration,
        price: totalPrice,
      })
      .eq("id", tab.appointment_id)
      .in("status", ["pending", "confirmed", "in_service"]);
  } catch (e) {
    console.error("Error syncing appointment from items:", e);
  }
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
      // Keep linked appointment's duration/price in sync when services change
      if (itemData.item_type === "service") {
        await syncAppointmentFromServiceItems(tabId);
      }
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
      if (tabId) await syncAppointmentFromServiceItems(tabId);
      return true;
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Erro ao atualizar item");
      return false;
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      // Detect if removed item is a service to decide if we resync
      const { data: removed } = await supabase
        .from("tab_items")
        .select("item_type")
        .eq("id", itemId)
        .maybeSingle();

      const { error } = await supabase
        .from("tab_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      await fetchItems();
      if (tabId && removed?.item_type === "service") {
        await syncAppointmentFromServiceItems(tabId);
      }
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
