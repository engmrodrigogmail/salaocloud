import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Filter, DollarSign, Plus, X, FileText } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { DatePickerBR } from "@/components/ui/date-picker-br";
import { Checkbox } from "@/components/ui/checkbox";
import { AddCommissionDialog } from "./AddCommissionDialog";
import { IssueReceiptDialog } from "./IssueReceiptDialog";
import { ReceiptCommissionRow } from "@/lib/commissionReceiptPdf";

type StatusFilter = "all" | "pending" | "paid" | "cancelled";

interface Row {
  id: string;
  professional_id: string;
  professional_name: string;
  service_name: string;
  client_name: string;
  service_date: string; // ISO
  service_date_display: string;
  gross_value: number; // valor item (antes do desconto)
  tab_discount_amount: number;
  tab_discount_type: string | null;
  tab_discount_pct: number;
  tab_subtotal: number;
  commission_discount: number; // discount_applied
  commission_amount: number;
  status: string;
  paid_at: string | null;
  paid_at_display: string;
}

interface Props {
  establishmentId: string;
  establishmentName?: string;
  defaultResponsibleName?: string;
  /** Pré-aplica filtro de data do serviço (yyyy-MM-dd) */
  initialServiceFrom?: string;
  initialServiceTo?: string;
  /** Em modo modal somente leitura, esconde botão "Lançar Comissão" e ação "Marcar Paga" */
  readOnly?: boolean;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Acerto Pendente", variant: "secondary" },
  approved: { label: "Acerto Pendente", variant: "secondary" },
  paid: { label: "Paga", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CommissionDetailsTable({
  establishmentId,
  establishmentName = "",
  defaultResponsibleName = "",
  initialServiceFrom,
  initialServiceTo,
  readOnly = false,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [professionals, setProfessionals] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPaying, setBulkPaying] = useState(false);

  // Confirm "Gerar recibo?" após pagar selecionadas
  const [askReceiptOpen, setAskReceiptOpen] = useState(false);
  const [pendingReceiptIds, setPendingReceiptIds] = useState<string[]>([]);
  // Fila de recibos (um por profissional)
  const [receiptQueue, setReceiptQueue] = useState<Array<{
    professional_name: string;
    rows: ReceiptCommissionRow[];
    total: number;
  }>>([]);

  // Period filters
  const [serviceFrom, setServiceFrom] = useState(initialServiceFrom ?? "");
  const [serviceTo, setServiceTo] = useState(initialServiceTo ?? "");
  const [paymentFrom, setPaymentFrom] = useState("");
  const [paymentTo, setPaymentTo] = useState("");

  // Column filters
  const [fProfessional, setFProfessional] = useState("");
  const [fService, setFService] = useState("");
  const [fClient, setFClient] = useState("");
  const [fStatus, setFStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId, serviceFrom, serviceTo, paymentFrom, paymentTo]);

  // Auto-refresh: foco da janela, retorno à aba e realtime nas comissões deste estabelecimento
  useEffect(() => {
    if (!establishmentId) return;

    const onFocus = () => fetchData();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const channel = supabase
      .channel(`commissions-tracking-${establishmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "professional_commissions",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => fetchData(),
      )
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId]);


  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: profsData } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", establishmentId)
        .order("name");
      setProfessionals(profsData || []);

      let query = supabase
        .from("professional_commissions")
        .select(`
          id,
          professional_id,
          commission_amount,
          discount_applied,
          status,
          created_at,
          paid_at,
          description,
          professionals:professional_id(name),
          tab_items:tab_item_id(name, total_price, original_unit_price, quantity),
          tabs:tab_id(client_name, discount_amount, discount_type, subtotal, closed_at)
        `)
        .eq("establishment_id", establishmentId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (serviceFrom) query = query.gte("created_at", `${serviceFrom}T00:00:00`);
      if (serviceTo) query = query.lte("created_at", `${serviceTo}T23:59:59`);
      if (paymentFrom) query = query.gte("paid_at", `${paymentFrom}T00:00:00`);
      if (paymentTo) query = query.lte("paid_at", `${paymentTo}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;

      const mapped: Row[] = (data ?? []).map((c: any) => {
        const tab = c.tabs ?? {};
        const item = c.tab_items ?? {};
        const subtotal = Number(tab.subtotal ?? 0);
        const tabDiscountAmount = Number(tab.discount_amount ?? 0);
        const pct = subtotal > 0 ? (tabDiscountAmount / subtotal) * 100 : 0;
        const gross =
          Number(item.original_unit_price ?? item.total_price ?? 0) *
          (item.original_unit_price ? Number(item.quantity ?? 1) : 1);
        const serviceDate = tab.closed_at ?? c.created_at;
        return {
          id: c.id,
          professional_id: c.professional_id,
          professional_name: c.professionals?.name ?? "—",
          service_name: item.name ?? c.description ?? "—",
          client_name: tab.client_name ?? "—",
          service_date: serviceDate,
          service_date_display: serviceDate
            ? format(new Date(serviceDate), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : "—",
          gross_value: gross || Number(item.total_price ?? 0),
          tab_discount_amount: tabDiscountAmount,
          tab_discount_type: tab.discount_type ?? null,
          tab_discount_pct: pct,
          tab_subtotal: subtotal,
          commission_discount: Number(c.discount_applied ?? 0),
          commission_amount: Number(c.commission_amount ?? 0),
          status: c.status,
          paid_at: c.paid_at,
          paid_at_display: c.paid_at
            ? format(new Date(c.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : "",
        };
      });

      setRows(mapped);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar comissões");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fProfessional && !r.professional_name.toLowerCase().includes(fProfessional.toLowerCase())) return false;
      if (fService && !r.service_name.toLowerCase().includes(fService.toLowerCase())) return false;
      if (fClient && !r.client_name.toLowerCase().includes(fClient.toLowerCase())) return false;
      if (fStatus !== "all") {
        if (fStatus === "pending" && !(r.status === "pending" || r.status === "approved")) return false;
        if (fStatus !== "pending" && r.status !== fStatus) return false;
      }
      return true;
    });
  }, [rows, fProfessional, fService, fClient, fStatus]);

  const totals = useMemo(() => {
    const t = { pending: 0, paid: 0, gross: 0, discount: 0 };
    for (const r of filtered) {
      t.gross += r.gross_value;
      t.discount += r.commission_discount;
      if (r.status === "paid") t.paid += r.commission_amount;
      else if (r.status === "pending" || r.status === "approved") t.pending += r.commission_amount;
    }
    return t;
  }, [filtered]);

  const handleMarkPaid = async (id: string) => {
    const { error } = await supabase
      .from("professional_commissions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao marcar como paga");
      return;
    }
    toast.success("Comissão marcada como paga");
    fetchData();
  };

  const selectablePendingIds = useMemo(
    () => filtered.filter((r) => r.status === "pending" || r.status === "approved").map((r) => r.id),
    [filtered],
  );
  const allSelected = selectablePendingIds.length > 0 && selectablePendingIds.every((id) => selected.has(id));
  const someSelected = selectablePendingIds.some((id) => selected.has(id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectablePendingIds));
    }
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedTotal = useMemo(() => {
    let total = 0;
    for (const r of filtered) if (selected.has(r.id)) total += r.commission_amount;
    return total;
  }, [filtered, selected]);

  const handlePaySelected = async () => {
    const ids = Array.from(selected).filter((id) => selectablePendingIds.includes(id));
    if (ids.length === 0) {
      toast.error("Selecione ao menos uma comissão pendente");
      return;
    }
    setBulkPaying(true);
    const paidAt = new Date().toISOString();
    const { error } = await supabase
      .from("professional_commissions")
      .update({ status: "paid", paid_at: paidAt })
      .in("id", ids);
    setBulkPaying(false);
    if (error) {
      toast.error("Erro ao pagar comissões selecionadas");
      return;
    }
    toast.success(`${ids.length} comissão(ões) marcadas como pagas`);
    setPendingReceiptIds(ids);
    setAskReceiptOpen(true);
    setSelected(new Set());
    fetchData();
  };

  /** Agrupa um conjunto de comissões por profissional e enfileira recibos */
  const queueReceiptsFromIds = (ids: string[]) => {
    const byProf = new Map<string, { name: string; items: ReceiptCommissionRow[]; total: number }>();
    for (const r of rows) {
      if (!ids.includes(r.id)) continue;
      const entry = byProf.get(r.professional_id) ?? {
        name: r.professional_name,
        items: [],
        total: 0,
      };
      entry.items.push({
        service_date_display: r.service_date_display,
        service_name: r.service_name,
        client_name: r.client_name,
        gross_value: r.gross_value,
        commission_amount: r.commission_amount,
      });
      entry.total += r.commission_amount;
      byProf.set(r.professional_id, entry);
    }
    const queue = Array.from(byProf.values()).map((e) => ({
      professional_name: e.name,
      rows: e.items,
      total: e.total,
    }));
    setReceiptQueue(queue);
  };

  const confirmGenerateReceipts = () => {
    setAskReceiptOpen(false);
    if (pendingReceiptIds.length > 0) {
      queueReceiptsFromIds(pendingReceiptIds);
    }
    setPendingReceiptIds([]);
  };

  const handleRowReceipt = (row: Row) => {
    // Reemissão: agrupa todas as comissões pagas do mesmo profissional no mesmo minuto de pagamento
    const sameBatch = rows.filter(
      (r) =>
        r.status === "paid" &&
        r.professional_id === row.professional_id &&
        r.paid_at &&
        row.paid_at &&
        r.paid_at.slice(0, 16) === row.paid_at.slice(0, 16),
    );
    queueReceiptsFromIds(sameBatch.map((r) => r.id));
  };


  const clearAllFilters = () => {
    setServiceFrom(initialServiceFrom ?? "");
    setServiceTo(initialServiceTo ?? "");
    setPaymentFrom("");
    setPaymentTo("");
    setFProfessional("");
    setFService("");
    setFClient("");
    setFStatus("all");
  };

  const hasAnyFilter =
    fProfessional || fService || fClient || fStatus !== "all" ||
    paymentFrom || paymentTo ||
    (initialServiceFrom ? false : !!serviceFrom) ||
    (initialServiceTo ? false : !!serviceTo);

  return (
    <div className="space-y-4">
      {/* Period filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data do serviço (gera a comissão)</Label>
              <div className="flex items-center gap-1">
                <DatePickerBR value={serviceFrom} onChange={setServiceFrom} placeholder="Início" className="flex-1" />
                <span className="text-muted-foreground">–</span>
                <DatePickerBR value={serviceTo} onChange={setServiceTo} placeholder="Fim" className="flex-1" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data do pagamento</Label>
              <div className="flex items-center gap-1">
                <DatePickerBR value={paymentFrom} onChange={setPaymentFrom} placeholder="Início" className="flex-1" />
                <span className="text-muted-foreground">–</span>
                <DatePickerBR value={paymentTo} onChange={setPaymentTo} placeholder="Fim" className="flex-1" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap text-xs">
              <Badge variant="secondary">Pendente: {fmtMoney(totals.pending)}</Badge>
              <Badge variant="outline">Pagas: {fmtMoney(totals.paid)}</Badge>
              <Badge variant="outline">Desconto comissão: {fmtMoney(totals.discount)}</Badge>
            </div>
            <div className="flex gap-2">
              {hasAnyFilter && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <X className="h-3 w-3 mr-1" /> Limpar filtros
                </Button>
              )}
              {!readOnly && (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Lançar Comissão
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!readOnly && selected.size > 0 && (
        <Card className="border-primary">
          <CardContent className="py-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm">
              <span className="font-semibold">{selected.size}</span> selecionada(s) ·{" "}
              <span className="font-semibold">{fmtMoney(selectedTotal)}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Limpar seleção
              </Button>
              <Button size="sm" onClick={handlePaySelected} disabled={bulkPaying}>
                <DollarSign className="h-4 w-4 mr-1" />
                {bulkPaying ? "Pagando..." : "Pagar selecionadas"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {!readOnly && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      disabled={selectablePendingIds.length === 0}
                      aria-label="Selecionar todas"
                    />
                  </TableHead>
                )}
                <TableHead>Data serviço</TableHead>
                <TableHead>
                  <HeaderFilter label="Profissional" value={fProfessional} onChange={setFProfessional} />
                </TableHead>
                <TableHead>
                  <HeaderFilter label="Serviço" value={fService} onChange={setFService} />
                </TableHead>
                <TableHead>
                  <HeaderFilter label="Cliente" value={fClient} onChange={setFClient} />
                </TableHead>
                <TableHead className="text-right">Valor bruto</TableHead>
                <TableHead className="text-right">Desconto comanda</TableHead>
                <TableHead className="text-right">Desc. comissão</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>
                  <StatusHeaderFilter value={fStatus} onChange={setFStatus} />
                </TableHead>
                <TableHead>Data pagamento</TableHead>
                {!readOnly && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={readOnly ? 10 : 12} className="text-center py-12 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={readOnly ? 10 : 12} className="text-center py-12">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p className="text-muted-foreground">Nenhuma comissão encontrada</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const status = STATUS_LABELS[r.status] ?? { label: r.status, variant: "secondary" as const };
                  const isPending = r.status === "pending" || r.status === "approved";
                  const discountDisplay =
                    r.tab_discount_amount > 0
                      ? `${fmtMoney(r.tab_discount_amount)} (${r.tab_discount_pct.toFixed(1)}%)`
                      : "—";
                  return (
                    <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                      {!readOnly && (
                        <TableCell>
                          {isPending ? (
                            <Checkbox
                              checked={selected.has(r.id)}
                              onCheckedChange={() => toggleOne(r.id)}
                              aria-label="Selecionar comissão"
                            />
                          ) : null}
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap text-xs">{r.service_date_display}</TableCell>
                      <TableCell className="font-medium">{r.professional_name}</TableCell>
                      <TableCell>{r.service_name}</TableCell>
                      <TableCell>{r.client_name}</TableCell>
                      <TableCell className="text-right">{fmtMoney(r.gross_value)}</TableCell>
                      <TableCell className="text-right text-xs">{discountDisplay}</TableCell>
                      <TableCell className="text-right text-orange-600">
                        {r.commission_discount > 0 ? `- ${fmtMoney(r.commission_discount)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{fmtMoney(r.commission_amount)}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{r.paid_at_display || "—"}</TableCell>
                      {!readOnly && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {isPending && (
                              <Button size="sm" variant="outline" onClick={() => handleMarkPaid(r.id)}>
                                Marcar Paga
                              </Button>
                            )}
                            {r.status === "paid" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRowReceipt(r)}
                                title="Emitir recibo"
                              >
                                <FileText className="h-4 w-4 mr-1" /> Recibo
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>


      {!readOnly && (
        <AddCommissionDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          establishmentId={establishmentId}
          professionals={professionals}
          onSuccess={fetchData}
        />
      )}

      <AlertDialog open={askReceiptOpen} onOpenChange={setAskReceiptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar recibo?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja emitir um recibo de pagamento agora? Se houver comissões de profissionais
              diferentes, será gerado um recibo por profissional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingReceiptIds([])}>
              Não, obrigado
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmGenerateReceipts}>
              Sim, gerar recibo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {receiptQueue.length > 0 && (
        <IssueReceiptDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setReceiptQueue((q) => q.slice(1));
          }}
          establishmentName={establishmentName}
          defaultResponsibleName={defaultResponsibleName}
          professionalName={receiptQueue[0].professional_name}
          rows={receiptQueue[0].rows}
          totalPaid={receiptQueue[0].total}
        />
      )}
    </div>
  );
}

function HeaderFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {label}
          <Filter className={`h-3 w-3 ${value ? "text-primary" : "opacity-50"}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-2">
          <Label className="text-xs">Filtrar {label.toLowerCase()}</Label>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            placeholder="Digite para filtrar..."
            autoFocus
          />
          <div className="flex gap-2">
            {value && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Limpar
              </Button>
            )}
            <Button size="sm" className="flex-1" onClick={() => setOpen(false)}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StatusHeaderFilter({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
          Status
          <Filter className={`h-3 w-3 ${value !== "all" ? "text-primary" : "opacity-50"}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48" align="start">
        <div className="space-y-2">
          <Label className="text-xs">Filtrar status</Label>
          <Select value={value} onValueChange={(v) => onChange(v as StatusFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Acerto Pendente</SelectItem>
              <SelectItem value="paid">Paga</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
