import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Search, UserCircle, ChevronDown, ChevronUp, Calendar, Scissors, ChevronLeft, ChevronRight, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { toast } from "sonner";
import { ImportContactsDialog } from "@/components/clients/ImportContactsDialog";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  cpf: string | null;
  created_at: string;
}

interface Appointment {
  id: string;
  scheduled_at: string;
  status: string;
  price: number;
  service_name: string;
  professional_name: string;
}

export default function PortalClients() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [clientAppointments, setClientAppointments] = useState<Record<string, Appointment[]>>({});
  const [loadingAppointments, setLoadingAppointments] = useState<string | null>(null);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [appointmentCounts, setAppointmentCounts] = useState<Record<string, number>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; withAppointments: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to first page whenever the search query or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/portal/${slug}/clientes`);
      return;
    }

    if (slug && user) {
      fetchClients();
    }
  }, [slug, user, authLoading]);

  const fetchClients = async () => {
    try {
      const { data: est, error: estError } = await supabase
        .from("establishments")
        .select("id, owner_id")
        .eq("slug", slug)
        .single();

      if (estError || !est || est.owner_id !== user?.id) {
        navigate("/");
        return;
      }

      setEstablishmentId(est.id);

      // Paginated fetch to bypass Supabase's default 1000-row limit
      const PAGE_SIZE = 1000;
      let allClients: Client[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("establishment_id", est.id)
          .order("name")
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allClients = allClients.concat(data as Client[]);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      setClients(allClients);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientAppointments = async (clientId: string) => {
    if (clientAppointments[clientId]) {
      return;
    }

    setLoadingAppointments(clientId);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          scheduled_at,
          status,
          price,
          services:service_id(name),
          professionals:professional_id(name)
        `)
        .eq("client_id", clientId)
        .eq("establishment_id", establishmentId)
        .order("scheduled_at", { ascending: false });

      if (error) throw error;

      const formattedAppointments: Appointment[] = (data || []).map((apt: any) => ({
        id: apt.id,
        scheduled_at: apt.scheduled_at,
        status: apt.status,
        price: apt.price,
        service_name: apt.services?.name || "Serviço removido",
        professional_name: apt.professionals?.name || "Profissional removido",
      }));

      setClientAppointments((prev) => ({
        ...prev,
        [clientId]: formattedAppointments,
      }));
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoadingAppointments(null);
    }
  };

  const handleToggleClient = (clientId: string) => {
    if (expandedClient === clientId) {
      setExpandedClient(null);
    } else {
      setExpandedClient(clientId);
      fetchClientAppointments(clientId);
    }
  };

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpf;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      confirmed: { label: "Confirmado", variant: "default" },
      completed: { label: "Concluído", variant: "outline" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const config = statusConfig[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    const qDigits = q.replace(/\D/g, "");
    return clients.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.email && c.email.toLowerCase().includes(q)) return true;
      if (qDigits && c.phone && c.phone.replace(/\D/g, "").includes(qDigits)) return true;
      if (qDigits && c.cpf && c.cpf.replace(/\D/g, "").includes(qDigits)) return true;
      return false;
    });
  }, [clients, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedClients = useMemo(
    () => filteredClients.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredClients, safePage, pageSize]
  );
  const startIndex = filteredClients.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, filteredClients.length);

  const getClientStats = (clientId: string) => {
    const appointments = clientAppointments[clientId] || [];
    const completedAppointments = appointments.filter((a) => a.status === "completed");
    const totalSpent = completedAppointments.reduce((sum, a) => sum + a.price, 0);
    return { total: appointments.length, completed: completedAppointments.length, totalSpent };
  };

  // ----- Selection helpers -----
  const toggleSelectClient = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allOnPageSelected =
    paginatedClients.length > 0 &&
    paginatedClients.every((c) => selectedIds.has(c.id));

  const togglePageSelection = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      paginatedClients.forEach((c) => {
        if (checked) next.add(c.id);
        else next.delete(c.id);
      });
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ----- Appointment count check (protection rule) -----
  const fetchAppointmentCounts = async (ids: string[]) => {
    if (!establishmentId || ids.length === 0) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    ids.forEach((id) => (counts[id] = 0));
    // Query in chunks to stay under URL limits
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("appointments")
        .select("client_id")
        .eq("establishment_id", establishmentId)
        .in("client_id", slice);
      if (error) throw error;
      (data || []).forEach((row: any) => {
        if (row.client_id) counts[row.client_id] = (counts[row.client_id] || 0) + 1;
      });
    }
    setAppointmentCounts((prev) => ({ ...prev, ...counts }));
    return counts;
  };

  const openDeleteDialog = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const counts = await fetchAppointmentCounts(ids);
      const withAppointments = ids.filter((id) => (counts[id] || 0) > 0).length;
      setDeleteTarget({ ids, withAppointments });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao verificar agendamentos vinculados");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !establishmentId) return;
    setDeleting(true);
    try {
      const { ids } = deleteTarget;
      // Delete in chunks
      const CHUNK = 200;
      let deleted = 0;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("clients")
          .delete()
          .eq("establishment_id", establishmentId)
          .in("id", slice);
        if (error) throw error;
        deleted += slice.length;
      }
      toast.success(`${deleted} cliente${deleted > 1 ? "s excluídos" : " excluído"} com sucesso`);
      setClients((prev) => prev.filter((c) => !ids.includes(c.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteTarget(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao excluir clientes");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Clientes</h1>
            <p className="text-muted-foreground mt-1">
              Todos os clientes que já agendaram com você
            </p>
          </div>
          {establishmentId && (
            <ImportContactsDialog
              establishmentId={establishmentId}
              onImportComplete={fetchClients}
            />
          )}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, e-mail ou CPF..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <span className="text-sm font-medium">
              {selectedIds.size} cliente{selectedIds.size > 1 ? "s" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Limpar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => openDeleteDialog(Array.from(selectedIds))}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir selecionados
              </Button>
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={(v) => togglePageSelection(Boolean(v))}
                    aria-label="Selecionar página"
                  />
                </TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cliente desde</TableHead>
                <TableHead className="w-12 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? "Nenhum cliente encontrado"
                        : "Nenhum cliente cadastrado ainda"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Os clientes aparecem aqui quando fazem um agendamento
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClients.map((client) => (
                  <Collapsible
                    key={client.id}
                    open={expandedClient === client.id}
                    onOpenChange={() => handleToggleClient(client.id)}
                    asChild
                  >
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(client.id)}
                              onCheckedChange={(v) => toggleSelectClient(client.id, Boolean(v))}
                              aria-label={`Selecionar ${client.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            {expandedClient === client.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium">
                                {client.name.charAt(0)}
                              </div>
                              <div className="font-medium">{client.name}</div>
                            </div>
                          </TableCell>
                          <TableCell>{client.phone}</TableCell>
                          <TableCell>
                            {client.cpf ? formatCPF(client.cpf) : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            {client.email || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            {format(new Date(client.created_at), "dd MMM yyyy", {
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => openDeleteDialog([client.id])}
                              aria-label={`Excluir ${client.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={8} className="p-0">
                            <div className="p-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold flex items-center gap-2">
                                  <Calendar className="h-4 w-4" />
                                  Histórico de Atendimentos
                                </h4>
                                {clientAppointments[client.id] && (
                                  <div className="flex gap-4 text-sm text-muted-foreground">
                                    <span>{getClientStats(client.id).total} agendamentos</span>
                                    <span>{getClientStats(client.id).completed} concluídos</span>
                                    <span className="font-medium text-foreground">
                                      Total: {formatCurrency(getClientStats(client.id).totalSpent)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {loadingAppointments === client.id ? (
                                <div className="text-center py-6 text-muted-foreground">
                                  Carregando histórico...
                                </div>
                              ) : clientAppointments[client.id]?.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground">
                                  <Scissors className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                  <p>Nenhum atendimento registrado</p>
                                </div>
                              ) : (
                                <div className="rounded-lg border border-border overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/50">
                                        <TableHead>Data</TableHead>
                                        <TableHead>Serviço</TableHead>
                                        <TableHead>Profissional</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {clientAppointments[client.id]?.map((apt) => (
                                        <TableRow key={apt.id}>
                                          <TableCell>
                                            {format(new Date(apt.scheduled_at), "dd/MM/yyyy 'às' HH:mm", {
                                              locale: ptBR,
                                            })}
                                          </TableCell>
                                          <TableCell className="font-medium">{apt.service_name}</TableCell>
                                          <TableCell>{apt.professional_name}</TableCell>
                                          <TableCell>{getStatusBadge(apt.status)}</TableCell>
                                          <TableCell className="text-right font-medium">
                                            {formatCurrency(apt.price)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && filteredClients.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
            <div className="text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{startIndex}–{endIndex}</span> de{" "}
              <span className="font-medium text-foreground">{filteredClients.length}</span>
              {searchQuery && ` (filtrados de ${clients.length})`}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Por página:</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-muted-foreground">
                  Página <span className="font-medium text-foreground">{safePage}</span> de{" "}
                  <span className="font-medium text-foreground">{totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
