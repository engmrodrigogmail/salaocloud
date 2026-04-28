import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Calendar, Clock, User, LogOut, Loader2, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import type { Tables } from "@/integrations/supabase/types";

type Appointment = Tables<"appointments"> & {
  services?: { name: string } | null;
  professionals?: { name: string } | null;
  establishments?: { name: string } | null;
};

interface HistoryTab {
  id: string;
  closed_at: string;
  total: number;
  establishment_name: string;
  items: {
    id: string;
    name: string;
    item_type: string;
    quantity: number;
    total_price: number;
    professional_name?: string | null;
  }[];
  payments: { id: string; payment_method_name: string; amount: number }[];
}

const ClientDashboard = () => {
  const { user, signOut } = useAuth();
  const { isImpersonating } = useImpersonation();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [history, setHistory] = useState<HistoryTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAppointments();
      fetchHistory();
    }
  }, [user]);

  const fetchAppointments = async () => {
    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (!clientData) {
        setAppointments([]);
        return;
      }
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          services:service_id(name),
          professionals:professional_id(name),
          establishments:establishment_id(name)
        `)
        .eq("client_id", clientData.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user?.id);
      const ids = (clients || []).map(c => c.id);
      if (ids.length === 0) {
        setHistory([]);
        return;
      }
      const { data: tabs, error } = await supabase
        .from("tabs")
        .select(`
          id, closed_at, total,
          establishments:establishment_id ( name ),
          tab_items ( id, name, item_type, quantity, total_price, professionals:professional_id ( name ) ),
          tab_payments ( id, payment_method_name, amount )
        `)
        .in("client_id", ids)
        .eq("status", "closed")
        .order("closed_at", { ascending: false });
      if (error) throw error;
      const mapped: HistoryTab[] = (tabs || []).map((t: any) => ({
        id: t.id,
        closed_at: t.closed_at,
        total: Number(t.total || 0),
        establishment_name: t.establishments?.name || "Salão",
        items: (t.tab_items || []).map((it: any) => ({
          id: it.id,
          name: it.name,
          item_type: it.item_type,
          quantity: Number(it.quantity || 1),
          total_price: Number(it.total_price || 0),
          professional_name: it.professionals?.name || null,
        })),
        payments: (t.tab_payments || []).map((p: any) => ({
          id: p.id,
          payment_method_name: p.payment_method_name,
          amount: Number(p.amount || 0),
        })),
      }));
      setHistory(mapped);
    } catch (err: any) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      confirmed: { label: "Confirmado", variant: "default" },
      in_service: { label: "Em atendimento", variant: "default" },
      completed: { label: "Concluído", variant: "outline" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const { label, variant } = variants[status] || { label: status, variant: "outline" as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);
      if (error) throw error;
      toast.success("Agendamento cancelado");
      fetchAppointments();
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast.error("Erro ao cancelar agendamento");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <ImpersonationBanner />

      <header className={`bg-card/80 backdrop-blur-sm border-b border-border sticky z-50 ${isImpersonating ? 'top-10' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-display font-bold text-foreground">Minha Conta</h1>
          {!isImpersonating && (
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Tabs defaultValue="agendamentos" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="agendamentos"><Calendar className="h-4 w-4 mr-1" /> Agendamentos</TabsTrigger>
            <TabsTrigger value="historico"><History className="h-4 w-4 mr-1" /> Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="agendamentos" className="mt-4">
            {appointments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Nenhum agendamento encontrado</h2>
                  <p className="text-muted-foreground mb-4">
                    {isImpersonating
                      ? "Este perfil ainda não possui nenhum agendamento registrado."
                      : "Você ainda não possui nenhum agendamento registrado."}
                  </p>
                  {!isImpersonating && <Button onClick={() => navigate("/")}>Fazer um Agendamento</Button>}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <Card key={appointment.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{appointment.services?.name || "Serviço"}</h3>
                            {getStatusBadge(appointment.status)}
                          </div>
                          <p className="text-muted-foreground">{appointment.establishments?.name || "Estabelecimento"}</p>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(appointment.scheduled_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {format(new Date(appointment.scheduled_at), "HH:mm")}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {appointment.professionals?.name || "Profissional"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-bold text-accent text-lg">R$ {Number(appointment.price).toFixed(2)}</p>
                          {appointment.status === "pending" && !isImpersonating && (
                            <Button variant="destructive" size="sm" onClick={() => handleCancelAppointment(appointment.id)}>
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            {loadingHistory ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : history.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Nenhum atendimento finalizado</h2>
                  <p className="text-muted-foreground">Quando seus atendimentos forem concluídos, eles aparecerão aqui.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {history.map((tab) => (
                  <Card key={tab.id}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-semibold">{tab.establishment_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tab.closed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Badge className="text-base">R$ {tab.total.toFixed(2)}</Badge>
                      </div>
                      <Separator />
                      <div className="space-y-1.5">
                        {tab.items.map((it) => (
                          <div key={it.id} className="flex items-center justify-between text-sm">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{it.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({it.item_type === "service" ? "Serviço" : it.item_type === "product" ? "Produto" : "Item"})
                                {it.quantity > 1 && ` × ${it.quantity}`}
                                {it.professional_name && ` • ${it.professional_name}`}
                              </span>
                            </div>
                            <span className="tabular-nums">R$ {it.total_price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      {tab.payments.length > 0 && (
                        <>
                          <Separator />
                          <p className="text-xs text-muted-foreground">
                            Pago via: {tab.payments.map(p => `${p.payment_method_name} (R$ ${p.amount.toFixed(2)})`).join(" • ")}
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ClientDashboard;
