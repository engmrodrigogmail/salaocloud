import { useEffect, useMemo, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Percent, DollarSign, ShieldAlert, ListChecks } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ManagerPinDialog, logManagerOverride } from "@/components/security/ManagerPinDialog";

export interface ManualDiscountResult {
  discountAmount: number;
  reducesCommission: boolean;
  managerProfessionalId: string | null;
}

interface ManualDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  tabId: string;
  subtotal: number;
  currentDiscount: number;
  currentReducesCommission: boolean;
  pinThresholdPercent: number;
  onApplied: (result: ManualDiscountResult) => void;
}

type DiscountMode = "percentage" | "fixed" | "per_item";

export function ManualDiscountDialog({
  open,
  onOpenChange,
  establishmentId,
  tabId,
  subtotal,
  currentDiscount,
  currentReducesCommission,
  pinThresholdPercent,
  onApplied,
}: ManualDiscountDialogProps) {
  const [mode, setMode] = useState<DiscountMode>("fixed");
  const [valueStr, setValueStr] = useState("");
  const [reduces, setReduces] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingApply, setPendingApply] = useState<{
    amount: number;
    reduces: boolean;
    itemIds: string[];
    perItemAmounts: Record<string, number> | null;
  } | null>(null);
  const [items, setItems] = useState<
    Array<{
      id: string;
      name: string;
      item_type: string;
      total_price: number;
      professional_name: string | null;
    }>
  >([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [perItemStr, setPerItemStr] = useState<Record<string, string>>({});
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("fixed");
    setValueStr(currentDiscount > 0 ? currentDiscount.toFixed(2) : "");
    setReduces(currentReducesCommission);
    setSaving(false);
    setPinOpen(false);
    setPendingApply(null);
    setPerItemStr({});
    setLoadingItems(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("tab_items")
          .select("id, name, item_type, total_price, professional:professionals(name)")
          .eq("tab_id", tabId)
          .in("item_type", ["service", "product"]);
        if (error) throw error;
        const list = (data || []).map((row: any) => ({
          id: row.id as string,
          name: row.name as string,
          item_type: row.item_type as string,
          total_price: Number(row.total_price) || 0,
          professional_name: row.professional?.name ?? null,
        }));
        setItems(list);

        const { data: tabRow } = await supabase
          .from("tabs")
          .select("manual_discount_item_ids, manual_discount_item_amounts")
          .eq("id", tabId)
          .single();
        const existingIds = ((tabRow as any)?.manual_discount_item_ids ?? null) as
          | string[]
          | null;
        const existingAmounts = ((tabRow as any)?.manual_discount_item_amounts ?? null) as
          | Record<string, number>
          | null;

        if (existingAmounts && Object.keys(existingAmounts).length > 0) {
          // Seed per-item mode
          setMode("per_item");
          const seed: Record<string, string> = {};
          for (const it of list) {
            const v = Number(existingAmounts[it.id] ?? 0);
            seed[it.id] = v > 0 ? v.toFixed(2) : "";
          }
          setPerItemStr(seed);
          setSelectedItemIds(list.map((i) => i.id));
        } else if (existingIds && existingIds.length > 0) {
          setSelectedItemIds(existingIds.filter((id) => list.some((i) => i.id === id)));
        } else {
          setSelectedItemIds(list.map((i) => i.id));
        }
      } catch (e) {
        console.error("Error loading tab items:", e);
        setItems([]);
        setSelectedItemIds([]);
      } finally {
        setLoadingItems(false);
      }
    })();
  }, [open, tabId, currentDiscount, currentReducesCommission]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const parsedValue = parseFloat((valueStr || "0").replace(",", ".")) || 0;

  const selectedSet = new Set(selectedItemIds);
  const eligibleSubtotal = items
    .filter((i) => selectedSet.has(i.id))
    .reduce((s, i) => s + i.total_price, 0);
  const allSelected = items.length > 0 && selectedItemIds.length === items.length;

  // Per-item parsed amounts (capped by item price)
  const perItemParsed = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) {
      const raw = perItemStr[it.id];
      const v = parseFloat((raw || "0").replace(",", ".")) || 0;
      map[it.id] = Math.max(0, Math.min(v, it.total_price));
    }
    return map;
  }, [items, perItemStr]);

  const computedAmount = (() => {
    if (mode === "per_item") {
      return Math.round(
        Object.values(perItemParsed).reduce((s, v) => s + v, 0) * 100,
      ) / 100;
    }
    if (eligibleSubtotal <= 0 || parsedValue <= 0) return 0;
    if (mode === "percentage") {
      const pct = Math.min(parsedValue, 100);
      return Math.round(eligibleSubtotal * pct) / 100;
    }
    return Math.round(Math.min(parsedValue, eligibleSubtotal) * 100) / 100;
  })();

  const computedPercent = subtotal > 0 ? (computedAmount / subtotal) * 100 : 0;
  const requiresPin = computedPercent > pinThresholdPercent && computedAmount > 0;

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const toggleAll = () => {
    setSelectedItemIds(allSelected ? [] : items.map((i) => i.id));
  };

  const persistDiscount = async (
    amount: number,
    reducesFlag: boolean,
    itemIds: string[],
    perItemAmounts: Record<string, number> | null,
    managerProfessionalId: string | null,
    ownerUserId: string | null = null,
  ) => {
    setSaving(true);
    try {
      const { data: tab, error: fetchErr } = await supabase
        .from("tabs")
        .select("subtotal")
        .eq("id", tabId)
        .single();
      if (fetchErr) throw fetchErr;

      const newTotal = Math.max(0, Number(tab.subtotal) - amount);

      let idsToPersist: string[] | null;
      let amountsToPersist: Record<string, number> | null = null;

      if (amount > 0 && perItemAmounts) {
        // Per-item mode: persist explicit map + the ids with non-zero discount
        const filtered: Record<string, number> = {};
        const ids: string[] = [];
        for (const [id, v] of Object.entries(perItemAmounts)) {
          if (v > 0) {
            filtered[id] = Math.round(v * 100) / 100;
            ids.push(id);
          }
        }
        amountsToPersist = filtered;
        idsToPersist = ids.length > 0 && ids.length < items.length ? ids : null;
      } else {
        idsToPersist =
          amount > 0 && itemIds.length > 0 && itemIds.length < items.length
            ? itemIds
            : null;
      }

      const { error } = await supabase
        .from("tabs")
        .update({
          discount_amount: amount,
          discount_type: amount > 0 ? "manual" : null,
          commission_discount_on_manual: reducesFlag,
          discount_authorized_by: managerProfessionalId,
          manual_discount_item_ids: idsToPersist,
          manual_discount_item_amounts: amountsToPersist,
          total: newTotal,
        } as never)
        .eq("id", tabId);

      if (error) throw error;

      if (managerProfessionalId || ownerUserId) {
        await logManagerOverride({
          establishmentId,
          managerProfessionalId: managerProfessionalId ?? null,
          ownerUserId,
          actionType: "discount_above_threshold",
          targetType: "tab",
          targetId: tabId,
          tabId,
          oldValue: { amount: currentDiscount, reduces_commission: currentReducesCommission },
          newValue: {
            amount,
            reduces_commission: reducesFlag,
            percent: computedPercent.toFixed(2),
            item_ids: idsToPersist,
            per_item_amounts: amountsToPersist,
          },
          reason: `Desconto de ${computedPercent.toFixed(1)}% (limite ${pinThresholdPercent}%)`,
        });
      }

      toast.success(amount > 0 ? "Desconto aplicado" : "Desconto removido");
      onApplied({
        discountAmount: amount,
        reducesCommission: reducesFlag,
        managerProfessionalId,
      });
      onOpenChange(false);
    } catch (e) {
      console.error("Error applying manual discount:", e);
      toast.error("Erro ao aplicar desconto");
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (computedAmount <= 0) return;
    if (mode !== "per_item" && selectedItemIds.length === 0) {
      toast.error("Selecione ao menos um item para aplicar o desconto");
      return;
    }
    const perItemAmounts = mode === "per_item" ? perItemParsed : null;
    const itemIds =
      mode === "per_item"
        ? Object.entries(perItemParsed)
            .filter(([, v]) => v > 0)
            .map(([k]) => k)
        : selectedItemIds;

    if (mode === "per_item" && itemIds.length === 0) {
      toast.error("Informe ao menos um valor de desconto por item");
      return;
    }

    if (requiresPin) {
      setPendingApply({ amount: computedAmount, reduces, itemIds, perItemAmounts });
      setPinOpen(true);
      return;
    }
    await persistDiscount(computedAmount, reduces, itemIds, perItemAmounts, null);
  };

  const handleRemove = async () => {
    await persistDiscount(0, false, [], null, null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Desconto manual</DialogTitle>
            <DialogDescription>
              Aplique um desconto direto na comanda. Cupons e fidelidade ficam em
              outro lugar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as DiscountMode)}
                className="grid grid-cols-3 gap-2"
              >
                <label
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                    mode === "percentage" ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <RadioGroupItem value="percentage" className="sr-only" />
                  <Percent className="h-4 w-4" />
                  <span className="text-xs">%</span>
                </label>
                <label
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                    mode === "fixed" ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <RadioGroupItem value="fixed" className="sr-only" />
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Fixo</span>
                </label>
                <label
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                    mode === "per_item" ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <RadioGroupItem value="per_item" className="sr-only" />
                  <ListChecks className="h-4 w-4" />
                  <span className="text-xs">Por item</span>
                </label>
              </RadioGroup>
            </div>

            {mode !== "per_item" && (
              <div className="space-y-2">
                <Label htmlFor="discount-value">
                  {mode === "percentage" ? "Desconto (%)" : "Desconto (R$)"}
                </Label>
                <Input
                  id="discount-value"
                  type="text"
                  inputMode="decimal"
                  value={valueStr}
                  onChange={(e) =>
                    setValueStr(
                      e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."),
                    )
                  }
                  placeholder={mode === "percentage" ? "10" : "20.00"}
                />
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>Base selecionada: {fmt(eligibleSubtotal)}</span>
                  <span>
                    Desconto: <b className="text-foreground">{fmt(computedAmount)}</b>
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">
                  {mode === "per_item"
                    ? "Desconto por item (R$)"
                    : "Aplicar desconto em"}
                </Label>
                {mode !== "per_item" && items.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                )}
              </div>
              {loadingItems ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando itens…
                </div>
              ) : items.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum item nesta comanda.
                </p>
              ) : mode === "per_item" ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {items.map((it) => {
                    const v = perItemParsed[it.id] ?? 0;
                    const net = Math.max(0, it.total_price - v);
                    return (
                      <div
                        key={it.id}
                        className="rounded p-2 border bg-muted/20 space-y-1"
                      >
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="truncate">{it.name}</span>
                          <span className="text-muted-foreground">
                            {fmt(it.total_price)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {it.item_type === "service" ? "Serviço" : "Produto"}
                          {it.professional_name ? ` • ${it.professional_name}` : ""}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={perItemStr[it.id] ?? ""}
                            onChange={(e) =>
                              setPerItemStr((prev) => ({
                                ...prev,
                                [it.id]: e.target.value
                                  .replace(/[^0-9.,]/g, "")
                                  .replace(",", "."),
                              }))
                            }
                            className="h-8 text-sm"
                          />
                          <span className="text-xs whitespace-nowrap text-muted-foreground">
                            → {fmt(net)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-xs flex justify-between pt-1 border-t">
                    <span className="text-muted-foreground">Total do desconto</span>
                    <b>{fmt(computedAmount)}</b>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {items.map((it) => (
                    <label
                      key={it.id}
                      className="flex items-start gap-2 rounded p-1.5 hover:bg-muted/40 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedSet.has(it.id)}
                        onCheckedChange={() => toggleItem(it.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="truncate">{it.name}</span>
                          <span className="text-foreground">{fmt(it.total_price)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {it.item_type === "service" ? "Serviço" : "Produto"}
                          {it.professional_name ? ` • ${it.professional_name}` : ""}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {mode === "per_item"
                  ? "Cada item terá exatamente o desconto informado. Não há rateio proporcional."
                  : "O desconto será rateado apenas entre os itens marcados. A receita e a comissão dos demais profissionais não são afetadas."}
              </p>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="space-y-1 text-sm">
                <Label className="text-sm">Abater da comissão dos profissionais?</Label>
                <p className="text-xs text-muted-foreground">
                  Se ligado, a comissão calculada também será reduzida
                  proporcionalmente. Se desligado, o salão absorve o desconto.
                </p>
              </div>
              <Switch checked={reduces} onCheckedChange={setReduces} />
            </div>

            {requiresPin && (
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Este desconto está acima do limite de {pinThresholdPercent}% e
                  exigirá o PIN de um gerente.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            {currentDiscount > 0 && (
              <Button
                variant="ghost"
                onClick={handleRemove}
                disabled={saving}
                className="text-destructive hover:text-destructive"
              >
                Remover desconto
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleApply} disabled={saving || computedAmount <= 0}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManagerPinDialog
        open={pinOpen}
        onOpenChange={(o) => {
          setPinOpen(o);
          if (!o) setPendingApply(null);
        }}
        establishmentId={establishmentId}
        reason={`Aplicar ${computedPercent.toFixed(1)}% de desconto (${fmt(
          computedAmount,
        )})`}
        onAuthorized={async ({ managerProfessionalId, ownerUserId, isOwner }) => {
          if (!pendingApply) return;
          await persistDiscount(
            pendingApply.amount,
            pendingApply.reduces,
            pendingApply.itemIds,
            pendingApply.perItemAmounts,
            isOwner ? null : managerProfessionalId,
            ownerUserId ?? null,
          );
        }}
      />
    </>
  );
}
