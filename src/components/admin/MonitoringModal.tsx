import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/dateUtils";
import { Activity, AlertTriangle, CheckCircle2, Search, Users, Clock, Eye } from "lucide-react";
import { EstablishmentMonitoringDetails } from "./EstablishmentMonitoringDetails";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Row {
  id: string;
  name: string;
  slug: string;
  subscription_plan: string;
  status: string;
  owner_name: string | null;
  last_access_at: string | null;
  last_page_accessed: string | null;
  days_active_this_month: number | null;
  total_sessions_this_month: number | null;
  days_since_last_access: number | null;
  total_clients?: number;
  clients_pending?: number;
  pending_percentage?: number;
}

const PAGE_SIZE = 25;

export function MonitoringModal({ open, onOpenChange }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("last_access_desc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const [accessRes, clientsRes] = await Promise.all([
          (supabase as any).from("vw_last_establishment_access").select("*"),
          (supabase as any).from("vw_client_registration_status").select("*"),
        ]);
        if (accessRes.error) throw accessRes.error;
        const clientsMap = new Map<string, any>();
        (clientsRes.data || []).forEach((c: any) => clientsMap.set(c.establishment_id, c));
        const merged: Row[] = (accessRes.data || []).map((r: any) => {
          const c = clientsMap.get(r.id);
          return {
            ...r,
            total_clients: c?.total_clients ?? 0,
            clients_pending: c?.clients_pending ?? 0,
            pending_percentage: c?.pending_percentage ?? 0,
          };
        });
        setRows(merged);
      } catch (e: any) {
        console.error("[MonitoringModal]", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const filtered = useMemo(() => {
    let list = rows;
    if (planFilter !== "all") list = list.filter((r) => r.subscription_plan === planFilter);
    if (statusFilter !== "all") {
      list = list.filter((r) => {
        const d = r.days_since_last_access;
        if (statusFilter === "active") return d !== null && d < 7;
        if (statusFilter === "risk") return d !== null && d >= 7 && d < 30;
        if (statusFilter === "inactive") return d === null || d >= 30;
        return true;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || (r.owner_name || "").toLowerCase().includes(q));
    }
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case "last_access_asc":
          return (a.last_access_at || "").localeCompare(b.last_access_at || "");
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "clients_desc":
          return (b.total_clients || 0) - (a.total_clients || 0);
        case "pending_desc":
          return (b.pending_percentage || 0) - (a.pending_percentage || 0);
        default:
          return (b.last_access_at || "").localeCompare(a.last_access_at || "");
      }
    });
    return sorted;
  }, [rows, planFilter, statusFilter, search, sortBy]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const summary = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.days_since_last_access !== null && r.days_since_last_access < 7).length;
    const inactive = rows.filter((r) => r.days_since_last_access === null || r.days_since_last_access >= 30).length;
    const totalClients = rows.reduce((s, r) => s + (r.total_clients || 0), 0);
    const totalPending = rows.reduce((s, r) => s + (r.clients_pending || 0), 0);
    return { total, active, inactive, totalClients, totalPending };
  }, [rows]);

  const statusBadge = (d: number | null) => {
    if (d === null) return <Badge variant="outline" className="bg-muted text-muted-foreground">Sem acesso</Badge>;
    if (d < 7) return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Ativo</Badge>;
    if (d < 30) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Risco</Badge>;
    return <Badge className="bg-red-100 text-red-800 border-red-300"><AlertTriangle className="h-3 w-3 mr-1" />Inativo</Badge>;
  };

  const pendingBadge = (pct: number) => {
    if (pct <= 5) return "text-green-700";
    if (pct <= 15) return "text-yellow-700";
    return "text-red-700 font-semibold";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Monitoramento de Salões
            </DialogTitle>
          </DialogHeader>

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total", value: summary.total, icon: Users },
              { label: "Ativos (<7d)", value: summary.active, color: "text-green-600" },
              { label: "Inativos (>30d)", value: summary.inactive, color: "text-red-600" },
              { label: "Clientes", value: summary.totalClients.toLocaleString("pt-BR") },
              { label: "Pendentes", value: summary.totalPending.toLocaleString("pt-BR"), color: "text-orange-600" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color || ""}`}>{loading ? "…" : s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar salão ou dono..."
                className="pl-8"
              />
            </div>
            <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Plano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="essential">Essencial</SelectItem>
                <SelectItem value="pro">Profissional</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos (&lt;7d)</SelectItem>
                <SelectItem value="risk">Risco (7-30d)</SelectItem>
                <SelectItem value="inactive">Inativos (&gt;30d)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger><SelectValue placeholder="Ordenar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last_access_desc">Último acesso (recente)</SelectItem>
                <SelectItem value="last_access_asc">Último acesso (antigo)</SelectItem>
                <SelectItem value="name_asc">Nome (A-Z)</SelectItem>
                <SelectItem value="clients_desc">Mais clientes</SelectItem>
                <SelectItem value="pending_desc">Mais pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
          <div className="border rounded-lg overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2">Salão</th>
                  <th className="text-left px-3 py-2 hidden md:table-cell">Plano</th>
                  <th className="text-right px-3 py-2 hidden sm:table-cell">Clientes</th>
                  <th className="text-right px-3 py-2 hidden sm:table-cell">Pendentes</th>
                  <th className="text-left px-3 py-2 hidden lg:table-cell">Último acesso</th>
                  <th className="text-left px-3 py-2 hidden lg:table-cell">Última página</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="p-2"><Skeleton className="h-8 w-full" /></td></tr>
                  ))
                ) : paged.length === 0 ? (
                  <tr><td colSpan={8} className="text-center p-6 text-muted-foreground">Nenhum salão encontrado.</td></tr>
                ) : (
                  paged.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.owner_name || "—"}</div>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <Badge variant="outline">{r.subscription_plan}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right hidden sm:table-cell">{r.total_clients ?? 0}</td>
                      <td className={`px-3 py-2 text-right hidden sm:table-cell ${pendingBadge(r.pending_percentage || 0)}`}>
                        {r.clients_pending ?? 0} ({r.pending_percentage ?? 0}%)
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        {r.last_access_at ? formatDateTime(r.last_access_at) : <span className="text-muted-foreground">Nunca</span>}
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">{r.last_page_accessed || "—"}</td>
                      <td className="px-3 py-2">{statusBadge(r.days_since_last_access)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedId(r.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">{filtered.length} salões</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <span className="text-xs">Página {page} de {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EstablishmentMonitoringDetails
        establishmentId={selectedId}
        open={!!selectedId}
        onOpenChange={(v) => !v && setSelectedId(null)}
      />
    </>
  );
}
