import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { EntryStatus, EntryType, FinanceCategory, FinanceEntry } from "@/hooks/useFinance";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  establishmentId: string;
  defaultType: EntryType;
  categories: FinanceCategory[];
  entry?: FinanceEntry | null;
  onSave: (
    payload: Partial<FinanceEntry>,
    extra?: { recurring?: { day_of_month: number } },
  ) => Promise<boolean>;
}

export function EntryFormDialog({
  open,
  onOpenChange,
  establishmentId,
  defaultType,
  categories,
  entry,
  onSave,
}: Props) {
  const { paymentMethods } = usePaymentMethods(establishmentId);
  const [type, setType] = useState<EntryType>(defaultType);
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<EntryStatus>("paid");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (entry) {
        setType(entry.type);
        setCategoryId(entry.category_id);
        setDescription(entry.description);
        setAmount(String(entry.amount).replace(".", ","));
        setDate(entry.date);
        setStatus(entry.status);
        setPaymentMethod(entry.payment_method ?? "");
        setMakeRecurring(false);
      } else {
        setType(defaultType);
        setCategoryId("");
        setDescription("");
        setAmount("");
        setDate(new Date().toISOString().slice(0, 10));
        setStatus("paid");
        setPaymentMethod("");
        setMakeRecurring(false);
        setDayOfMonth(String(new Date().getDate()));
      }
    }
  }, [open, entry, defaultType]);

  const filteredCats = categories.filter((c) => c.type === type);

  const handleSave = async () => {
    const numericAmount = parseFloat(amount.replace(",", "."));
    if (!categoryId || !description.trim() || !numericAmount || numericAmount <= 0) return;
    if (status === "paid" && !paymentMethod) return;

    setSaving(true);
    const ok = await onSave(
      {
        id: entry?.id,
        establishment_id: establishmentId,
        type,
        category_id: categoryId,
        description: description.trim(),
        amount: numericAmount,
        date,
        status,
        payment_method: status === "paid" ? paymentMethod : null,
      },
      makeRecurring ? { recurring: { day_of_month: parseInt(dayOfMonth) || 1 } } : undefined,
    );
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            Preencha os dados do {type === "revenue" ? "recebimento" : "pagamento"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => { setType(v as EntryType); setCategoryId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {filteredCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EntryStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Pago/Recebido</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {status === "paid" && (
            <div>
              <Label>Forma de pagamento <span className="text-destructive">*</span></Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods?.map((pm) => (
                    <SelectItem key={pm.id} value={pm.name}>{pm.name}</SelectItem>
                  ))}
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!entry && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="recurring-toggle">Tornar recorrente</Label>
                <Switch id="recurring-toggle" checked={makeRecurring} onCheckedChange={setMakeRecurring} />
              </div>
              {makeRecurring && (
                <div>
                  <Label>Dia do mês (1–31)</Label>
                  <Input
                    inputMode="numeric"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
