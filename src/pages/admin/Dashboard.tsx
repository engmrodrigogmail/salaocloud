import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalEstablishments: number;
  activeEstablishments: number;
  pendingEstablishments: number;
  totalUsers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalEstablishments: 0,
    activeEstablishments: 0,
    pendingEstablishments: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch establishments
        const { data: establishments } = await supabase
          .from("establishments")
          .select("status");

        const total = establishments?.length || 0;
        const active = establishments?.filter((e) => e.status === "active").length || 0;
        const pending = establishments?.filter((e) => e.status === "pending").length || 0;

        // Fetch profiles count
        const { count: usersCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });

        setStats({
          totalEstablishments: total,
          activeEstablishments: active,
          pendingEstablishments: pending,
          totalUsers: usersCount || 0,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Total de Estabelecimentos",
      value: stats.totalEstablishments,
      icon: Building2,
      trend: "+12%",
      trendUp: true,
      color: "bg-primary",
    },
    {
      title: "Estabelecimentos Ativos",
      value: stats.activeEstablishments,
      icon: TrendingUp,
      trend: "+8%",
      trendUp: true,
      color: "bg-success",
    },
    {
      title: "Aguardando Aprovação",
      value: stats.pendingEstablishments,
      icon: Building2,
      trend: stats.pendingEstablishments > 0 ? "Pendente" : "OK",
      trendUp: stats.pendingEstablishments === 0,
      color: "bg-warning",
    },
    {
      title: "Total de Usuários",
      value: stats.totalUsers,
      icon: Users,
      trend: "+15%",
      trendUp: true,
      color: "bg-secondary",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Olá! Aqui está o resumo do Salão Cloud.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <Card key={stat.title} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {loading ? "..." : stat.value}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {stat.trendUp ? (
                    <ArrowUpRight className="h-4 w-4 text-success" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                  )}
                  <span
                    className={`text-sm ${
                      stat.trendUp ? "text-success" : "text-destructive"
                    }`}
                  >
                    {stat.trend}
                  </span>
                  <span className="text-sm text-muted-foreground">vs mês anterior</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma atividade recente</p>
              <p className="text-sm">
                As atividades dos estabelecimentos aparecerão aqui
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
