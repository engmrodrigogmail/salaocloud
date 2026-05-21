import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodFilter, usePeriodRange, type PeriodKey } from "@/components/ui/period-filter";
import { format, startOfMonth, endOfMonth } from "date-fns";

import {
  Calendar,
  Users,
  Scissors,
  TrendingUp,
  Clock,
  DollarSign,
  Bot,
  MessageSquare,
  AlertTriangle,
  Wallet,
  Receipt,
  CalendarX,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { NoShowReportCard } from "@/components/agenda/NoShowReportCard";
import { ReviewsSummaryCard } from "@/components/reviews/ReviewsSummaryCard";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

interface Establishment {
  id: string;
  name: string;
  owner_id: string;
  subscription_plan: string;
  working_hours: unknown;
}

export default function PortalDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const range = usePeriodRange(period, customFrom, customTo);
  const [stats, setStats] = useState({
    periodAppointments: 0,
    todayAppointments: 0,
    noShowCount: 0,
    theoreticalRevenue: 0,
    theoreticalBreakdown: { upcoming: 0, inService: 0, completed: 0 },
    closedTabsCount: 0,
    totalClients: 0,
    totalServices: 0,
    totalProfessionals: 0,
    periodRevenue: 0,
    aiConversations: 0,
    aiMessagesThisMonth: 0,
    commissionsPending: 0,
    commissionsPaid: 0,
    expensesPaid: 0,
    expensesByCategory: [] as { name: string; total: number }[],
    cashInflow: 0,
    cashOutflow: 0,
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

  useEffect(() => {
    if (establishment?.id) {
      fetchStats(establishment.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishment?.id, range.fromIso, range.toIso]);

  const fetchEstablishment = async () => {
    try {
      const { data, error } = await supabase
        .from("establishments")
        .select("id, name, owner_id, subscription_plan, working_hours")
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
    const currentMonthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const fromIso = range.from.toISOString();
    const toIso = range.to.toISOString();
    const fromDate = range.fromIso; // yyyy-MM-dd
    const toDate = range.toIso;

    const [
      periodAppointmentsResult,
      todayAppointmentsResult,
      appointmentsBreakdownResult,
      clientsResult,
      servicesResult,
      professionalsResult,
      tabsResult,
      aiConversationsResult,
      aiUsageResult,
      commissionsPaidResult,
      commissionsPendingResult,
      financeEntriesResult,
    ] = await Promise.all([
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).gte("scheduled_at", fromIso).lte("scheduled_at", toIso),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).gte("scheduled_at", today).lt("scheduled_at", today + "T23:59:59"),
      supabase.from("appointments").select("status,price").eq("establishment_id", establishmentId).gte("scheduled_at", fromIso).lte("scheduled_at", toIso),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).eq("is_active", true),
      supabase.from("professionals").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).eq("is_active", true),
      supabase.from("tabs").select("total").eq("establishment_id", establishmentId).eq("status", "closed").gte("closed_at", fromIso).lte("closed_at", toIso),
      supabase.from("ai_assistant_conversations").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId),
      supabase.from("ai_assistant_usage").select("message_count").eq("establishment_id", establishmentId).eq("month_year", currentMonthYear).single(),
      supabase.from("professional_commissions").select("commission_amount").eq("establishment_id", establishmentId).eq("status", "paid").gte("paid_at", fromIso).lte("paid_at", toIso),
      supabase.from("professional_commissions").select("commission_amount").eq("establishment_id", establishmentId).in("status", ["pending", "approved"]).gte("created_at", fromIso).lte("created_at", toIso),
      supabase.from("finance_entries").select("type,amount,status,date,finance_categories(name)").eq("establishment_id", establishmentId).eq("status", "paid").gte("date", fromDate).lte("date", toDate),
    ]);

    const closedTabs = tabsResult.data || [];
    const periodRevenue = closedTabs.reduce((sum: number, t: any) => sum + Number(t.total || 0), 0);
    const closedTabsCount = closedTabs.length;

    const apptRows = (appointmentsBreakdownResult.data || []) as any[];
    const noShowCount = apptRows.filter((a) => a.status === "no_show").length;
    const countedRows = apptRows.filter((a) => a.status !== "no_show" && a.status !== "cancelled");
    const theoreticalRevenue = countedRows.reduce((s, a) => s + Number(a.price || 0), 0);
    const theoreticalBreakdown = {
      upcoming: countedRows.filter((a) => a.status === "pending" || a.status === "confirmed").reduce((s, a) => s + Number(a.price || 0), 0),
      inService: countedRows.filter((a) => a.status === "in_service").reduce((s, a) => s + Number(a.price || 0), 0),
      completed: countedRows.filter((a) => a.status === "completed").reduce((s, a) => s + Number(a.price || 0), 0),
    };

    const commissionsPaid = commissionsPaidResult.data?.reduce((s, c) => s + Number(c.commission_amount || 0), 0) || 0;
    const commissionsPending = commissionsPendingResult.data?.reduce((s, c) => s + Number(c.commission_amount || 0), 0) || 0;

    const finRows = (financeEntriesResult.data || []) as any[];
    const catMap = new Map<string, number>();
    let expensesPaid = 0;
    let cashInflow = 0;
    let cashOutflow = 0;
    for (const r of finRows) {
      const amt = Number(r.amount || 0);
      if (r.type === "expense") {
        expensesPaid += amt;
        cashOutflow += amt;
        const name = r.finance_categories?.name || "Sem categoria";
        catMap.set(name, (catMap.get(name) || 0) + amt);
      } else if (r.type === "revenue") {
        cashInflow += amt;
      }
    }
    cashInflow += periodRevenue; // closed tabs as inflow source

    const expensesByCategory = Array.from(catMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    setStats({
      periodAppointments: periodAppointmentsResult.count || 0,
      todayAppointments: todayAppointmentsResult.count || 0,
      noShowCount,
      theoreticalRevenue,
      theoreticalBreakdown,
      closedTabsCount,
      totalClients: clientsResult.count || 0,
      totalServices: servicesResult.count || 0,
      totalProfessionals: professionalsResult.count || 0,
      periodRevenue,
      aiConversations: aiConversationsResult.count || 0,
      aiMessagesThisMonth: aiUsageResult.data?.message_count || 0,
      commissionsPending,
      commissionsPaid,
      expensesPaid,
      expensesByCategory,
      cashInflow,
      cashOutflow,
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

  // Check if working_hours is empty or not configured
  const isWorkingHoursEmpty = !establishment?.working_hours || 
    (typeof establishment.working_hours === 'object' && 
     Object.keys(establishment.working_hours as Record<string, unknown>).length === 0);

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Alert for missing working hours */}
        {isWorkingHoursEmpty && (
          <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <AlertTitle className="text-orange-800 dark:text-orange-400">
              Horário de funcionamento não configurado
            </AlertTitle>
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              <p className="mb-3">
                Sua assistente virtual não consegue informar o horário de funcionamento aos clientes. 
                Configure os horários para melhorar o atendimento automatizado.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="border-orange-500 text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-950">
                  <Link to={`/portal/${slug}/configuracoes`}>
                    Configurar Horários
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="text-orange-600 hover:text-orange-800">
                  <Link to={`/portal/${slug}/conversas-ia`}>
                    Ver Conversas da IA
                  </Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Visão geral do {establishment?.name} <span className="text-xs">({range.label})</span>
            </p>
          </div>
          <PeriodFilter
            period={period}
            onPeriodChange={setPeriod}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
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
              <CardTitle className="text-sm font-medium">Agendamentos no período</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="text-2xl font-bold">{stats.periodAppointments}</div>
                <p className="text-xs text-muted-foreground">agendamentos no intervalo</p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t">
                <CalendarX className="h-3.5 w-3.5 text-red-500" />
                <span className="text-sm font-semibold text-red-600">{stats.noShowCount}</span>
                <span className="text-xs text-muted-foreground">no-shows</span>
              </div>
              <div className="pt-2 border-t">
                <div className="text-sm font-semibold">{fmtBRL(stats.theoreticalRevenue)}</div>
                <p className="text-[11px] text-muted-foreground italic mb-1">
                  Receita prevista do período (todos os agendamentos, exceto faltas e cancelados)
                </p>
                <div className="space-y-0.5 text-[11px] text-muted-foreground">
                  <div className="flex justify-between"><span>Concluídos</span><span className="tabular-nums">{fmtBRL(stats.theoreticalBreakdown.completed)}</span></div>
                  <div className="flex justify-between"><span>Em atendimento</span><span className="tabular-nums">{fmtBRL(stats.theoreticalBreakdown.inService)}</span></div>
                  <div className="flex justify-between"><span>Pendentes / Confirmados</span><span className="tabular-nums">{fmtBRL(stats.theoreticalBreakdown.upcoming)}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Faturamento no período</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="text-2xl font-bold">{fmtBRL(stats.periodRevenue)}</div>
                <p className="text-xs text-muted-foreground">comandas fechadas no período</p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold">{stats.closedTabsCount}</span>
                <span className="text-xs text-muted-foreground">comandas fechadas</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Resultado de Caixa</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className={`text-2xl font-bold ${stats.cashInflow - stats.cashOutflow >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmtBRL(stats.cashInflow - stats.cashOutflow)}
              </div>
              <p className="text-[11px] text-muted-foreground">entradas − saídas no período</p>
              <div className="pt-2 border-t text-xs space-y-0.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Entradas</span><span className="font-medium text-emerald-600">{fmtBRL(stats.cashInflow)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Saídas</span><span className="font-medium text-red-600">{fmtBRL(stats.cashOutflow)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Despesas no período</CardTitle>
              <Receipt className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold text-red-600">{fmtBRL(stats.expensesPaid)}</div>
              <p className="text-xs text-muted-foreground">despesas pagas (fluxo de caixa)</p>
              {stats.expensesByCategory.length > 0 ? (
                <div className="pt-2 border-t space-y-1 max-h-40 overflow-y-auto">
                  {stats.expensesByCategory.map((c) => (
                    <div key={c.name} className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate pr-2">{c.name}</span>
                      <span className="font-medium">{fmtBRL(c.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic pt-2 border-t">Nenhuma despesa paga no período.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Comissões — Acerto Pendente</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.commissionsPending > 0 ? "text-orange-600" : ""}`}>
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.commissionsPending)}
              </div>
              <p className="text-xs text-muted-foreground">a acertar com profissionais</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Comissões pagas</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.commissionsPaid)}
              </div>
              <p className="text-xs text-muted-foreground">saída de caixa no período</p>
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

          {establishment && slug && (
            <ReviewsSummaryCard establishmentId={establishment.id} slug={slug} />
          )}
        </div>

        {/* AI Assistant Metrics */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Assistente IA
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Conversas com IA</CardTitle>
                <MessageSquare className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.aiConversations}</div>
                <p className="text-xs text-muted-foreground">conversas iniciadas</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Mensagens este Mês</CardTitle>
                <Bot className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.aiMessagesThisMonth}</div>
                <p className="text-xs text-muted-foreground">mensagens processadas pela IA</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* No-Show Report */}
        {establishment && (
          <div>
            <NoShowReportCard establishmentId={establishment.id} />
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
