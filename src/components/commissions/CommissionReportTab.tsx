import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Download, 
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Commission {
  id: string;
  professional_id: string;
  commission_amount: number;
  reference_value: number;
  description: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  professionals: { name: string } | null;
  commission_rules: { name: string; commission_type: string; commission_value: number } | null;
  tab_items: { name: string; quantity: number } | null;
}

interface Professional {
  id: string;
  name: string;
}

interface ProfessionalSummary {
  professional_id: string;
  professional_name: string;
  total_services: number;
  total_reference: number;
  total_commission: number;
  pending: number;
  approved: number;
  paid: number;
}

interface CommissionReportTabProps {
  establishmentId: string;
}

export function CommissionReportTab({ establishmentId }: CommissionReportTabProps) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfessional, setSelectedProfessional] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [summaries, setSummaries] = useState<ProfessionalSummary[]>([]);

  useEffect(() => {
    fetchData();
  }, [establishmentId, selectedProfessional, dateFrom, dateTo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch professionals
      const { data: profsData } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", establishmentId)
        .eq("is_active", true)
        .order("name");

      setProfessionals(profsData || []);

      // Build commissions query
      let query = supabase
        .from("professional_commissions")
        .select(`
          *,
          professionals:professional_id(name),
          commission_rules:commission_rule_id(name, commission_type, commission_value),
          tab_items:tab_item_id(name, quantity)
        `)
        .eq("establishment_id", establishmentId)
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: false });

      if (selectedProfessional !== "all") {
        query = query.eq("professional_id", selectedProfessional);
      }

      const { data: commissionsData, error } = await query;

      if (error) throw error;
      setCommissions((commissionsData as Commission[]) || []);

      // Calculate summaries by professional
      const summaryMap = new Map<string, ProfessionalSummary>();

      for (const comm of (commissionsData || []) as Commission[]) {
        const profId = comm.professional_id;
        const profName = comm.professionals?.name || "Desconhecido";

        if (!summaryMap.has(profId)) {
          summaryMap.set(profId, {
            professional_id: profId,
            professional_name: profName,
            total_services: 0,
            total_reference: 0,
            total_commission: 0,
            pending: 0,
            approved: 0,
            paid: 0,
          });
        }

        const summary = summaryMap.get(profId)!;
        summary.total_services += 1;
        summary.total_reference += comm.reference_value;
        summary.total_commission += comm.commission_amount;

        if (comm.status === "pending") summary.pending += comm.commission_amount;
        else if (comm.status === "approved") summary.approved += comm.commission_amount;
        else if (comm.status === "paid") summary.paid += comm.commission_amount;
      }

      setSummaries(Array.from(summaryMap.values()).sort((a, b) => b.total_commission - a.total_commission));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      approved: { label: "Aprovada", variant: "default" },
      paid: { label: "Paga", variant: "outline" },
      cancelled: { label: "Cancelada", variant: "destructive" },
    };
    const c = config[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const setQuickPeriod = (period: string) => {
    const today = new Date();
    switch (period) {
      case "current_month":
        setDateFrom(format(startOfMonth(today), "yyyy-MM-dd"));
        setDateTo(format(endOfMonth(today), "yyyy-MM-dd"));
        break;
      case "last_month":
        const lastMonth = subMonths(today, 1);
        setDateFrom(format(startOfMonth(lastMonth), "yyyy-MM-dd"));
        setDateTo(format(endOfMonth(lastMonth), "yyyy-MM-dd"));
        break;
      case "last_3_months":
        setDateFrom(format(startOfMonth(subMonths(today, 2)), "yyyy-MM-dd"));
        setDateTo(format(endOfMonth(today), "yyyy-MM-dd"));
        break;
    }
  };

  const exportToCSV = () => {
    if (commissions.length === 0) {
      toast.error("Nenhuma comissão para exportar");
      return;
    }

    const headers = [
      "Profissional",
      "Descrição",
      "Regra",
      "Valor Referência",
      "Comissão",
      "Status",
      "Data",
    ];

    const rows = commissions.map((c) => [
      c.professionals?.name || "-",
      c.description || "-",
      c.commission_rules?.name || "-",
      c.reference_value.toFixed(2),
      c.commission_amount.toFixed(2),
      c.status,
      format(new Date(c.created_at), "dd/MM/yyyy"),
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_comissoes_${dateFrom}_${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado com sucesso!");
  };

  const totalStats = {
    totalServices: commissions.length,
    totalReference: commissions.reduce((sum, c) => sum + c.reference_value, 0),
    totalCommission: commissions.reduce((sum, c) => sum + c.commission_amount, 0),
    avgCommission: commissions.length > 0 
      ? commissions.reduce((sum, c) => sum + c.commission_amount, 0) / commissions.length 
      : 0,
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando relatório...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtros do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Período Rápido</Label>
              <Select onValueChange={setQuickPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">Mês Atual</SelectItem>
                  <SelectItem value="last_month">Mês Anterior</SelectItem>
                  <SelectItem value="last_3_months">Últimos 3 Meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os profissionais</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Total Serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalStats.totalServices}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Valor Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalStats.totalReference)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Comissões Totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalStats.totalCommission)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Média por Serviço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalStats.avgCommission)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary by Professional */}
      {summaries.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Resumo por Profissional
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead className="text-center">Atendimentos</TableHead>
                  <TableHead className="text-right">Valor Referência</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-right">Aprovado</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Total Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((summary) => (
                  <TableRow key={summary.professional_id}>
                    <TableCell className="font-medium">{summary.professional_name}</TableCell>
                    <TableCell className="text-center">{summary.total_services}</TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.total_reference)}</TableCell>
                    <TableCell className="text-right text-orange-500">{formatCurrency(summary.pending)}</TableCell>
                    <TableCell className="text-right text-blue-500">{formatCurrency(summary.approved)}</TableCell>
                    <TableCell className="text-right text-green-500">{formatCurrency(summary.paid)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(summary.total_commission)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detailed List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhamento das Comissões
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead className="text-right">Ref. Valor</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">Nenhuma comissão encontrada no período</p>
                  </TableCell>
                </TableRow>
              ) : (
                commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell>
                      {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {commission.professionals?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{commission.description || "-"}</p>
                        {commission.tab_items?.name && (
                          <p className="text-xs text-muted-foreground">
                            Item: {commission.tab_items.name} (x{commission.tab_items.quantity})
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {commission.commission_rules ? (
                        <div>
                          <p className="text-sm">{commission.commission_rules.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {commission.commission_rules.commission_type === "percentage"
                              ? `${commission.commission_rules.commission_value}%`
                              : formatCurrency(commission.commission_rules.commission_value)}
                          </p>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(commission.reference_value)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(commission.commission_amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(commission.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
