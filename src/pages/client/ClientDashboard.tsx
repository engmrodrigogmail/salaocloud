import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Clock, User, LogOut, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import type { Tables } from "@/integrations/supabase/types";

type Appointment = Tables<"appointments"> & {
  services?: { name: string } | null;
  professionals?: { name: string } | null;
  establishments?: { name: string } | null;
};

const ClientDashboard = () => {
  const { user, signOut } = useAuth();
  const { isImpersonating } = useImpersonation();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAppointments();
    }
  }, [user]);

  const fetchAppointments = async () => {
    try {
      // First get the client record for this user
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (clientError || !clientData) {
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      confirmed: { label: "Confirmado", variant: "default" },
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
      {/* Impersonation Banner */}
      <ImpersonationBanner />

      {/* Header */}
      <header className={`bg-card/80 backdrop-blur-sm border-b border-border sticky z-50 ${isImpersonating ? 'top-10' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-display font-bold text-foreground">Meus Agendamentos</h1>
          {!isImpersonating && (
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {appointments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Nenhum agendamento encontrado</h2>
              <p className="text-muted-foreground mb-4">
                {isImpersonating 
                  ? "Este perfil ainda não possui nenhum agendamento registrado."
                  : "Você ainda não possui nenhum agendamento registrado."
                }
              </p>
              {!isImpersonating && (
                <Button onClick={() => navigate("/")}>Fazer um Agendamento</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <Card key={appointment.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">
                          {appointment.services?.name || "Serviço"}
                        </h3>
                        {getStatusBadge(appointment.status)}
                      </div>
                      <p className="text-muted-foreground">
                        {appointment.establishments?.name || "Estabelecimento"}
                      </p>
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
                      <p className="font-bold text-accent text-lg">
                        R$ {Number(appointment.price).toFixed(2)}
                      </p>
                      {appointment.status === "pending" && !isImpersonating && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancelAppointment(appointment.id)}
                        >
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
      </main>
    </div>
  );
};

export default ClientDashboard;
