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
import { DollarSign, TrendingUp, Clock, CheckCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AddCommissionDialog } from "./AddCommissionDialog";

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
  commission_rules: { name: string } | null;
}

interface Professional {
  id: string;
  name: string;
}

interface CommissionTrackingTabProps {
  establishmentId: string;
}

export function CommissionTrackingTab({ establishmentId }: CommissionTrackingTabProps) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfessional, setSelectedProfessional] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    paid: 0,
    total: 0,
  });

  useEffect(() => {
    fetchData();
  }, [establishmentId, selectedProfessional, selectedStatus]);

  const fetchData = async () => {
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
          commission_rules:commission_rule_id(name)
        `)
        .eq("establishment_id", establishmentId)
        .order("created_at", { ascending: false });

      if (selectedProfessional !== "all") {
        query = query.eq("professional_id", selectedProfessional);
      }

      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }

      const { data: commissionsData, error } = await query.limit(100);

      if (error) throw error;
      setCommissions(commissionsData || []);

      // Calculate stats
      const allCommissions = commissionsData || [];
      setStats({
        pending: allCommissions
          .filter((c) => c.status === "pending")
          .reduce((sum, c) => sum + c.commission_amount, 0),
        approved: allCommissions
          .filter((c) => c.status === "approved")
          .reduce((sum, c) => sum + c.commission_amount, 0),
        paid: allCommissions
          .filter((c) => c.status === "paid")
          .reduce((sum, c) => sum + c.commission_amount, 0),
        total: allCommissions.reduce((sum, c) => sum + c.commission_amount, 0),
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar comissões");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (commissionId: string, newStatus: string) => {
    try {
      const updateData: Record<string, any> = { status: newStatus };

      if (newStatus === "approved") {
        updateData.approved_at = new Date().toISOString();
      } else if (newStatus === "paid") {
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("professional_commissions")
        .update(updateData)
        .eq("id", commissionId);

      if (error) throw error;

      toast.success(
        newStatus === "approved"
          ? "Comissão aprovada!"
          : newStatus === "paid"
          ? "Comissão marcada como paga!"
          : "Status atualizado!"
      );
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
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

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">{formatCurrency(stats.pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Aprovadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-500">{formatCurrency(stats.approved)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pagas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{formatCurrency(stats.paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(stats.total)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-4">
          <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Profissional" />
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

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="approved">Aprovadas</SelectItem>
              <SelectItem value="paid">Pagas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Lançar Comissão
        </Button>
      </div>

      {/* Commissions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ref. Valor</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">Nenhuma comissão encontrada</p>
                  </TableCell>
                </TableRow>
              ) : (
                commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="font-medium">
                      {commission.professionals?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{commission.description || "-"}</p>
                        {commission.commission_rules?.name && (
                          <p className="text-xs text-muted-foreground">
                            Regra: {commission.commission_rules.name}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(commission.reference_value)}</TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(commission.commission_amount)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getStatusBadge(commission.status)}</TableCell>
                    <TableCell className="text-right">
                      {commission.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(commission.id, "approved")}
                        >
                          Aprovar
                        </Button>
                      )}
                      {commission.status === "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(commission.id, "paid")}
                        >
                          Marcar Paga
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddCommissionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        establishmentId={establishmentId}
        professionals={professionals}
        onSuccess={fetchData}
      />
    </div>
  );
}
