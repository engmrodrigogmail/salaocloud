import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  Upload,
  Download,
  Users,
  TrendingUp,
  DollarSign,
  UserMinus,
  Activity,
  Clock,
  Bell,
  AlertCircle,
  Zap,
  Webhook,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  metadata: Record<string, string>;
  prices: Array<{
    id: string;
    unit_amount: number | null;
    currency: string;
    recurring: { interval: string } | null;
    active: boolean;
    metadata: Record<string, string>;
  }>;
}

interface PortalPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  features: string[];
  is_active: boolean;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  updated_at: string;
}

interface SyncStatus {
  portalPlansCount: number;
  stripeProductsCount: number;
  linkedPlans: number;
  unlinkedPortalPlans: number;
  isSynced: boolean;
  lastUpdate: string | null;
  details: Array<{
    name: string;
    hasStripeProduct: boolean;
    hasStripePrice: boolean;
    priceMatch: boolean;
  }>;
}

interface Statistics {
  activeSubscriptions: number;
  canceledSubscriptions: number;
  totalCustomers: number;
  averageTicket: number;
  conversionRate: number;
  abandonmentRate: number;
  monthlyData: Array<{
    month: string;
    revenue: number;
    subscriptions: number;
  }>;
}

interface DesyncAlert {
  type: "critical" | "warning" | "info";
  title: string;
  message: string;
  action?: string;
}

export default function AdminStripe() {
  const [stripeStatus, setStripeStatus] = useState<"online" | "offline" | "checking">("checking");
  const [stripeProducts, setStripeProducts] = useState<StripeProduct[]>([]);
  const [portalPlans, setPortalPlans] = useState<PortalPlan[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [desyncAlerts, setDesyncAlerts] = useState<DesyncAlert[]>([]);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSyncCheck, setLastSyncCheck] = useState<Date | null>(null);

  // Selection states
  const [selectedStripeProducts, setSelectedStripeProducts] = useState<string[]>([]);
  const [selectedPortalPlans, setSelectedPortalPlans] = useState<string[]>([]);

  // Dialog states
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const formatBRLCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatBrasiliaTime = (date: Date) => {
    return date.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const checkDesyncAlerts = useCallback((status: SyncStatus | null, lastSyncTime: Date | null) => {
    const alerts: DesyncAlert[] = [];

    if (!status) return alerts;

    // Check if desynchronized
    if (!status.isSynced) {
      const desyncedPlans = status.details.filter(
        (d) => !d.hasStripeProduct || !d.hasStripePrice || !d.priceMatch
      );

      if (desyncedPlans.length > 0) {
        alerts.push({
          type: "warning",
          title: "Planos Dessincronizados",
          message: `${desyncedPlans.length} plano(s) estão fora de sincronia com o Stripe: ${desyncedPlans.map(p => p.name).join(", ")}`,
          action: "Sincronize os planos para manter consistência",
        });
      }
    }

    // Check for unlinked portal plans
    if (status.unlinkedPortalPlans > 0) {
      alerts.push({
        type: "info",
        title: "Planos não vinculados",
        message: `${status.unlinkedPortalPlans} plano(s) do portal não estão vinculados ao Stripe`,
        action: "Exporte os planos para o Stripe ou vincule-os manualmente",
      });
    }

    // Check if last sync was more than 24 hours ago
    if (lastSyncTime) {
      const hoursSinceSync = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceSync > 24) {
        alerts.push({
          type: "critical",
          title: "Sincronização Atrasada",
          message: `A última verificação de sincronização foi há mais de 24 horas (${Math.floor(hoursSinceSync)} horas)`,
          action: "Atualize os dados para verificar o status atual",
        });
      }
    }

    // Check for price mismatches
    const priceMismatches = status.details.filter(
      (d) => d.hasStripeProduct && d.hasStripePrice && !d.priceMatch
    );
    if (priceMismatches.length > 0) {
      alerts.push({
        type: "critical",
        title: "Divergência de Preços",
        message: `${priceMismatches.length} plano(s) têm preços diferentes no portal e no Stripe: ${priceMismatches.map(p => p.name).join(", ")}`,
        action: "Isso pode causar cobranças incorretas - sincronize imediatamente",
      });
    }

    return alerts;
  }, []);

  const checkStripeStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-data", {
        body: { action: "check_status" },
      });
      if (error) throw error;
      setStripeStatus(data.status);
    } catch {
      setStripeStatus("offline");
    }
  }, []);

  const fetchStripeProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-data", {
        body: { action: "get_products_and_prices" },
      });
      if (error) throw error;
      setStripeProducts(data.products || []);
    } catch (error) {
      console.error("Error fetching Stripe products:", error);
      toast.error("Erro ao buscar produtos do Stripe");
    }
  }, []);

  const fetchPortalPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("display_order");
      if (error) throw error;
      setPortalPlans(data || []);
    } catch (error) {
      console.error("Error fetching portal plans:", error);
      toast.error("Erro ao buscar planos do portal");
    }
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    const requestId = crypto.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    try {
      console.debug("[ADMIN-STRIPE] check_sync_status:start", { requestId });
      const { data, error } = await supabase.functions.invoke("stripe-sync", {
        body: { action: "check_sync_status", client_request_id: requestId },
      });
      if (error) throw error;

      console.debug("[ADMIN-STRIPE] check_sync_status:response", { requestId, data });
      setSyncStatus(data);
      setLastSyncCheck(new Date());

      // Generate alerts based on sync status
      const alerts = checkDesyncAlerts(data, new Date());
      setDesyncAlerts(alerts);

      return data;
    } catch (error) {
      console.error("[ADMIN-STRIPE] check_sync_status:error", { requestId, error });
      return null;
    }
  }, [checkDesyncAlerts]);

  const fetchStatistics = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-data", {
        body: { action: "get_statistics" },
      });
      if (error) throw error;
      setStatistics(data);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      toast.error("Erro ao buscar estatísticas");
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      checkStripeStatus(),
      fetchStripeProducts(),
      fetchPortalPlans(),
      fetchSyncStatus(),
      fetchStatistics(),
    ]);
    setLastUpdate(new Date());
    setLoading(false);
  }, [checkStripeStatus, fetchStripeProducts, fetchPortalPlans, fetchSyncStatus, fetchStatistics]);

  // Auto-sync: check sync status every 5 minutes when enabled
  useEffect(() => {
    refreshAll();

    if (autoSyncEnabled) {
      const interval = setInterval(() => {
        fetchSyncStatus();
        setLastUpdate(new Date());
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [refreshAll, autoSyncEnabled, fetchSyncStatus]);

  const handleExportToStripe = async () => {
    if (selectedPortalPlans.length === 0) {
      toast.error("Selecione pelo menos um plano para exportar");
      return;
    }

    const requestId = crypto.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setSyncing(true);
    try {
      const plansToExport = portalPlans.filter((p) => selectedPortalPlans.includes(p.id));
      console.debug("[ADMIN-STRIPE] export_to_stripe:start", {
        requestId,
        plans: plansToExport.map((p) => ({
          id: p.id,
          name: p.name,
          price_monthly: p.price_monthly,
          stripe_product_id: p.stripe_product_id,
          stripe_price_id_monthly: p.stripe_price_id_monthly,
        })),
      });

      const { data, error } = await supabase.functions.invoke("stripe-sync", {
        body: { action: "export_to_stripe", client_request_id: requestId, plans: plansToExport },
      });
      if (error) throw error;

      console.debug("[ADMIN-STRIPE] export_to_stripe:response", { requestId, data });

      const successCount = data.results.filter((r: { success: boolean }) => r.success).length;
      toast.success(`${successCount} plano(s) exportado(s) com sucesso`);
      setExportDialogOpen(false);
      setSelectedPortalPlans([]);
      refreshAll();
    } catch (error) {
      console.error("[ADMIN-STRIPE] export_to_stripe:error", { requestId, error });
      toast.error("Erro ao exportar planos para o Stripe");
    } finally {
      setSyncing(false);
    }
  };

  const handleImportFromStripe = async () => {
    if (selectedStripeProducts.length === 0) {
      toast.error("Selecione pelo menos um produto para importar");
      return;
    }

    setSyncing(true);
    try {
      const productsToImport = stripeProducts.filter((p) => selectedStripeProducts.includes(p.id));
      const { data, error } = await supabase.functions.invoke("stripe-sync", {
        body: { action: "import_from_stripe", plans: productsToImport },
      });
      if (error) throw error;

      const successCount = data.results.filter((r: { success: boolean }) => r.success).length;
      toast.success(`${successCount} plano(s) importado(s) com sucesso`);
      setImportDialogOpen(false);
      setSelectedStripeProducts([]);
      refreshAll();
    } catch (error) {
      console.error("Error importing from Stripe:", error);
      toast.error("Erro ao importar planos do Stripe");
    } finally {
      setSyncing(false);
    }
  };

  const dismissAlert = (index: number) => {
    setDesyncAlerts((prev) => prev.filter((_, i) => i !== index));
  };

  const getStatusIcon = () => {
    switch (stripeStatus) {
      case "online":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "offline":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />;
    }
  };

  const getSyncBadge = () => {
    if (!syncStatus) return null;
    if (syncStatus.isSynced) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Sincronizado
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Dessincronizado
      </Badge>
    );
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <AlertCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getAlertVariant = (type: string): "default" | "destructive" => {
    return type === "critical" ? "destructive" : "default";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciamento Stripe</h1>
            <p className="text-muted-foreground">
              Monitore e gerencie a integração com o Stripe
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoSyncEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
            >
              <Zap className={`h-4 w-4 mr-2 ${autoSyncEnabled ? "text-yellow-300" : ""}`} />
              {autoSyncEnabled ? "Auto-Sync Ativo" : "Auto-Sync Inativo"}
            </Button>
            <Button onClick={refreshAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Desync Alerts */}
        {desyncAlerts.length > 0 && (
          <div className="space-y-3">
            {desyncAlerts.map((alert, index) => (
              <Alert key={index} variant={getAlertVariant(alert.type)}>
                {getAlertIcon(alert.type)}
                <AlertTitle className="flex items-center justify-between">
                  <span>{alert.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => dismissAlert(index)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </AlertTitle>
                <AlertDescription>
                  <p>{alert.message}</p>
                  {alert.action && (
                    <p className="text-sm mt-1 font-medium">{alert.action}</p>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Status and Sync Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Status do Stripe</CardTitle>
              {getStatusIcon()}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {stripeStatus === "checking" ? "Verificando..." : stripeStatus === "online" ? "Online" : "Offline"}
              </div>
              <p className="text-xs text-muted-foreground">
                Conectividade com a API do Stripe
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sincronização</CardTitle>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {getSyncBadge()}
              <p className="text-xs text-muted-foreground mt-2">
                {syncStatus?.linkedPlans || 0} de {syncStatus?.portalPlansCount || 0} planos vinculados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Última Atualização</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {lastUpdate ? formatBrasiliaTime(lastUpdate) : "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                Fuso horário de Brasília
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Webhook</CardTitle>
              <Webhook className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Ativo
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Eventos Stripe em tempo real
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ações Rápidas</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExportDialogOpen(true)}
                disabled={stripeStatus !== "online"}
              >
                <Upload className="h-3 w-3 mr-1" />
                Exportar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImportDialogOpen(true)}
                disabled={stripeStatus !== "online"}
              >
                <Download className="h-3 w-3 mr-1" />
                Importar
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Assinantes Ativos</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.activeSubscriptions || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
              <UserMinus className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.canceledSubscriptions || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBRLCurrency(statistics?.averageTicket || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.conversionRate || 0}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Abandono</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.abandonmentRate || 0}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.totalCustomers || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Receita Mensal</CardTitle>
              <CardDescription>Últimos 12 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={statistics?.monthlyData || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `R$ ${value}`} />
                    <Tooltip
                      formatter={(value: number) => [formatBRLCurrency(value), "Receita"]}
                      labelStyle={{ color: "var(--foreground)" }}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Novas Assinaturas</CardTitle>
              <CardDescription>Últimos 12 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statistics?.monthlyData || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => [value, "Assinaturas"]}
                      labelStyle={{ color: "var(--foreground)" }}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Bar
                      dataKey="subscriptions"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plans Tables */}
        <Tabs defaultValue="stripe" className="space-y-4">
          <TabsList>
            <TabsTrigger value="stripe">Planos do Stripe</TabsTrigger>
            <TabsTrigger value="portal">Planos do Portal</TabsTrigger>
            <TabsTrigger value="sync">Detalhes da Sincronização</TabsTrigger>
          </TabsList>

          <TabsContent value="stripe" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Produtos e Preços do Stripe</CardTitle>
                    <CardDescription>
                      Dados obtidos diretamente da API do Stripe
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setImportDialogOpen(true)}
                    disabled={stripeProducts.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Importar Selecionados
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedStripeProducts.length === stripeProducts.length && stripeProducts.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStripeProducts(stripeProducts.map((p) => p.id));
                            } else {
                              setSelectedStripeProducts([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>ID do Produto</TableHead>
                      <TableHead>Preço Mensal</TableHead>
                      <TableHead>Preço Anual</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stripeProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Nenhum produto encontrado no Stripe
                        </TableCell>
                      </TableRow>
                    ) : (
                      stripeProducts.map((product) => {
                        const monthlyPrice = product.prices.find((p) => p.recurring?.interval === "month");
                        const yearlyPrice = product.prices.find((p) => p.recurring?.interval === "year");
                        return (
                          <TableRow key={product.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedStripeProducts.includes(product.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedStripeProducts([...selectedStripeProducts, product.id]);
                                  } else {
                                    setSelectedStripeProducts(selectedStripeProducts.filter((id) => id !== product.id));
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell className="font-mono text-xs">{product.id}</TableCell>
                            <TableCell>
                              {monthlyPrice
                                ? formatBRLCurrency((monthlyPrice.unit_amount || 0) / 100)
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {yearlyPrice
                                ? formatBRLCurrency((yearlyPrice.unit_amount || 0) / 100)
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={product.active ? "default" : "secondary"}>
                                {product.active ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portal" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Planos do Portal</CardTitle>
                    <CardDescription>
                      Planos cadastrados no banco de dados do portal
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setExportDialogOpen(true)}
                    disabled={portalPlans.length === 0}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Exportar Selecionados
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedPortalPlans.length === portalPlans.length && portalPlans.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPortalPlans(portalPlans.map((p) => p.id));
                            } else {
                              setSelectedPortalPlans([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Preço Mensal</TableHead>
                      <TableHead>Preço Anual</TableHead>
                      <TableHead>Vinculado ao Stripe</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portalPlans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Nenhum plano encontrado no portal
                        </TableCell>
                      </TableRow>
                    ) : (
                      portalPlans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedPortalPlans.includes(plan.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPortalPlans([...selectedPortalPlans, plan.id]);
                                } else {
                                  setSelectedPortalPlans(selectedPortalPlans.filter((id) => id !== plan.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          <TableCell className="font-mono text-xs">{plan.slug}</TableCell>
                          <TableCell>{formatBRLCurrency(plan.price_monthly)}</TableCell>
                          <TableCell>
                            {plan.price_yearly ? formatBRLCurrency(plan.price_yearly) : "—"}
                          </TableCell>
                          <TableCell>
                            {plan.stripe_product_id ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Sim
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="h-3 w-3 mr-1" />
                                Não
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={plan.is_active ? "default" : "secondary"}>
                              {plan.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detalhes da Sincronização</CardTitle>
                <CardDescription>
                  Comparação entre os planos do portal e do Stripe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plano</TableHead>
                      <TableHead>Produto no Stripe</TableHead>
                      <TableHead>Preço no Stripe</TableHead>
                      <TableHead>Preços Iguais</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!syncStatus?.details || syncStatus.details.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nenhum dado de sincronização disponível
                        </TableCell>
                      </TableRow>
                    ) : (
                      syncStatus.details.map((detail, index) => {
                        const isSynced = detail.hasStripeProduct && detail.hasStripePrice && detail.priceMatch;
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{detail.name}</TableCell>
                            <TableCell>
                              {detail.hasStripeProduct ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                            </TableCell>
                            <TableCell>
                              {detail.hasStripePrice ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                            </TableCell>
                            <TableCell>
                              {detail.priceMatch ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={isSynced ? "default" : "destructive"}>
                                {isSynced ? "Sincronizado" : "Dessincronizado"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Import Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Importar Planos do Stripe</DialogTitle>
              <DialogDescription>
                Selecione os produtos do Stripe que deseja importar para o portal
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedStripeProducts.length === stripeProducts.length && stripeProducts.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedStripeProducts(stripeProducts.map((p) => p.id));
                          } else {
                            setSelectedStripeProducts([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Preço Mensal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stripeProducts.map((product) => {
                    const monthlyPrice = product.prices.find((p) => p.recurring?.interval === "month");
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStripeProducts.includes(product.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedStripeProducts([...selectedStripeProducts, product.id]);
                              } else {
                                setSelectedStripeProducts(selectedStripeProducts.filter((id) => id !== product.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          {monthlyPrice
                            ? formatBRLCurrency((monthlyPrice.unit_amount || 0) / 100)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleImportFromStripe} disabled={syncing || selectedStripeProducts.length === 0}>
                {syncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Importar ({selectedStripeProducts.length})
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Exportar Planos para o Stripe</DialogTitle>
              <DialogDescription>
                Selecione os planos do portal que deseja exportar para o Stripe
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedPortalPlans.length === portalPlans.length && portalPlans.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPortalPlans(portalPlans.map((p) => p.id));
                          } else {
                            setSelectedPortalPlans([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Preço Mensal</TableHead>
                    <TableHead>Vinculado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portalPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPortalPlans.includes(plan.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPortalPlans([...selectedPortalPlans, plan.id]);
                            } else {
                              setSelectedPortalPlans(selectedPortalPlans.filter((id) => id !== plan.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>{formatBRLCurrency(plan.price_monthly)}</TableCell>
                      <TableCell>
                        {plan.stripe_product_id ? (
                          <Badge variant="default" className="bg-green-500">Sim</Badge>
                        ) : (
                          <Badge variant="secondary">Não</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleExportToStripe} disabled={syncing || selectedPortalPlans.length === 0}>
                {syncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Exportar ({selectedPortalPlans.length})
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
