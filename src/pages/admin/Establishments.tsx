import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import {
  Building2,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ExternalLink,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  ClipboardCheck,
  Crown,
  Sparkles,
} from "lucide-react";
import { EditSubscriptionDialog } from "@/components/admin/EditSubscriptionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EstablishmentFeaturesCheck } from "@/components/admin/EstablishmentFeaturesCheck";

interface Establishment {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: "pending" | "active" | "suspended";
  subscription_plan: string;
  trial_ends_at: string | null;
  admin_trial_granted_at: string | null;
  created_at: string;
  owner_id: string;
}

interface EstablishmentStats {
  appointments: number;
  clients: number;
  professionals: number;
  services: number;
  revenue: number;
}

type StatusFilter = "all" | "active" | "pending" | "suspended" | "admin_trial";
type PlanFilter = "all" | "pro" | "admin_trial" | "trial" | "basic" | "professional" | "premium";

export default function AdminEstablishments() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);
  const [establishmentStats, setEstablishmentStats] = useState<EstablishmentStats | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const { toast } = useToast();

  const fetchEstablishments = async () => {
    try {
      const { data, error } = await supabase
        .from("establishments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEstablishments(data || []);
    } catch (error) {
      console.error("Error fetching establishments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEstablishmentStats = async (establishmentId: string) => {
    try {
      const [appointmentsRes, clientsRes, professionalsRes, servicesRes] = await Promise.all([
        supabase.from("appointments").select("price, status").eq("establishment_id", establishmentId),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId),
        supabase.from("professionals").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId),
        supabase.from("services").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId),
      ]);

      const appointments = appointmentsRes.data || [];
      const revenue = appointments
        .filter((a) => a.status === "completed")
        .reduce((acc, a) => acc + (a.price || 0), 0);

      setEstablishmentStats({
        appointments: appointments.length,
        clients: clientsRes.count || 0,
        professionals: professionalsRes.count || 0,
        services: servicesRes.count || 0,
        revenue,
      });
    } catch (error) {
      console.error("Error fetching establishment stats:", error);
    }
  };

  useEffect(() => {
    fetchEstablishments();
  }, []);

  const updateStatus = async (id: string, status: "active" | "suspended" | "pending") => {
    try {
      const { error } = await supabase
        .from("establishments")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Status atualizado!",
        description: `Estabelecimento ${
          status === "active" ? "ativado" : status === "suspended" ? "suspenso" : "pendente"
        } com sucesso.`,
      });

      setIsStatusDialogOpen(false);
      setSelectedEstablishment(null);
      fetchEstablishments();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar o status.",
      });
    }
  };

  const handleViewEstablishment = async (establishment: Establishment) => {
    setSelectedEstablishment(establishment);
    setEstablishmentStats(null);
    setIsViewDialogOpen(true);
    await fetchEstablishmentStats(establishment.id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ativo
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Suspenso
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPlanBadge = (plan: string) => {
    if (plan === "admin_trial") {
      return (
        <Badge className="bg-purple-600 text-white hover:bg-purple-600">
          <Sparkles className="h-3 w-3 mr-1" />
          Trial Premium Adm
        </Badge>
      );
    }
    if (plan === "pro") {
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <Crown className="h-3 w-3 mr-1" />
          Pro
        </Badge>
      );
    }
    if (plan === "trial") {
      return (
        <Badge className="bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3 mr-1" />
          Trial
        </Badge>
      );
    }
    const config: Record<string, { bg: string; text: string }> = {
      basic: { bg: "bg-muted", text: "text-foreground" },
      professional: { bg: "bg-secondary/10", text: "text-secondary" },
      premium: { bg: "bg-accent/10", text: "text-accent-foreground" },
    };
    const { bg, text } = config[plan] || { bg: "bg-muted", text: "text-muted-foreground" };
    return (
      <Badge className={`${bg} ${text}`}>
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </Badge>
    );
  };

  const filteredEstablishments = establishments.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.slug.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    const matchesPlan = planFilter === "all" || e.subscription_plan === planFilter;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  const stats = {
    total: establishments.length,
    active: establishments.filter((e) => e.status === "active").length,
    pending: establishments.filter((e) => e.status === "pending").length,
    suspended: establishments.filter((e) => e.status === "suspended").length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Estabelecimentos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os salões e barbearias cadastrados
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="border-success/20">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-success">{stats.active}</div>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </CardContent>
          </Card>
          <Card className="border-warning/20">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-warning">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card className="border-destructive/20">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-destructive">{stats.suspended}</div>
              <p className="text-xs text-muted-foreground">Suspensos</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou slug..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={(v) => setPlanFilter(v as PlanFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Planos</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="admin_trial">Trial Premium Adm</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="basic">Básico (legado)</SelectItem>
              <SelectItem value="professional">Profissional (legado)</SelectItem>
              <SelectItem value="premium">Premium (legado)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredEstablishments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">
                      Nenhum estabelecimento encontrado
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEstablishments.map((establishment) => (
                  <TableRow key={establishment.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium">
                          {establishment.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{establishment.name}</div>
                          <div className="text-sm text-muted-foreground">
                            /{establishment.slug}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {establishment.email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {establishment.email}
                          </div>
                        )}
                        {establishment.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {establishment.phone}
                          </div>
                        )}
                        {!establishment.email && !establishment.phone && (
                          <span className="text-muted-foreground">Sem contato</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(establishment.status)}</TableCell>
                    <TableCell>{getPlanBadge(establishment.subscription_plan)}</TableCell>
                    <TableCell>
                      {format(new Date(establishment.created_at), "dd MMM yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleViewEstablishment(establishment)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={`/agendar/${establishment.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Ver página
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {establishment.status !== "active" && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedEstablishment(establishment);
                                setNewStatus("active");
                                setIsStatusDialogOpen(true);
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-2 text-success" />
                              Ativar
                            </DropdownMenuItem>
                          )}
                          {establishment.status !== "pending" && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedEstablishment(establishment);
                                setNewStatus("pending");
                                setIsStatusDialogOpen(true);
                              }}
                            >
                              <Clock className="h-4 w-4 mr-2 text-warning" />
                              Marcar Pendente
                            </DropdownMenuItem>
                          )}
                          {establishment.status !== "suspended" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedEstablishment(establishment);
                                setNewStatus("suspended");
                                setIsStatusDialogOpen(true);
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Suspender
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* View Establishment Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Estabelecimento</DialogTitle>
          </DialogHeader>
          {selectedEstablishment && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="stats">Estatísticas</TabsTrigger>
                <TabsTrigger value="features" className="flex items-center gap-1">
                  <ClipboardCheck className="h-3 w-3" />
                  Funcionalidades
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div className="flex items-center gap-4 py-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-white text-2xl font-bold">
                    {selectedEstablishment.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedEstablishment.name}</h3>
                    <div className="flex gap-2 mt-1">
                      {getStatusBadge(selectedEstablishment.status)}
                      {getPlanBadge(selectedEstablishment.subscription_plan)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono text-xs">{selectedEstablishment.id}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Slug</span>
                    <span>/{selectedEstablishment.slug}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Email</span>
                    <span>{selectedEstablishment.email || "Não informado"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Telefone</span>
                    <span>{selectedEstablishment.phone || "Não informado"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Endereço</span>
                    <span>
                      {selectedEstablishment.address
                        ? `${selectedEstablishment.address}, ${selectedEstablishment.city} - ${selectedEstablishment.state}`
                        : "Não informado"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Cadastro</span>
                    <span>
                      {format(new Date(selectedEstablishment.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" asChild>
                    <a
                      href={`/agendar/${selectedEstablishment.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver página pública
                    </a>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="stats" className="space-y-4">
                {establishmentStats ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{establishmentStats.appointments}</p>
                            <p className="text-xs text-muted-foreground">Agendamentos</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-secondary/10">
                            <Users className="h-5 w-5 text-secondary" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{establishmentStats.clients}</p>
                            <p className="text-xs text-muted-foreground">Clientes</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-success/10">
                            <Users className="h-5 w-5 text-success" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{establishmentStats.professionals}</p>
                            <p className="text-xs text-muted-foreground">Profissionais</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-warning/10">
                            <TrendingUp className="h-5 w-5 text-warning" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{establishmentStats.services}</p>
                            <p className="text-xs text-muted-foreground">Serviços</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="col-span-2">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-success/10">
                            <DollarSign className="h-5 w-5 text-success" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">
                              R$ {establishmentStats.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-muted-foreground">Receita Total (Concluídos)</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando estatísticas...
                  </div>
                )}
              </TabsContent>

              <TabsContent value="features" className="space-y-4">
                <EstablishmentFeaturesCheck
                  establishmentId={selectedEstablishment.id}
                  subscriptionPlan={selectedEstablishment.subscription_plan}
                  isTrialPeriod={false}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation */}
      <AlertDialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {newStatus === "suspended" && <AlertTriangle className="h-5 w-5 text-destructive" />}
              Confirmar Alteração de Status
            </AlertDialogTitle>
            <AlertDialogDescription>
              {newStatus === "active" && (
                <>
                  Ativar o estabelecimento <strong>{selectedEstablishment?.name}</strong>?
                  Ele poderá receber agendamentos imediatamente.
                </>
              )}
              {newStatus === "pending" && (
                <>
                  Marcar o estabelecimento <strong>{selectedEstablishment?.name}</strong> como pendente?
                  Ele não poderá receber novos agendamentos.
                </>
              )}
              {newStatus === "suspended" && (
                <>
                  Suspender o estabelecimento <strong>{selectedEstablishment?.name}</strong>?
                  Ele será removido das buscas e não poderá receber agendamentos.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                selectedEstablishment &&
                updateStatus(selectedEstablishment.id, newStatus as "active" | "suspended" | "pending")
              }
              className={
                newStatus === "suspended"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : newStatus === "active"
                  ? "bg-success text-white hover:bg-success/90"
                  : ""
              }
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
