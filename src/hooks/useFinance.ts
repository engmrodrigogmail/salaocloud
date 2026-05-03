import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EntryType = "revenue" | "expense";
export type EntryStatus = "pending" | "paid";

export interface FinanceCategory {
  id: string;
  establishment_id: string;
  name: string;
  type: EntryType;
  is_system: boolean;
  is_active: boolean;
}

export interface FinanceEntry {
  id: string;
  establishment_id: string;
  category_id: string;
  type: EntryType;
  amount: number;
  description: string;
  date: string;
  payment_method: string | null;
  status: EntryStatus;
  paid_at: string | null;
  recurring_template_id: string | null;
  created_at: string;
}

export interface ConsolidatedRow {
  id: string;
  establishment_id: string;
  type: EntryType;
  amount: number;
  description: string;
  date: string;
  payment_method: string | null;
  status: EntryStatus;
  category_id: string | null;
  category_name: string;
  is_auto: boolean;
  source: "manual" | "tab_item" | "commission";
  source_ref_id: string | null;
}

export interface RecurringTemplate {
  id: string;
  establishment_id: string;
  category_id: string;
  type: EntryType;
  amount: number;
  description: string;
  day_of_month: number;
  is_active: boolean;
}

export interface FinanceSettings {
  establishment_id: string;
  commission_expense_trigger: "on_tab_close" | "on_commission_payment";
}

export function useFinance(establishmentId: string | null, from: string, to: string) {
  const [loading, setLoading] = useState(true);
  const [consolidated, setConsolidated] = useState<ConsolidatedRow[]>([]);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [recurring, setRecurring] = useState<RecurringTemplate[]>([]);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);

  const seedIfNeeded = useCallback(async () => {
    if (!establishmentId) return;
    const { count } = await supabase
      .from("finance_categories")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", establishmentId);
    if ((count ?? 0) === 0) {
      await supabase.rpc("seed_finance_categories", { _establishment_id: establishmentId });
    }
  }, [establishmentId]);

  const refresh = useCallback(async () => {
    if (!establishmentId) return;
    setLoading(true);
    await seedIfNeeded();

    const [cons, ents, cats, recs, sets] = await Promise.all([
      supabase
        .from("vw_finance_consolidated" as any)
        .select("*")
        .eq("establishment_id", establishmentId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false }),
      supabase
        .from("finance_entries")
        .select("*")
        .eq("establishment_id", establishmentId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false }),
      supabase
        .from("finance_categories")
        .select("*")
        .eq("establishment_id", establishmentId)
        .eq("is_active", true)
        .order("type")
        .order("name"),
      supabase
        .from("finance_recurring_templates")
        .select("*")
        .eq("establishment_id", establishmentId)
        .order("day_of_month"),
      supabase
        .from("finance_settings")
        .select("*")
        .eq("establishment_id", establishmentId)
        .maybeSingle(),
    ]);

    if (cons.data) setConsolidated(cons.data as any);
    if (ents.data) setEntries(ents.data as any);
    if (cats.data) setCategories(cats.data as any);
    if (recs.data) setRecurring(recs.data as any);
    if (sets.data) setSettings(sets.data as any);
    else if (establishmentId) {
      // garante settings
      await supabase.from("finance_settings").insert({ establishment_id: establishmentId }).select().maybeSingle();
    }
    setLoading(false);
  }, [establishmentId, from, to, seedIfNeeded]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveEntry = async (
    payload: Partial<FinanceEntry> & { id?: string },
    auditCtx?: { managerProfessionalId?: string; reason?: string },
  ) => {
    try {
      if (!establishmentId) return false;
      const { id, ...rest } = payload;
      const data = { ...rest, establishment_id: establishmentId } as any;
      let oldRow: any = null;
      if (id) {
        const { data: prev } = await supabase.from("finance_entries").select("*").eq("id", id).maybeSingle();
        oldRow = prev;
        const { error } = await supabase.from("finance_entries").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase.from("finance_entries").insert(data).select().single();
        if (error) throw error;
        if (auditCtx?.managerProfessionalId) {
          await supabase.from("manager_pin_audit").insert({
            establishment_id: establishmentId,
            manager_professional_id: auditCtx.managerProfessionalId,
            action_type: "finance_entry_create",
            target_type: "finance_entry",
            target_id: ins.id,
            new_value: ins,
            reason: auditCtx?.reason ?? null,
          });
        }
      }
      if (id && auditCtx?.managerProfessionalId) {
        await supabase.from("manager_pin_audit").insert({
          establishment_id: establishmentId,
          manager_professional_id: auditCtx.managerProfessionalId,
          action_type: "finance_entry_update",
          target_type: "finance_entry",
          target_id: id,
          old_value: oldRow,
          new_value: data,
          reason: auditCtx?.reason ?? null,
        });
      }
      toast.success(id ? "Lançamento atualizado" : "Lançamento criado");
      refresh();
      return true;
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
      return false;
    }
  };

  const deleteEntry = async (id: string, auditCtx?: { managerProfessionalId?: string; reason?: string }) => {
    try {
      const { data: prev } = await supabase.from("finance_entries").select("*").eq("id", id).maybeSingle();
      const { error } = await supabase.from("finance_entries").delete().eq("id", id);
      if (error) throw error;
      if (establishmentId && auditCtx?.managerProfessionalId) {
        await supabase.from("manager_pin_audit").insert({
          establishment_id: establishmentId,
          manager_professional_id: auditCtx.managerProfessionalId,
          action_type: "finance_entry_delete",
          target_type: "finance_entry",
          target_id: id,
          old_value: prev,
          reason: auditCtx?.reason ?? null,
        });
      }
      toast.success("Lançamento excluído");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir");
    }
  };

  const saveRecurring = async (payload: Partial<RecurringTemplate> & { id?: string }) => {
    if (!establishmentId) return false;
    const { id, ...rest } = payload;
    const data = { ...rest, establishment_id: establishmentId } as any;
    const op = id
      ? supabase.from("finance_recurring_templates").update(data).eq("id", id)
      : supabase.from("finance_recurring_templates").insert(data);
    const { error } = await op;
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(id ? "Recorrente atualizada" : "Recorrente criada");
    refresh();
    return true;
  };

  const deleteRecurring = async (id: string) => {
    const { error } = await supabase.from("finance_recurring_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Recorrente excluída");
    refresh();
  };

  const saveCategory = async (payload: { id?: string; name: string; type: EntryType }) => {
    if (!establishmentId) return false;
    const op = payload.id
      ? supabase
          .from("finance_categories")
          .update({ name: payload.name })
          .eq("id", payload.id)
      : supabase.from("finance_categories").insert({
          establishment_id: establishmentId,
          name: payload.name,
          type: payload.type,
          is_system: false,
        });
    const { error } = await op;
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Categoria salva");
    refresh();
    return true;
  };

  const deleteCategory = async (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (cat?.is_system) {
      toast.error("Categoria do sistema não pode ser excluída");
      return;
    }
    const { error } = await supabase.from("finance_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Categoria excluída");
    refresh();
  };

  const updateSettings = async (
    trigger: "on_tab_close" | "on_commission_payment",
  ) => {
    if (!establishmentId) return;
    const { error } = await supabase
      .from("finance_settings")
      .upsert({ establishment_id: establishmentId, commission_expense_trigger: trigger });
    if (error) return toast.error(error.message);
    toast.success("Configuração atualizada");
    refresh();
  };

  return {
    loading,
    consolidated,
    entries,
    categories,
    recurring,
    settings,
    refresh,
    saveEntry,
    deleteEntry,
    saveRecurring,
    deleteRecurring,
    saveCategory,
    deleteCategory,
    updateSettings,
  };
}
