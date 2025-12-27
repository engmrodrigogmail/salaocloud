import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { InternoLayout } from "@/components/layouts/InternoLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock,
  Receipt,
  ShoppingCart,
} from "lucide-react";

interface Establishment {
  id: string;
  name: string;
  owner_id: string;
}

export default function InternoDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayStats, setTodayStats] = useState({
    pendingAppointments: 0,
    confirmedAppointments: 0,
    completedAppointments: 0,
    openCommands: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/interno/${slug}`);
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
        .select("id, name, owner_id")
        .eq("slug", slug)
        .single();

      if (error || !data) {
        navigate("/");
        return;
      }

      // TODO: Check if user is owner or has internal access
      // For now, only owner can access
      if (data.owner_id !== user?.id) {
        navigate("/");
        return;
      }

      setEstablishment(data);
      await fetchTodayStats(data.id);
    } catch (error) {
      console.error("Error fetching establishment:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayStats = async (establishmentId: string) => {
    const today = new Date().toISOString().split("T")[0];

    const { data: appointments } = await supabase
      .from("appointments")
      .select("status")
      .eq("establishment_id", establishmentId)
      .gte("scheduled_at", today)
      .lt("scheduled_at", today + "T23:59:59");

    const pending = appointments?.filter(a => a.status === "pending").length || 0;
    const confirmed = appointments?.filter(a => a.status === "confirmed").length || 0;
    const completed = appointments?.filter(a => a.status === "completed").length || 0;

    setTodayStats({
      pendingAppointments: pending,
      confirmedAppointments: confirmed,
      completedAppointments: completed,
      openCommands: 0, // TODO: Implement commands table
    });
  };

  if (authLoading || loading) {
    return (
      <InternoLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </InternoLayout>
    );
  }

  return (
    <InternoLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Painel Interno</h1>
          <p className="text-muted-foreground">
            Operação do dia - {establishment?.name}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/interno/${slug}/agenda`)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{todayStats.pendingAppointments}</div>
              <p className="text-xs text-muted-foreground">aguardando confirmação</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/interno/${slug}/agenda`)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Confirmados</CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{todayStats.confirmedAppointments}</div>
              <p className="text-xs text-muted-foreground">para hoje</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/interno/${slug}/agenda`)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
              <Calendar className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{todayStats.completedAppointments}</div>
              <p className="text-xs text-muted-foreground">finalizados hoje</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/interno/${slug}/comanda`)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Comandas Abertas</CardTitle>
              <Receipt className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-500">{todayStats.openCommands}</div>
              <p className="text-xs text-muted-foreground">em atendimento</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
              <CardDescription>Acesso rápido às funções mais usadas</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2"
                onClick={() => navigate(`/interno/${slug}/agenda`)}
              >
                <Calendar className="h-6 w-6" />
                <span>Ver Agenda</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2"
                onClick={() => navigate(`/interno/${slug}/comanda`)}
              >
                <Receipt className="h-6 w-6" />
                <span>Nova Comanda</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2"
                onClick={() => navigate(`/interno/${slug}/consumos`)}
              >
                <ShoppingCart className="h-6 w-6" />
                <span>Consumos</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2"
                onClick={() => navigate(`/interno/${slug}/cobranca`)}
              >
                <Receipt className="h-6 w-6" />
                <span>Cobrança</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </InternoLayout>
  );
}
