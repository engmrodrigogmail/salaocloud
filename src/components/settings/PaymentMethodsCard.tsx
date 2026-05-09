import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Pencil, Trash2, Loader2, Power } from "lucide-react";
import { toast } from "sonner";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import type { PaymentMethod } from "@/types/tabs";

const TYPE_LABELS: Record<PaymentMethod["type"], string> = {
  pix: "PIX",
  cash: "Dinheiro",
  debit_card: "Cartão de Débito",
  credit_card: "Cartão de Crédito",
  other: "Outro",
};

interface Props {
  establishmentId: string | null;
}

interface FormState {
  name: string;
  type: PaymentMethod["type"];
  allows_installments: boolean;
  max_installments: string;
  has_interest: boolean;
  interest_rate: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  type: "pix",
  allows_installments: false,
  max_installments: "1",
  has_interest: false,
  interest_rate: "0",
};

export function PaymentMethodsCard({ establishmentId }: Props) {
  const { paymentMethods, loading, createPaymentMethod, updatePaymentMethod, deletePaymentMethod } =
    usePaymentMethods(establishmentId, { includeInactive: true });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setForm({
      name: m.name,
      type: m.type,
      allows_installments: m.allows_installments,
      max_installments: String(m.max_installments ?? 1),
      has_interest: m.has_interest,
      interest_rate: String(m.interest_rate ?? 0),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome da forma de pagamento", { position: "top-center", duration: 2000 });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      allows_installments: form.allows_installments,
      max_installments: Math.max(1, parseInt(form.max_installments || "1", 10) || 1),
      has_interest: form.has_interest,
      interest_rate: parseFloat((form.interest_rate || "0").replace(",", ".")) || 0,
    };
    let ok = false;
    if (editing) {
      ok = await updatePaymentMethod(editing.id, payload);
    } else {
      const created = await createPaymentMethod(payload);
      ok = !!created;
    }
    setSaving(false);
    if (ok) setDialogOpen(false);
  };

  const toggleActive = async (m: PaymentMethod) => {
    await updatePaymentMethod(m.id, { is_active: !m.is_active });
  };

  const handleDelete = async (m: PaymentMethod) => {
    if (!confirm(`Remover "${m.name}"? Você poderá reativar depois.`)) return;
    await deletePaymentMethod(m.id);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Formas de pagamento
          </CardTitle>
          <CardDescription>
            Cadastre as formas de pagamento aceitas no caixa e nas comandas (PIX, dinheiro,
            cartões etc.). Métodos inativos ficam ocultos no checkout.
          </CardDescription>
        </div>
        <Button onClick={openNew} size="sm" className="self-start">
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : paymentMethods.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma forma de pagamento cadastrada. Clique em <strong>Nova</strong> para começar.
          </div>
        ) : (
          <div className="space-y-2">
            {paymentMethods.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium truncate">{m.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[m.type]}
                    </Badge>
                    {!m.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  {m.allows_installments && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Até {m.max_installments}x
                      {m.has_interest && m.interest_rate > 0
                        ? ` · juros ${m.interest_rate}% a.m.`
                        : " · sem juros"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleActive(m)}
                    title={m.is_active ? "Desativar" : "Ativar"}
                  >
                    <Power className={`h-4 w-4 ${m.is_active ? "text-primary" : "text-muted-foreground"}`} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(m)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(m)}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar forma de pagamento" : "Nova forma de pagamento"}</DialogTitle>
            <DialogDescription>
              Configure como esse método aparecerá no caixa e nas comandas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pm-name">Nome</Label>
              <Input
                id="pm-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: PIX, Dinheiro, Visa Crédito"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as PaymentMethod["type"] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="cursor-pointer">Permite parcelamento</Label>
                <p className="text-xs text-muted-foreground">Geralmente para cartão de crédito.</p>
              </div>
              <Switch
                checked={form.allows_installments}
                onCheckedChange={(v) => setForm((f) => ({ ...f, allows_installments: v }))}
              />
            </div>

            {form.allows_installments && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pm-max">Máximo de parcelas</Label>
                  <Input
                    id="pm-max"
                    type="text"
                    inputMode="numeric"
                    value={form.max_installments}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        max_installments: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder="12"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label className="cursor-pointer">Cobra juros</Label>
                    <p className="text-xs text-muted-foreground">Aplicado por mês.</p>
                  </div>
                  <Switch
                    checked={form.has_interest}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, has_interest: v }))}
                  />
                </div>

                {form.has_interest && (
                  <div className="space-y-2">
                    <Label htmlFor="pm-interest">Juros mensais (%)</Label>
                    <Input
                      id="pm-interest"
                      type="text"
                      inputMode="decimal"
                      value={form.interest_rate}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          interest_rate: e.target.value.replace(/[^0-9.,]/g, ""),
                        }))
                      }
                      placeholder="2.99"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
