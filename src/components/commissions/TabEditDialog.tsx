import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, History, Save, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ManagerPinDialog, logManagerOverride } from "@/components/security/ManagerPinDialog";

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

interface TabCommission {
  id: string;
  professional_id: string;
  commission_amount: number;
  description: string | null;
  is_manual: boolean;
  professionals: { name: string } | null;
}

interface ClosedTab {
  id: string;
  client_name: string;
  closed_at: string;
  total: number;
  subtotal: number;
  discount_amount: number | null;
  recognized_at: string | null;
  tab_items: TabItem[];
  commissions: TabCommission[];
}

interface Professional {
  id: string;
  name: string;
}

interface AuditLog {
  id: string;
  action: string;
  justification: string | null;
  created_at: string;
  old_values: any;
  new_values: any;
}

interface TabEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: ClosedTab | null;
  professionals: Professional[];
  establishmentId: string;
  onSuccess: () => void;
}

export function TabEditDialog({
  open,
  onOpenChange,
  tab,
  professionals,
  establishmentId,
  onSuccess,
}: TabEditDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [commissions, setCommissions] = useState<TabCommission[]>([]);

  // PIN gating
  type PendingAction =
    | { type: "add" }
    | { type: "delete"; commissionId: string }
    | { type: "edit"; commissionId: string; newAmount: number; oldAmount: number };
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Edit value flow
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editJustification, setEditJustification] = useState<string>("");

  // New commission form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCommission, setNewCommission] = useState({
    professional_id: "",
    commission_type: "percentage" as "percentage" | "fixed",
    commission_value: 0,
    reference_item_id: "",
    justification: "",
  });

  useEffect(() => {
    if (tab) {
      setCommissions(tab.commissions || []);
      fetchAuditLogs();
    }
  }, [tab]);

  const fetchAuditLogs = async () => {
    if (!tab) return;

    const commissionIds = tab.commissions.map(c => c.id);
    if (commissionIds.length === 0) return;

    const { data } = await supabase
      .from("commission_audit_log")
      .select("*")
      .in("commission_id", commissionIds)
      .order("created_at", { ascending: false });

    setAuditLogs(data || []);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const requestAdd = () => {
    if (!newCommission.professional_id || !newCommission.justification) {
      toast.error("Preencha o profissional e a justificativa");
      return;
    }
    setPendingAction({ type: "add" });
    setPinOpen(true);
  };

  const requestDelete = (commissionId: string) => {
    setPendingAction({ type: "delete", commissionId });
    setPinOpen(true);
  };

  const startEdit = (commission: TabCommission) => {
    setEditingId(commission.id);
    setEditValue(Number(commission.commission_amount).toFixed(2));
    setEditJustification("");
  };

  const requestEdit = () => {
    if (!editingId) return;
    const newAmount = parseFloat((editValue || "0").replace(",", "."));
    if (isNaN(newAmount) || newAmount < 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!editJustification.trim()) {
      toast.error("Informe a justificativa");
      return;
    }
    const cur = commissions.find((c) => c.id === editingId);
    if (!cur) return;
    setPendingAction({
      type: "edit",
      commissionId: editingId,
      newAmount,
      oldAmount: Number(cur.commission_amount),
    });
    setPinOpen(true);
  };

  const performAdd = async (managerProfessionalId: string) => {
    setLoading(true);
    try {
      let commissionAmount = newCommission.commission_value;
      if (newCommission.commission_type === "percentage" && newCommission.reference_item_id) {
        const item = tab?.tab_items.find((i) => i.id === newCommission.reference_item_id);
        if (item) {
          commissionAmount = (Number(item.total_price) * newCommission.commission_value) / 100;
        }
      }

      const { data, error } = await supabase
        .from("professional_commissions")
        .insert({
          establishment_id: establishmentId,
          professional_id: newCommission.professional_id,
          tab_id: tab?.id,
          commission_amount: commissionAmount,
          reference_value: newCommission.reference_item_id
            ? Number(tab?.tab_items.find((i) => i.id === newCommission.reference_item_id)?.total_price || 0)
            : 0,
          description: newCommission.justification,
          is_manual: true,
          justification: newCommission.justification,
          created_by: user?.id,
          status: "pending",
        })
        .select(`
          id,
          professional_id,
          commission_amount,
          description,
          is_manual,
          professionals:professional_id(name)
        `)
        .single();

      if (error) throw error;

      await supabase.from("commission_audit_log").insert({
        commission_id: data.id,
        user_id: user?.id,
        action: "created_manual",
        new_values: {
          amount: commissionAmount,
          type: newCommission.commission_type,
          value: newCommission.commission_value,
        },
        justification: newCommission.justification,
      });

      await logManagerOverride({
        establishmentId,
        managerProfessionalId,
        actionType: "commission_create_manual",
        targetType: "professional_commission",
        targetId: data.id,
        tabId: tab?.id,
        newValue: { amount: commissionAmount, professional_id: newCommission.professional_id },
        reason: newCommission.justification,
      });

      setCommissions([...commissions, data as TabCommission]);
      setShowAddForm(false);
      setNewCommission({
        professional_id: "",
        commission_type: "percentage",
        commission_value: 0,
        reference_item_id: "",
        justification: "",
      });

      toast.success("Comissão adicionada com sucesso!");
      fetchAuditLogs();
    } catch (error) {
      console.error("Error adding commission:", error);
      toast.error("Erro ao adicionar comissão");
    } finally {
      setLoading(false);
    }
  };

  const performDelete = async (commissionId: string, managerProfessionalId: string) => {
    const commission = commissions.find((c) => c.id === commissionId);
    if (!commission) return;
    try {
      await supabase.from("commission_audit_log").insert({
        commission_id: commissionId,
        user_id: user?.id,
        action: "deleted",
        old_values: {
          amount: commission.commission_amount,
          description: commission.description,
        },
        justification: "Comissão removida (autorizado por gerente)",
      });

      const { error } = await supabase
        .from("professional_commissions")
        .delete()
        .eq("id", commissionId);

      if (error) throw error;

      await logManagerOverride({
        establishmentId,
        managerProfessionalId,
        actionType: "commission_delete",
        targetType: "professional_commission",
        targetId: commissionId,
        tabId: tab?.id,
        oldValue: { amount: commission.commission_amount },
        reason: "Comissão removida via TabEditDialog",
      });

      setCommissions(commissions.filter((c) => c.id !== commissionId));
      toast.success("Comissão removida!");
    } catch (error) {
      console.error("Error deleting commission:", error);
      toast.error("Erro ao remover comissão");
    }
  };

  const performEdit = async (
    commissionId: string,
    newAmount: number,
    oldAmount: number,
    managerProfessionalId: string,
  ) => {
    try {
      const { error } = await supabase
        .from("professional_commissions")
        .update({ commission_amount: newAmount })
        .eq("id", commissionId);
      if (error) throw error;

      await supabase.from("commission_audit_log").insert({
        commission_id: commissionId,
        user_id: user?.id,
        action: "updated",
        old_values: { amount: oldAmount },
        new_values: { amount: newAmount },
        justification: editJustification,
      });

      await logManagerOverride({
        establishmentId,
        managerProfessionalId,
        actionType: "commission_amount_override",
        targetType: "professional_commission",
        targetId: commissionId,
        tabId: tab?.id,
        oldValue: { amount: oldAmount },
        newValue: { amount: newAmount },
        reason: editJustification,
      });

      setCommissions(
        commissions.map((c) =>
          c.id === commissionId ? { ...c, commission_amount: newAmount } : c,
        ),
      );
      setEditingId(null);
      setEditValue("");
      setEditJustification("");
      toast.success("Valor da comissão atualizado");
      fetchAuditLogs();
    } catch (e) {
      console.error("Error updating commission:", e);
      toast.error("Erro ao atualizar comissão");
    }
  };

  const runPendingAction = async (managerProfessionalId: string) => {
    if (!pendingAction) return;
    if (pendingAction.type === "add") await performAdd(managerProfessionalId);
    else if (pendingAction.type === "delete") await performDelete(pendingAction.commissionId, managerProfessionalId);
    else if (pendingAction.type === "edit")
      await performEdit(
        pendingAction.commissionId,
        pendingAction.newAmount,
        pendingAction.oldAmount,
        managerProfessionalId,
      );
    setPendingAction(null);
  };

  if (!tab) return null;

  const totalCommissions = commissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Editar Comanda - {tab.client_name}</span>
            {tab.recognized_at && (
              <Badge variant="default" className="bg-green-600">Reconhecida</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Tab Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumo da Comanda</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Data/Hora</span>
                    <p className="font-medium">
                      {format(new Date(tab.closed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Subtotal</span>
                    <p className="font-medium">{formatCurrency(Number(tab.subtotal))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Desconto</span>
                    <p className="font-medium">{formatCurrency(Number(tab.discount_amount || 0))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total</span>
                    <p className="font-bold text-lg">{formatCurrency(Number(tab.total))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Itens ({tab.tab_items.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tab.tab_items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{item.name}</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {item.item_type === "service" ? "Serviço" : "Produto"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{item.professionals?.name || "-"}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(item.total_price))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Commissions */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Comissões ({commissions.length}) - Total: {formatCurrency(totalCommissions)}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddForm(!showAddForm)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Add Commission Form */}
                {showAddForm && (
                  <div className="p-4 mb-4 border rounded-lg bg-muted/50 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Profissional *</Label>
                        <Select
                          value={newCommission.professional_id}
                          onValueChange={(v) => setNewCommission({ ...newCommission, professional_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {professionals.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select
                          value={newCommission.commission_type}
                          onValueChange={(v: "percentage" | "fixed") => 
                            setNewCommission({ ...newCommission, commission_type: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentual (%)</SelectItem>
                            <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {newCommission.commission_type === "percentage" && (
                        <div className="space-y-2">
                          <Label>Sobre qual item?</Label>
                          <Select
                            value={newCommission.reference_item_id}
                            onValueChange={(v) => setNewCommission({ ...newCommission, reference_item_id: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {tab.tab_items.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} - {formatCurrency(Number(item.total_price))}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>
                          Valor {newCommission.commission_type === "percentage" ? "(%)" : "(R$)"}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={newCommission.commission_type === "percentage" ? 100 : undefined}
                          step={newCommission.commission_type === "percentage" ? 1 : 0.01}
                          value={newCommission.commission_value}
                          onChange={(e) => setNewCommission({
                            ...newCommission,
                            commission_value: parseFloat(e.target.value) || 0
                          })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Justificativa *</Label>
                      <Textarea
                        value={newCommission.justification}
                        onChange={(e) => setNewCommission({ ...newCommission, justification: e.target.value })}
                        placeholder="Explique o motivo desta comissão..."
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowAddForm(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={requestAdd} disabled={loading}>
                        <Save className="h-4 w-4 mr-1" />
                        Salvar Comissão
                      </Button>
                    </div>
                  </div>
                )}

                {/* Commission List */}
                {commissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma comissão registrada
                  </p>
                ) : (
                  <div className="space-y-2">
                    {commissions.map((commission) => {
                      const isEditing = editingId === commission.id;
                      return (
                        <div
                          key={commission.id}
                          className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{commission.professionals?.name}</span>
                                {commission.is_manual && (
                                  <Badge variant="outline" className="text-xs">Manual</Badge>
                                )}
                              </div>
                              {commission.description && (
                                <p className="text-sm text-muted-foreground">{commission.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-green-600">
                                {formatCurrency(Number(commission.commission_amount))}
                              </span>
                              {!isEditing && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  title="Ajustar valor (PIN do gerente)"
                                  onClick={() => startEdit(commission)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {commission.is_manual && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => requestDelete(commission.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {isEditing && (
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-end">
                              <div className="space-y-1">
                                <Label className="text-xs">Novo valor (R$)</Label>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={editValue}
                                  onChange={(e) =>
                                    setEditValue(
                                      e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Justificativa *</Label>
                                <Input
                                  value={editJustification}
                                  onChange={(e) => setEditJustification(e.target.value)}
                                  placeholder="Motivo do ajuste"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditValue("");
                                    setEditJustification("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button size="sm" onClick={requestEdit}>
                                  <ShieldAlert className="h-4 w-4 mr-1" />
                                  Autorizar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Audit History */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico de Alterações
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    {showHistory ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>
              </CardHeader>
              {showHistory && (
                <CardContent>
                  {auditLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma alteração registrada
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="text-sm p-2 bg-muted/30 rounded"
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {log.action === "created_manual" && "Comissão criada"}
                              {log.action === "deleted" && "Comissão removida"}
                              {log.action === "recognized" && "Reconhecida"}
                              {log.action === "updated" && "Atualizada"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {log.justification && (
                            <p className="text-muted-foreground mt-1">{log.justification}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={onSuccess}>
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
