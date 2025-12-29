import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrialCountdown } from "@/components/TrialCountdown";
import { 
  Calendar, 
  Users, 
  Scissors, 
  TrendingUp,
  Clock,
  DollarSign,
} from "lucide-react";

interface Establishment {
  id: string;
  name: string;
  owner_id: string;
  trial_ends_at: string | null;
  subscription_plan: string;
}

export default function PortalDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAppointments: 0,
    todayAppointments: 0,
    totalClients: 0,
    totalServices: 0,
    totalProfessionals: 0,
    monthRevenue: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/portal/${slug}`);
      return;
    }

    if (slug && user) {
      fetchEstablishment();
    }
  }, [slug, user, authLoading]);

  const fetchEstablishment = async () => {
    try {
      const { data, error } = await supabase
        .from("establishments")
        .select("id, name, owner_id, trial_ends_at, subscription_plan")
        .eq("slug", slug)
        .single();

      if (error || !data) {
        navigate("/");
        return;
      }

      // Check if user is the owner
      if (data.owner_id !== user?.id) {
        navigate("/");
        return;
      }

      setEstablishment(data);
      await fetchStats(data.id);
    } catch (error) {
      console.error("Error fetching establishment:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (establishmentId: string) => {
    const today = new Date().toISOString().split("T")[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [
      appointmentsResult,
      todayAppointmentsResult,
      clientsResult,
      servicesResult,
      professionalsResult,
      revenueResult,
    ] = await Promise.all([
      supabase.from("appointments").select("id", { count: "exact" }).eq("establishment_id", establishmentId),
      supabase.from("appointments").select("id", { count: "exact" }).eq("establishment_id", establishmentId).gte("scheduled_at", today).lt("scheduled_at", today + "T23:59:59"),
      supabase.from("clients").select("id", { count: "exact" }).eq("establishment_id", establishmentId),
      supabase.from("services").select("id", { count: "exact" }).eq("establishment_id", establishmentId).eq("is_active", true),
      supabase.from("professionals").select("id", { count: "exact" }).eq("establishment_id", establishmentId).eq("is_active", true),
      supabase.from("appointments").select("price").eq("establishment_id", establishmentId).eq("status", "completed").gte("scheduled_at", firstDayOfMonth),
    ]);

    const monthRevenue = revenueResult.data?.reduce((sum, app) => sum + (app.price || 0), 0) || 0;

    setStats({
      totalAppointments: appointmentsResult.count || 0,
      todayAppointments: todayAppointmentsResult.count || 0,
      totalClients: clientsResult.count || 0,
      totalServices: servicesResult.count || 0,
      totalProfessionals: professionalsResult.count || 0,
      monthRevenue,
    });
  };

  if (authLoading || loading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <TrialCountdown 
          trialEndsAt={establishment?.trial_ends_at || null} 
          subscriptionPlan={establishment?.subscription_plan || ""} 
        />
        
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do {establishment?.name}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Agendamentos Hoje</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayAppointments}</div>
              <p className="text-xs text-muted-foreground">agendados para hoje</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Agendamentos</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAppointments}</div>
              <p className="text-xs text-muted-foreground">agendamentos realizados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Faturamento do Mês</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.monthRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">em serviços concluídos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">clientes cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Serviços</CardTitle>
              <Scissors className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalServices}</div>
              <p className="text-xs text-muted-foreground">serviços ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Profissionais</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProfessionals}</div>
              <p className="text-xs text-muted-foreground">profissionais ativos</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
