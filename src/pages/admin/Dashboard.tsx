import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Link } from "react-router-dom";

interface Stats {
  totalEstablishments: number;
  activeEstablishments: number;
  pendingEstablishments: number;
  suspendedEstablishments: number;
  totalUsers: number;
  totalAppointments: number;
  totalRevenue: number;
  newUsersThisMonth: number;
  newEstablishmentsThisMonth: number;
}

interface RecentActivity {
  id: string;
  type: "establishment_created" | "user_registered" | "appointment_created" | "status_changed";
  description: string;
  created_at: string;
}

interface ChartData {
  name: string;
  establishments: number;
  users: number;
}

const COLORS = ["hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalEstablishments: 0,
    activeEstablishments: 0,
    pendingEstablishments: 0,
    suspendedEstablishments: 0,
    totalUsers: 0,
    totalAppointments: 0,
    totalRevenue: 0,
    newUsersThisMonth: 0,
    newEstablishmentsThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [recentEstablishments, setRecentEstablishments] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch establishments
      const { data: establishments } = await supabase
        .from("establishments")
        .select("*")
        .order("created_at", { ascending: false });

      const total = establishments?.length || 0;
      const active = establishments?.filter((e) => e.status === "active").length || 0;
      const pending = establishments?.filter((e) => e.status === "pending").length || 0;
      const suspended = establishments?.filter((e) => e.status === "suspended").length || 0;

      // Get recent establishments
      setRecentEstablishments(establishments?.slice(0, 5) || []);

      // Fetch profiles count
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch appointments count and revenue
      const { data: appointments } = await supabase
        .from("appointments")
        .select("price, created_at, status");

      const totalAppointments = appointments?.length || 0;
      const totalRevenue = appointments?.reduce((acc, a) => {
        if (a.status === "completed") return acc + (a.price || 0);
        return acc;
      }, 0) || 0;

      // Calculate new this month
      const startMonth = startOfMonth(new Date());
      const newUsersThisMonth = profiles?.filter(
        (p) => new Date(p.created_at) >= startMonth
      ).length || 0;
      const newEstablishmentsThisMonth = establishments?.filter(
        (e) => new Date(e.created_at) >= startMonth
      ).length || 0;

      // Generate chart data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        const dayStr = format(date, "dd/MM");
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));

        const estCount = establishments?.filter((e) => {
          const created = new Date(e.created_at);
          return created >= dayStart && created <= dayEnd;
        }).length || 0;

        const userCount = profiles?.filter((p) => {
          const created = new Date(p.created_at);
          return created >= dayStart && created <= dayEnd;
        }).length || 0;

        return {
          name: dayStr,
          establishments: estCount,
          users: userCount,
        };
      });

      setChartData(last7Days);

      // Create recent activities from data
      const activities: RecentActivity[] = [];
      
      establishments?.slice(0, 3).forEach((e) => {
        activities.push({
          id: e.id,
          type: "establishment_created",
          description: `Novo estabelecimento: ${e.name}`,
          created_at: e.created_at,
        });
      });

      profiles?.slice(0, 3).forEach((p) => {
        activities.push({
          id: p.id,
          type: "user_registered",
          description: `Novo usuário: ${p.full_name || "Sem nome"}`,
          created_at: p.created_at,
        });
      });

      // Sort by date
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentActivities(activities.slice(0, 10));

      setStats({
        totalEstablishments: total,
        activeEstablishments: active,
        pendingEstablishments: pending,
        suspendedEstablishments: suspended,
        totalUsers: profiles?.length || 0,
        totalAppointments,
        totalRevenue,
        newUsersThisMonth,
        newEstablishmentsThisMonth,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: "Ativos", value: stats.activeEstablishments },
    { name: "Pendentes", value: stats.pendingEstablishments },
    { name: "Suspensos", value: stats.suspendedEstablishments },
  ].filter((d) => d.value > 0);

  const statCards = [
    {
      title: "Total de Estabelecimentos",
      value: stats.totalEstablishments,
      icon: Building2,
      trend: stats.newEstablishmentsThisMonth,
      trendLabel: "este mês",
      trendUp: true,
      color: "bg-primary",
    },
    {
      title: "Estabelecimentos Ativos",
      value: stats.activeEstablishments,
      icon: CheckCircle,
      trend: Math.round((stats.activeEstablishments / Math.max(stats.totalEstablishments, 1)) * 100),
      trendLabel: "% do total",
      trendUp: true,
      color: "bg-success",
    },
    {
      title: "Aguardando Aprovação",
      value: stats.pendingEstablishments,
      icon: Clock,
      trend: stats.pendingEstablishments,
      trendLabel: stats.pendingEstablishments > 0 ? "precisam de atenção" : "tudo ok",
      trendUp: stats.pendingEstablishments === 0,
      color: "bg-warning",
    },
    {
      title: "Total de Usuários",
      value: stats.totalUsers,
      icon: Users,
      trend: stats.newUsersThisMonth,
      trendLabel: "este mês",
      trendUp: true,
      color: "bg-secondary",
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "establishment_created":
        return <Building2 className="h-4 w-4 text-primary" />;
      case "user_registered":
        return <Users className="h-4 w-4 text-success" />;
      case "appointment_created":
        return <Calendar className="h-4 w-4 text-secondary" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>;
      case "pending":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pendente</Badge>;
      case "suspended":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Suspenso</Badge>;
      default:
        return null;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Olá! Aqui está o resumo do Salão Cloud.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/admin/establishments">Ver Estabelecimentos</Link>
            </Button>
            <Button asChild className="bg-gradient-primary">
              <Link to="/admin/users">Gerenciar Usuários</Link>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <Card key={stat.title} className="relative overflow-hidden hover:shadow-lg transition-shadow">
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
                  {loading ? "..." : stat.value.toLocaleString("pt-BR")}
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
                    +{stat.trend}
                  </span>
                  <span className="text-sm text-muted-foreground">{stat.trendLabel}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Growth Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Crescimento (Últimos 7 dias)
              </CardTitle>
              <CardDescription>
                Novos estabelecimentos e usuários cadastrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey="establishments"
                      name="Estabelecimentos"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="users"
                      name="Usuários"
                      fill="hsl(var(--secondary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Status dos Estabelecimentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-sm">Ativos ({stats.activeEstablishments})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <span className="text-sm">Pendentes ({stats.pendingEstablishments})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span className="text-sm">Suspensos ({stats.suspendedEstablishments})</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Establishments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Estabelecimentos Recentes</CardTitle>
                <CardDescription>Últimos cadastros na plataforma</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/establishments">Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : recentEstablishments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum estabelecimento cadastrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentEstablishments.map((est) => (
                    <div
                      key={est.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium">
                          {est.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{est.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(est.created_at), "dd MMM yyyy", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(est.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
              <CardDescription>Últimas ações na plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : recentActivities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma atividade recente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 rounded-full bg-muted">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(activity.created_at), "dd MMM yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Agendamentos</p>
                  <p className="text-2xl font-bold">{stats.totalAppointments.toLocaleString("pt-BR")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-success/10 to-success/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receita Total (Concluídos)</p>
                  <p className="text-2xl font-bold">
                    R$ {stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-secondary">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <p className="text-2xl font-bold">
                    R${" "}
                    {stats.totalAppointments > 0
                      ? (stats.totalRevenue / stats.totalAppointments).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })
                      : "0,00"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
