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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Percent, DollarSign, ShieldAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ManagerPinDialog, logManagerOverride } from "@/components/security/ManagerPinDialog";

export interface ManualDiscountResult {
  /** Final discount amount in BRL applied to the tab */
  discountAmount: number;
  /** Whether the discount should be deducted from professional commissions */
  reducesCommission: boolean;
  /** Manager id when a PIN was required, otherwise null */
  managerProfessionalId: string | null;
}

interface ManualDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  tabId: string;
  /** Current subtotal of the tab (sum of items, before any discount) */
  subtotal: number;
  /** Existing non-coupon discount currently on the tab (R$). Used as the starting value. */
  currentDiscount: number;
  /** Current value of `discount_reduces_commission` on the tab */
  currentReducesCommission: boolean;
  /** % threshold above which a manager PIN is required (from establishment) */
  pinThresholdPercent: number;
  onApplied: (result: ManualDiscountResult) => void;
}

/**
 * Single dialog used both in the open tab and at checkout to apply / change
 * the manual discount of a comanda. Asks for "abater da comissão?" every time
 * (per spec). If the resulting discount is above the establishment threshold,
 * requires a manager PIN before persisting.
 */
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
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [valueStr, setValueStr] = useState("");
  const [reduces, setReduces] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingApply, setPendingApply] = useState<{
    amount: number;
    reduces: boolean;
    itemIds: string[];
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
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType("fixed");
    setValueStr(currentDiscount > 0 ? currentDiscount.toFixed(2) : "");
    setReduces(currentReducesCommission);
    setSaving(false);
    setPinOpen(false);
    setPendingApply(null);
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
        // Seed selection: existing tab.manual_discount_item_ids if any, else all
        const { data: tabRow } = await supabase
          .from("tabs")
          .select("manual_discount_item_ids")
          .eq("id", tabId)
          .single();
        const existing = ((tabRow as any)?.manual_discount_item_ids ?? null) as
          | string[]
          | null;
        if (existing && existing.length > 0) {
          setSelectedItemIds(existing.filter((id) => list.some((i) => i.id === id)));
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

  // Base for computing the discount: only the selected items.
  const computedAmount = (() => {
    if (eligibleSubtotal <= 0 || parsedValue <= 0) return 0;
    if (type === "percentage") {
      const pct = Math.min(parsedValue, 100);
      return Math.round(eligibleSubtotal * pct) / 100;
    }
    return Math.round(Math.min(parsedValue, eligibleSubtotal) * 100) / 100;
  })();

  // PIN threshold compares against the full tab subtotal (overall impact).
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
      // Normalize: NULL when no discount or when all items are selected.
      const idsToPersist =
        amount > 0 && itemIds.length > 0 && itemIds.length < items.length
          ? itemIds
          : null;

      const { error } = await supabase
        .from("tabs")
        .update({
          discount_amount: amount,
          discount_type: amount > 0 ? "manual" : null,
          commission_discount_on_manual: reducesFlag,
          discount_authorized_by: managerProfessionalId,
          manual_discount_item_ids: idsToPersist,
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
    if (selectedItemIds.length === 0) {
      toast.error("Selecione ao menos um item para aplicar o desconto");
      return;
    }
    if (requiresPin) {
      setPendingApply({ amount: computedAmount, reduces, itemIds: selectedItemIds });
      setPinOpen(true);
      return;
    }
    await persistDiscount(computedAmount, reduces, selectedItemIds, null);
  };

  const handleRemove = async () => {
    await persistDiscount(0, false, [], null);
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
                value={type}
                onValueChange={(v) => setType(v as "percentage" | "fixed")}
                className="grid grid-cols-2 gap-2"
              >
                <label
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                    type === "percentage" ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <RadioGroupItem value="percentage" className="sr-only" />
                  <Percent className="h-4 w-4" />
                  <span className="text-sm">Percentual</span>
                </label>
                <label
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                    type === "fixed" ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <RadioGroupItem value="fixed" className="sr-only" />
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">Valor fixo</span>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount-value">
                {type === "percentage" ? "Desconto (%)" : "Desconto (R$)"}
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
                placeholder={type === "percentage" ? "10" : "20.00"}
              />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Subtotal: {fmt(subtotal)}</span>
                <span>
                  Desconto: <b className="text-foreground">{fmt(computedAmount)}</b>{" "}
                  ({computedPercent.toFixed(1)}%)
                </span>
              </div>
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
            isOwner ? null : managerProfessionalId,
            ownerUserId ?? null,
          );
        }}
      />
    </>
  );
}
