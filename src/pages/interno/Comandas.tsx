import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { InternoLayout } from "@/components/layouts/InternoLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Receipt, History, AlertCircle } from "lucide-react";
import { useTabs, useTabItems } from "@/hooks/useTabs";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useProducts } from "@/hooks/useProducts";
import { NewTabDialog } from "@/components/tabs/NewTabDialog";
import { AddItemDialog } from "@/components/tabs/AddItemDialog";
import { TabDetailsCard } from "@/components/tabs/TabDetailsCard";
import { TabListCard } from "@/components/tabs/TabListCard";
import { CheckoutDialog, type CouponInfo, type CommissionDiscountFlags } from "@/components/tabs/CheckoutDialog";
import type { TabWithDetails, TabPayment } from "@/types/tabs";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type Service = Tables<"services">;
type Professional = Tables<"professionals">;

export default function InternoComandas() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [discountPinThreshold, setDiscountPinThreshold] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  
  const [selectedTab, setSelectedTab] = useState<TabWithDetails | null>(null);
  const [newTabOpen, setNewTabOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeView, setActiveView] = useState<"open" | "history">("open");

  const { tabs, fetchTabs, createTab, closeTab, cancelTab, undoTabOpening, recalculateTotal } = useTabs(establishmentId);
  const { items, fetchItems, addItem, updateItem, removeItem } = useTabItems(selectedTab?.id || null);
  const { paymentMethods } = usePaymentMethods(establishmentId);
  const { products } = useProducts(establishmentId);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/interno/${slug}/comandas`);
      return;
    }
    if (slug && user) fetchEstablishment();
  }, [slug, user, authLoading]);

  useEffect(() => {
    if (establishmentId) {
      fetchClients();
      fetchServices();
      fetchProfessionals();
    }
  }, [establishmentId]);

  // Auto-select tab when navigated from Agenda with state.openTabId
  const [pendingOpenTabId, setPendingOpenTabId] = useState<string | null>(
    (location.state as any)?.openTabId ?? null
  );
  useEffect(() => {
    if (!pendingOpenTabId || !tabs.length) return;
    const t = tabs.find(x => x.id === pendingOpenTabId);
    if (t) {
      setSelectedTab(t as TabWithDetails);
      setPendingOpenTabId(null);
      // Clear navigation state so refresh doesn't reselect
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [pendingOpenTabId, tabs]);

  // Appointment suggestions (pre-populated services from booking; client may have multiple
  // simultaneous appointments — load all sibling appointments and let the salon confirm one by one)
  type AppointmentSuggestion = {
    appointment_id: string;
    service_id: string;
    service_name: string;
    professional_id: string | null;
    professional_name: string | null;
    price: number;
  };
  const [allAppointmentSuggestions, setAllAppointmentSuggestions] = useState<AppointmentSuggestion[]>([]);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Reset dismissals when switching tabs
    setDismissedSuggestionIds(new Set());
  }, [selectedTab?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadSuggestions = async () => {
      setAllAppointmentSuggestions([]);
      if (!selectedTab?.appointment_id || selectedTab.status !== "open" || !establishmentId) return;

      // Load the originating appointment to discover the client + scheduled time
      const { data: rootAppt } = await supabase
        .from("appointments")
        .select("client_id, client_phone, scheduled_at")
        .eq("id", selectedTab.appointment_id)
        .maybeSingle();
      if (cancelled || !rootAppt) return;

      // Build query for sibling appointments (same client, same exact scheduled time)
      // Exclude cancelled/completed; include the root appointment itself.
      let q = supabase
        .from("appointments")
        .select("id, service_id, professional_id, price, scheduled_at, services:service_id(name), professionals:professional_id(name)")
        .eq("establishment_id", establishmentId)
        .eq("scheduled_at", (rootAppt as any).scheduled_at)
        .not("status", "in", "(cancelled,completed,no_show)");

      if ((rootAppt as any).client_id) {
        q = q.eq("client_id", (rootAppt as any).client_id);
      } else if ((rootAppt as any).client_phone) {
        q = q.eq("client_phone", (rootAppt as any).client_phone);
      } else {
        q = q.eq("id", selectedTab.appointment_id);
      }

      const { data: appts } = await q;
      if (cancelled || !appts) return;

      const list: AppointmentSuggestion[] = (appts as any[])
        .filter((a) => !!a.service_id)
        .map((a) => ({
          appointment_id: a.id as string,
          service_id: a.service_id as string,
          service_name: a.services?.name ?? "Serviço agendado",
          professional_id: a.professional_id ?? null,
          professional_name: a.professionals?.name ?? null,
          price: Number(a.price) || 0,
        }));

      setAllAppointmentSuggestions(list);
    };
    loadSuggestions();
    return () => { cancelled = true; };
  }, [selectedTab?.id, selectedTab?.appointment_id, selectedTab?.status, establishmentId]);

  // Hide suggestions whose service+professional is already in the tab items
  const isAlreadyAdded = (s: AppointmentSuggestion) => items.some(
    (it) => it.item_type === "service"
      && it.service_id === s.service_id
      && (it.professional_id ?? null) === (s.professional_id ?? null),
  );

  const appointmentSuggestions = allAppointmentSuggestions
    .filter((s) => !isAlreadyAdded(s))
    .filter((s) => !dismissedSuggestionIds.has(s.appointment_id));

  const dismissedSuggestions = allAppointmentSuggestions
    .filter((s) => !isAlreadyAdded(s))
    .filter((s) => dismissedSuggestionIds.has(s.appointment_id));

  const handleConfirmAppointmentService = async (suggestion: AppointmentSuggestion) => {
    if (!selectedTab) return;
    await handleAddItem({
      name: suggestion.service_name,
      unit_price: suggestion.price,
      quantity: 1,
      item_type: "service",
      service_id: suggestion.service_id,
      professional_id: suggestion.professional_id ?? undefined,
    });
    // If it was previously dismissed, clear that flag too
    setDismissedSuggestionIds((prev) => {
      if (!prev.has(suggestion.appointment_id)) return prev;
      const next = new Set(prev);
      next.delete(suggestion.appointment_id);
      return next;
    });
  };

  const handleDismissSuggestion = (appointmentId: string) => {
    setDismissedSuggestionIds((prev) => {
      const next = new Set(prev);
      next.add(appointmentId);
      return next;
    });
  };

  const handleRestoreSuggestion = (appointmentId: string) => {
    setDismissedSuggestionIds((prev) => {
      if (!prev.has(appointmentId)) return prev;
      const next = new Set(prev);
      next.delete(appointmentId);
      return next;
    });
  };


  const fetchEstablishment = async () => {
    try {
      const { data } = await supabase
        .from("establishments")
        .select("id, discount_pin_threshold_percent")
        .eq("slug", slug)
        .single();
      if (!data) { navigate("/"); return; }
      setEstablishmentId(data.id);
      const t = (data as any).discount_pin_threshold_percent;
      if (typeof t === "number") setDiscountPinThreshold(t);
    } catch { navigate("/"); } 
    finally { setLoading(false); }
  };

  const fetchClients = async () => {
    if (!establishmentId) return;
    const { data } = await supabase.from("clients").select("*").eq("establishment_id", establishmentId);
    setClients(data || []);
  };

  const fetchServices = async () => {
    if (!establishmentId) return;
    const { data } = await supabase.from("services").select("*").eq("establishment_id", establishmentId).eq("is_active", true);
    setServices(data || []);
  };

  const fetchProfessionals = async () => {
    if (!establishmentId) return;
    const { data } = await supabase.from("professionals").select("*").eq("establishment_id", establishmentId).eq("is_active", true);
    setProfessionals(data || []);
  };

  const handleCreateTab = async (data: { client_name: string; client_id?: string; professional_id?: string; service_id?: string; notes?: string }) => {
    const tab = await createTab(data);
    if (tab) { setNewTabOpen(false); setSelectedTab(tab as TabWithDetails); }
  };

  const handleAddItem = async (itemData: any) => {
    const item = await addItem(itemData);
    if (item && selectedTab) {
      await recalculateTotal(selectedTab.id);
      const { data } = await supabase.from("tabs").select("*").eq("id", selectedTab.id).single();
      if (data) setSelectedTab({ ...selectedTab, ...data, status: data.status as TabWithDetails['status'] });
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeItem(itemId);
    if (selectedTab) {
      await recalculateTotal(selectedTab.id);
      const { data } = await supabase.from("tabs").select("*").eq("id", selectedTab.id).single();
      if (data) setSelectedTab({ ...selectedTab, ...data, status: data.status as TabWithDetails['status'] });
    }
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    await updateItem(itemId, { quantity, total_price: item.unit_price * quantity });
    if (selectedTab) {
      await recalculateTotal(selectedTab.id);
      const { data } = await supabase.from("tabs").select("*").eq("id", selectedTab.id).single();
      if (data) setSelectedTab({ ...selectedTab, ...data, status: data.status as TabWithDetails['status'] });
    }
  };

  const handleCheckout = async (
    payments: Omit<TabPayment, 'id' | 'tab_id' | 'created_at'>[],
    couponInfo?: CouponInfo,
    flags?: CommissionDiscountFlags,
  ) => {
    if (!selectedTab) return;

    // Coupon application is fully handled by RPC `apply_coupon_to_tab` (which already
    // updates tabs.discount_amount/total) and the closing flow uses `close_tab_atomic`.
    // No manual subtotal/discount mutation here — avoids double-discount bugs.

    const success = await closeTab(selectedTab.id, payments, items, flags);
    if (success) { setCheckoutOpen(false); setSelectedTab(null); }
  };

  const handleCancelTab = async () => {
    if (!selectedTab) return;
    await cancelTab(selectedTab.id);
    setSelectedTab(null);
  };

  const handleUndoOpening = async () => {
    if (!selectedTab) return;
    const ok = await undoTabOpening(selectedTab.id);
    if (ok) setSelectedTab(null);
  };

  if (authLoading || loading) {
    return <InternoLayout><Skeleton className="h-96" /></InternoLayout>;
  }

  return (
    <InternoLayout>
      <div className="space-y-4">
        {!selectedTab ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Comandas</h1>
                <p className="text-muted-foreground text-sm">Gerencie as comandas do estabelecimento</p>
              </div>
              <Button onClick={() => setNewTabOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Comanda
              </Button>
            </div>

            <Tabs value={activeView} onValueChange={(v) => { setActiveView(v as "open" | "history"); fetchTabs(v === "open" ? "open" : "history"); }}>
              <TabsList>
                <TabsTrigger value="open" className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Abertas
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="open" className="space-y-3 mt-4">
                {tabs.filter(t => t.status === "open").length === 0 ? (
                  <Card><CardContent className="py-12 text-center text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma comanda aberta</p>
                  </CardContent></Card>
                ) : (
                  tabs.filter(t => t.status === "open").map(tab => (
                    <TabListCard key={tab.id} tab={tab} onClick={() => setSelectedTab(tab)} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-3 mt-4">
                {tabs.filter(t => t.status !== "open").length === 0 ? (
                  <Card><CardContent className="py-12 text-center text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma comanda no histórico</p>
                  </CardContent></Card>
                ) : (
                  tabs.filter(t => t.status !== "open").map(tab => (
                    <TabListCard key={tab.id} tab={tab} onClick={() => setSelectedTab(tab)} />
                  ))
                )}
              </TabsContent>
            </Tabs>

            {paymentMethods.length === 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-4 flex items-center gap-3 text-amber-800">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">Configure as formas de pagamento nas configurações do estabelecimento.</span>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <TabDetailsCard
            tab={selectedTab}
            items={items}
            establishmentId={establishmentId || ""}
            discountPinThreshold={discountPinThreshold}
            onAddItem={() => setAddItemOpen(true)}
            onRemoveItem={handleRemoveItem}
            onUpdateQuantity={handleUpdateQuantity}
            onCheckout={() => setCheckoutOpen(true)}
            onBack={() => setSelectedTab(null)}
            onCancel={handleCancelTab}
            onUndoOpening={handleUndoOpening}
            onRecalculate={async () => { await recalculateTotal(selectedTab.id); }}
            onDiscountChanged={async () => {
              const { data } = await supabase.from("tabs").select("*").eq("id", selectedTab.id).single();
              if (data) setSelectedTab({ ...selectedTab, ...data, status: data.status as TabWithDetails['status'] });
            }}
            appointmentSuggestions={appointmentSuggestions}
            onConfirmAppointmentService={handleConfirmAppointmentService}
            onDismissAppointmentSuggestion={handleDismissSuggestion}
          />
        )}

        <NewTabDialog open={newTabOpen} onOpenChange={setNewTabOpen} onSubmit={handleCreateTab} clients={clients} professionals={professionals} services={services} />
        <AddItemDialog open={addItemOpen} onOpenChange={setAddItemOpen} onAddItem={handleAddItem} products={products} services={services} professionals={professionals} establishmentId={establishmentId || undefined} defaultProfessionalId={selectedTab?.professional_id || null} />
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          tab={selectedTab}
          items={items}
          paymentMethods={paymentMethods}
          onConfirm={handleCheckout}
          establishmentId={establishmentId || undefined}
          discountPinThreshold={discountPinThreshold}
          onTabRefresh={async () => {
            if (!selectedTab) return;
            // Recalc total first so close_tab_atomic validates against fresh value
            await recalculateTotal(selectedTab.id);
            const { data } = await supabase.from("tabs").select("*").eq("id", selectedTab.id).single();
            if (data) setSelectedTab({ ...selectedTab, ...data, status: data.status as TabWithDetails['status'] });
          }}
        />
      </div>
    </InternoLayout>
  );
}
