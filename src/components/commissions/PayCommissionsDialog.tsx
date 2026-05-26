import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";

export interface Split {
  method: string;
  amount: string; // string for input
}

export interface CommissionPiece {
  id: string;
  amount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  commissions: CommissionPiece[];
  /** Recebe alocação id->método e confirma pagamento */
  onConfirm: (allocation: Record<string, string>) => Promise<void> | void;
}

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseAmount = (s: string) =>
  Number((s || "0").toString().replace(/\./g, "").replace(",", ".")) || 0;

export function PayCommissionsDialog({
  open,
  onOpenChange,
  establishmentId,
  commissions,
  onConfirm,
}: Props) {
  const { paymentMethods } = usePaymentMethods(establishmentId);
  const total = useMemo(
    () => commissions.reduce((s, c) => s + c.amount, 0),
    [commissions],
  );
  const [splits, setSplits] = useState<Split[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const first = paymentMethods[0]?.name ?? "PIX";
      setSplits([{ method: first, amount: total.toFixed(2).replace(".", ",") }]);
    }
  }, [open, total, paymentMethods]);

  const splitSum = splits.reduce((s, x) => s + parseAmount(x.amount), 0);
  const diff = Number((total - splitSum).toFixed(2));

  const addSplit = () => {
    const used = new Set(splits.map((s) => s.method));
    const next = paymentMethods.find((m) => !used.has(m.name))?.name
      ?? paymentMethods[0]?.name
      ?? "PIX";
    const remaining = Math.max(0, diff);
    setSplits([
      ...splits,
      { method: next, amount: remaining.toFixed(2).replace(".", ",") },
    ]);
  };

  const removeSplit = (idx: number) => {
    setSplits(splits.filter((_, i) => i !== idx));
  };

  const updateSplit = (idx: number, patch: Partial<Split>) => {
    setSplits(splits.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const handleConfirm = async () => {
    if (Math.abs(diff) > 0.01) {
      toast.error(
        `Soma das formas (${fmtMoney(splitSum)}) difere do total (${fmtMoney(total)})`,
      );
      return;
    }
    if (splits.some((s) => !s.method)) {
      toast.error("Selecione a forma de pagamento em todas as linhas");
      return;
    }
    // Alocação gulosa: cada comissão é atribuída inteiramente a uma forma
    const remaining = splits.map((s) => ({
      method: s.method,
      remaining: parseAmount(s.amount),
    }));
    const allocation: Record<string, string> = {};
    // Comissões em ordem decrescente para acomodar melhor
    const sorted = [...commissions].sort((a, b) => b.amount - a.amount);
    for (const c of sorted) {
      // Forma com maior saldo restante que comporte o valor
      let idx = remaining.findIndex((r) => r.remaining + 0.001 >= c.amount);
      if (idx === -1) {
        // Cai na forma com maior saldo restante
        idx = remaining.reduce(
          (best, r, i) => (r.remaining > remaining[best].remaining ? i : best),
          0,
        );
      }
      allocation[c.id] = remaining[idx].method;
      remaining[idx].remaining -= c.amount;
    }
    setSaving(true);
    try {
      await onConfirm(allocation);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const methodOptions = paymentMethods.length > 0
    ? paymentMethods.map((m) => m.name)
    : ["PIX", "Dinheiro", "Débito", "Crédito"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Formas de pagamento</DialogTitle>
          <DialogDescription>
            Informe como o acerto está sendo pago. Você pode dividir entre uma
            ou mais formas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 text-sm">
            <span>Total a pagar</span>
            <span className="font-semibold">{fmtMoney(total)}</span>
          </div>

          {splits.map((s, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_140px_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Forma</Label>
                <Select
                  value={s.method}
                  onValueChange={(v) => updateSplit(idx, { method: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {methodOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={s.amount}
                  onChange={(e) => updateSplit(idx, { amount: e.target.value })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeSplit(idx)}
                disabled={splits.length === 1}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addSplit}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar forma
          </Button>

          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <span className="text-muted-foreground">Soma informada</span>
            <span className={Math.abs(diff) > 0.01 ? "text-destructive font-semibold" : "font-semibold"}>
              {fmtMoney(splitSum)}
              {Math.abs(diff) > 0.01 && ` (faltam ${fmtMoney(diff)})`}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Salvando..." : "Confirmar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
