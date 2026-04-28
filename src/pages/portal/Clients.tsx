import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Search, UserCircle, ChevronDown, ChevronUp, Calendar, Scissors, ChevronLeft, ChevronRight } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.cpf && c.cpf.includes(searchQuery.replace(/\D/g, "")))
  );

  const getClientStats = (clientId: string) => {
    const appointments = clientAppointments[clientId] || [];
    const completedAppointments = appointments.filter((a) => a.status === "completed");
    const totalSpent = completedAppointments.reduce((sum, a) => sum + a.price, 0);
    return { total: appointments.length, completed: completedAppointments.length, totalSpent };
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
            placeholder="Buscar por nome, telefone ou CPF..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cliente desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
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
                filteredClients.map((client) => (
                  <Collapsible
                    key={client.id}
                    open={expandedClient === client.id}
                    onOpenChange={() => handleToggleClient(client.id)}
                    asChild
                  >
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
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
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={6} className="p-0">
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
      </div>
    </PortalLayout>
  );
}
