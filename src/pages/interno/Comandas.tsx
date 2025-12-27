import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { CheckoutDialog } from "@/components/tabs/CheckoutDialog";
import type { TabWithDetails, TabPayment } from "@/types/tabs";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type Service = Tables<"services">;
type Professional = Tables<"professionals">;

export default function InternoComandas() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  
  const [selectedTab, setSelectedTab] = useState<TabWithDetails | null>(null);
  const [newTabOpen, setNewTabOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeView, setActiveView] = useState<"open" | "history">("open");

  const { tabs, fetchTabs, createTab, closeTab, cancelTab, recalculateTotal } = useTabs(establishmentId);
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

  const fetchEstablishment = async () => {
    try {
      const { data } = await supabase
        .from("establishments")
        .select("id")
        .eq("slug", slug)
        .single();
      if (!data) { navigate("/"); return; }
      setEstablishmentId(data.id);
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

  const handleCreateTab = async (data: { client_name: string; client_id?: string; professional_id?: string; notes?: string }) => {
    const tab = await createTab(data);
    if (tab) { setNewTabOpen(false); setSelectedTab(tab as TabWithDetails); }
  };

  const handleAddItem = async (itemData: any) => {
    const item = await addItem(itemData);
    if (item && selectedTab) {
      await recalculateTotal(selectedTab.id);
      const { data } = await supabase.from("tabs").select("*").eq("id", selectedTab.id).single();
      if (data) setSelectedTab({ ...selectedTab, ...data });
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeItem(itemId);
    if (selectedTab) {
      await recalculateTotal(selectedTab.id);
      const { data } = await supabase.from("tabs").select("*").eq("id", selectedTab.id).single();
      if (data) setSelectedTab({ ...selectedTab, ...data });
    }
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    await updateItem(itemId, { quantity, total_price: item.unit_price * quantity });
    if (selectedTab) {
      await recalculateTotal(selectedTab.id);
      const { data } = await supabase.from("tabs").select("*").eq("id", selectedTab.id).single();
      if (data) setSelectedTab({ ...selectedTab, ...data });
    }
  };

  const handleCheckout = async (payments: Omit<TabPayment, 'id' | 'tab_id' | 'created_at'>[]) => {
    if (!selectedTab) return;
    const success = await closeTab(selectedTab.id, payments);
    if (success) { setCheckoutOpen(false); setSelectedTab(null); }
  };

  const handleCancelTab = async () => {
    if (!selectedTab) return;
    if (confirm("Tem certeza que deseja cancelar esta comanda?")) {
      await cancelTab(selectedTab.id);
      setSelectedTab(null);
    }
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

            <Tabs value={activeView} onValueChange={(v) => { setActiveView(v as "open" | "history"); fetchTabs(v === "open" ? "open" : "closed"); }}>
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
            onAddItem={() => setAddItemOpen(true)}
            onRemoveItem={handleRemoveItem}
            onUpdateQuantity={handleUpdateQuantity}
            onCheckout={() => setCheckoutOpen(true)}
            onBack={() => setSelectedTab(null)}
            onCancel={handleCancelTab}
            onRecalculate={async () => { await recalculateTotal(selectedTab.id); }}
          />
        )}

        <NewTabDialog open={newTabOpen} onOpenChange={setNewTabOpen} onSubmit={handleCreateTab} clients={clients} professionals={professionals} />
        <AddItemDialog open={addItemOpen} onOpenChange={setAddItemOpen} onAddItem={handleAddItem} products={products} services={services} professionals={professionals} />
        <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} tab={selectedTab} items={items} paymentMethods={paymentMethods} onConfirm={handleCheckout} />
      </div>
    </InternoLayout>
  );
}
