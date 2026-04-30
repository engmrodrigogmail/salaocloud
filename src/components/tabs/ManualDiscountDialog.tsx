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
  } | null>(null);

  useEffect(() => {
    if (open) {
      // Seed with existing fixed-amount discount (fallback to empty)
      setType("fixed");
      setValueStr(currentDiscount > 0 ? currentDiscount.toFixed(2) : "");
      setReduces(currentReducesCommission);
      setSaving(false);
      setPinOpen(false);
      setPendingApply(null);
    }
  }, [open, currentDiscount, currentReducesCommission]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const parsedValue = parseFloat((valueStr || "0").replace(",", ".")) || 0;

  const computedAmount = (() => {
    if (subtotal <= 0 || parsedValue <= 0) return 0;
    if (type === "percentage") {
      const pct = Math.min(parsedValue, 100);
      return Math.round(subtotal * pct) / 100; // 2 decimal places
    }
    return Math.min(parsedValue, subtotal);
  })();

  const computedPercent = subtotal > 0 ? (computedAmount / subtotal) * 100 : 0;
  const requiresPin = computedPercent > pinThresholdPercent && computedAmount > 0;

  const persistDiscount = async (
    amount: number,
    reducesFlag: boolean,
    managerProfessionalId: string | null,
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

      const { error } = await supabase
        .from("tabs")
        .update({
          discount_amount: amount,
          discount_type: amount > 0 ? "manual" : null,
          discount_reduces_commission: reducesFlag,
          total: newTotal,
        } as never)
        .eq("id", tabId);

      if (error) throw error;

      if (managerProfessionalId) {
        await logManagerOverride({
          establishmentId,
          managerProfessionalId,
          actionType: "discount_above_threshold",
          targetType: "tab",
          targetId: tabId,
          tabId,
          oldValue: { amount: currentDiscount, reduces_commission: currentReducesCommission },
          newValue: { amount, reduces_commission: reducesFlag, percent: computedPercent.toFixed(2) },
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
    if (computedAmount < 0) return;

    if (requiresPin) {
      setPendingApply({ amount: computedAmount, reduces });
      setPinOpen(true);
      return;
    }
    await persistDiscount(computedAmount, reduces, null);
  };

  const handleRemove = async () => {
    await persistDiscount(0, false, null);
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
        onAuthorized={async ({ managerProfessionalId }) => {
          if (!pendingApply) return;
          await persistDiscount(
            pendingApply.amount,
            pendingApply.reduces,
            managerProfessionalId,
          );
        }}
      />
    </>
  );
}
