import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Edit, FileText, Filter, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TabEditDialog } from "./TabEditDialog";

interface ClosedTab {
  id: string;
  client_name: string;
  closed_at: string;
  total: number;
  subtotal: number;
  discount_amount: number | null;
  recognized_at: string | null;
  recognized_by: string | null;
  professional_id: string | null;
  professionals: { id: string; name: string } | null;
  tab_items: TabItem[];
  tab_payments: TabPayment[];
  commissions: TabCommission[];
}

interface TabItem {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  item_type: string;
  professional_id: string | null;
  professionals: { name: string } | null;
}

interface TabPayment {
  id: string;
  payment_method_name: string;
  amount: number;
}

interface TabCommission {
  id: string;
  professional_id: string;
  commission_amount: number;
  description: string | null;
  is_manual: boolean;
  professionals: { name: string } | null;
}

interface Professional {
  id: string;
  name: string;
}

interface TabVerificationTabProps {
  establishmentId: string;
}

export function TabVerificationTab({ establishmentId }: TabVerificationTabProps) {
  const { user } = useAuth();
  const [tabs, setTabs] = useState<ClosedTab[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProfessional, setFilterProfessional] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingTab, setEditingTab] = useState<ClosedTab | null>(null);

  useEffect(() => {
    fetchData();
  }, [establishmentId, filterProfessional, filterStatus, dateFrom, dateTo]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch professionals
      const { data: profsData } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", establishmentId)
        .eq("is_active", true)
        .order("name");

      setProfessionals(profsData || []);

      // Build tabs query
      let query = supabase
        .from("tabs")
        .select(`
          id,
          client_name,
          closed_at,
          total,
          subtotal,
          discount_amount,
          recognized_at,
          recognized_by,
          professional_id,
          professionals:professional_id(id, name),
          tab_items(
            id,
            name,
            unit_price,
            quantity,
            total_price,
            item_type,
            professional_id,
            professionals:professional_id(name)
          ),
          tab_payments(id, payment_method_name, amount)
        `)
        .eq("establishment_id", establishmentId)
        .eq("status", "closed")
        .order("closed_at", { ascending: false });

      if (filterStatus === "pending") {
        query = query.is("recognized_at", null);
      } else if (filterStatus === "recognized") {
        query = query.not("recognized_at", "is", null);
      }

      if (filterProfessional !== "all") {
        query = query.eq("professional_id", filterProfessional);
      }

      if (dateFrom) {
        query = query.gte("closed_at", `${dateFrom}T00:00:00`);
      }

      if (dateTo) {
        query = query.lte("closed_at", `${dateTo}T23:59:59`);
      }

      const { data: tabsData, error } = await query.limit(100);

      if (error) throw error;

      // Fetch commissions for these tabs
      if (tabsData && tabsData.length > 0) {
        const tabIds = tabsData.map(t => t.id);
        const { data: commissionsData } = await supabase
          .from("professional_commissions")
          .select(`
            id,
            tab_id,
            professional_id,
            commission_amount,
            description,
            is_manual,
            professionals:professional_id(name)
          `)
          .in("tab_id", tabIds);

        const commissionsMap = new Map<string, TabCommission[]>();
        (commissionsData || []).forEach((c: any) => {
          if (!commissionsMap.has(c.tab_id)) {
            commissionsMap.set(c.tab_id, []);
          }
          commissionsMap.get(c.tab_id)!.push({
            id: c.id,
            professional_id: c.professional_id,
            commission_amount: c.commission_amount,
            description: c.description,
            is_manual: c.is_manual || false,
            professionals: c.professionals,
          });
        });

        const tabsWithCommissions = tabsData.map((tab: any) => ({
          ...tab,
          commissions: commissionsMap.get(tab.id) || [],
        }));

        setTabs(tabsWithCommissions);
      } else {
        setTabs([]);
      }
    } catch (error) {
      console.error("Error fetching tabs:", error);
      toast.error("Erro ao carregar comandas");
    } finally {
      setLoading(false);
    }
  };

  const handleRecognize = async (tabId: string) => {
    try {
      const { error } = await supabase
        .from("tabs")
        .update({
          recognized_at: new Date().toISOString(),
          recognized_by: user?.id,
        })
        .eq("id", tabId);

      if (error) throw error;

      // Log the recognition action for all related commissions
      const tab = tabs.find(t => t.id === tabId);
      if (tab && tab.commissions.length > 0) {
        const auditLogs = tab.commissions.map(c => ({
          commission_id: c.id,
          user_id: user?.id,
          action: "recognized",
          justification: "Comanda reconhecida oficialmente",
        }));

        await supabase.from("commission_audit_log").insert(auditLogs);
      }

      toast.success("Comanda reconhecida com sucesso!");
      fetchData();
    } catch (error) {
      console.error("Error recognizing tab:", error);
      toast.error("Erro ao reconhecer comanda");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const filteredTabs = tabs.filter(tab =>
    tab.client_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats
  const stats = {
    total: filteredTabs.length,
    pending: filteredTabs.filter(t => !t.recognized_at).length,
    recognized: filteredTabs.filter(t => t.recognized_at).length,
    totalValue: filteredTabs.reduce((sum, t) => sum + Number(t.total), 0),
    totalCommissions: filteredTabs.reduce(
      (sum, t) => sum + t.commissions.reduce((cs, c) => cs + Number(c.commission_amount), 0),
      0
    ),
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Comandas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Comissões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalCommissions)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="recognized">Reconhecidas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterProfessional} onValueChange={setFilterProfessional}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos profissionais</SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Serviços/Produtos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Comissões</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTabs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p className="text-muted-foreground">Nenhuma comanda encontrada</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTabs.map((tab) => {
                    const tabCommissionTotal = tab.commissions.reduce(
                      (sum, c) => sum + Number(c.commission_amount),
                      0
                    );
                    const uniqueProfessionals = new Set(
                      tab.tab_items
                        .filter(i => i.professionals?.name)
                        .map(i => i.professionals?.name)
                    );

                    return (
                      <TableRow key={tab.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(tab.closed_at)}
                        </TableCell>
                        <TableCell className="font-medium">{tab.client_name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Array.from(uniqueProfessionals).map((name, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                            {uniqueProfessionals.size === 0 && tab.professionals?.name && (
                              <Badge variant="outline" className="text-xs">
                                {tab.professionals.name}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {tab.tab_items.slice(0, 2).map((item, i) => (
                              <div key={i} className="text-muted-foreground truncate max-w-[200px]">
                                {item.quantity}x {item.name}
                              </div>
                            ))}
                            {tab.tab_items.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{tab.tab_items.length - 2} itens
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(Number(tab.total))}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={tabCommissionTotal > 0 ? "text-green-600 font-medium" : ""}>
                            {formatCurrency(tabCommissionTotal)}
                          </span>
                          {tab.commissions.some(c => c.is_manual) && (
                            <Badge variant="outline" className="ml-1 text-xs">manual</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {tab.recognized_at ? (
                            <Badge variant="default" className="bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Reconhecida
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTab(tab)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {!tab.recognized_at && (
                              <Button
                                size="sm"
                                onClick={() => handleRecognize(tab.id)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Reconhecer
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <TabEditDialog
        open={!!editingTab}
        onOpenChange={(open) => !open && setEditingTab(null)}
        tab={editingTab}
        professionals={professionals}
        establishmentId={establishmentId}
        onSuccess={() => {
          setEditingTab(null);
          fetchData();
        }}
      />
    </div>
  );
}
