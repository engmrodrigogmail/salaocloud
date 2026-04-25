import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import {
  Calendar,
  Users,
  Scissors,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";


interface Appointment {
  id: string;
  client_name: string;
  scheduled_at: string;
  service_id: string;
  status: string;
}

export default function EstablishmentDashboard() {
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    totalAppointments: 0,
    totalClients: 0,
    totalServices: 0,
    totalProfessionals: 0,
  });
  const [establishment, setEstablishment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch establishment
        const { data: estData } = await supabase
          .from("establishments")
          .select("*")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (!estData) {
          navigate("/onboarding");
          return;
        }

        setEstablishment(estData);

        // Fetch stats
        const [appointmentsRes, clientsRes, servicesRes, professionalsRes] = await Promise.all([
          supabase.from("appointments").select("*", { count: "exact", head: true }).eq("establishment_id", estData.id),
          supabase.from("clients").select("*", { count: "exact", head: true }).eq("establishment_id", estData.id),
          supabase.from("services").select("*", { count: "exact", head: true }).eq("establishment_id", estData.id),
          supabase.from("professionals").select("*", { count: "exact", head: true }).eq("establishment_id", estData.id),
        ]);

        setStats({
          totalAppointments: appointmentsRes.count || 0,
          totalClients: clientsRes.count || 0,
          totalServices: servicesRes.count || 0,
          totalProfessionals: professionalsRes.count || 0,
        });

        // Fetch today's appointments
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { data: appointments } = await supabase
          .from("appointments")
          .select("*")
          .eq("establishment_id", estData.id)
          .gte("scheduled_at", today.toISOString())
          .lt("scheduled_at", tomorrow.toISOString())
          .order("scheduled_at", { ascending: true });

        setTodayAppointments(appointments || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  const statCards = [
    {
      title: "Agendamentos",
      value: stats.totalAppointments,
      icon: Calendar,
      color: "bg-primary",
    },
    {
      title: "Clientes",
      value: stats.totalClients,
      icon: Users,
      color: "bg-success",
    },
    {
      title: "Serviços",
      value: stats.totalServices,
      icon: Scissors,
      color: "bg-secondary",
    },
    {
      title: "Profissionais",
      value: stats.totalProfessionals,
      icon: Users,
      color: "bg-accent",
    },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">
              Olá! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Bem-vindo ao painel do {establishment?.name || "seu salão"}
            </p>
          </div>
          <Button
            className="bg-gradient-gold hover:opacity-90"
            onClick={() => navigate("/dashboard/agenda")}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Ver Agenda
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Today's appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Agendamentos de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum agendamento para hoje</p>
                <p className="text-sm">Aproveite para relaxar! 😎</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium">
                        {appointment.client_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{appointment.client_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(appointment.scheduled_at), "HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {appointment.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links if no data */}
        {stats.totalServices === 0 && (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-center">
                <Scissors className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Comece cadastrando seus serviços</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Adicione os serviços que você oferece para seus clientes poderem agendar
                </p>
                <Button onClick={() => navigate("/dashboard/servicos")}>
                  Adicionar Serviços
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
