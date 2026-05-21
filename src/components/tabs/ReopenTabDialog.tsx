import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hashManagerPin } from "@/lib/managerPin";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabId: string;
  clientName: string;
  role: "owner" | "manager";
  onReopened: () => void | Promise<void>;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_pin: "PIN incorreto.",
  forbidden: "Você não tem permissão para reabrir esta comanda.",
  tab_too_old: "Gerente só pode reabrir comandas fechadas há menos de 24h.",
  tab_not_closed: "Apenas comandas fechadas podem ser reabertas.",
  tab_deleted: "Comanda excluída. Recupere antes de reabrir.",
  tab_not_found: "Comanda não encontrada.",
  commission_already_paid: "Comissão desta comanda já foi paga. Reabertura bloqueada.",
};

export function ReopenTabDialog({ open, onOpenChange, tabId, clientName, role, onReopened }: Props) {
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) { setReason(""); setPin(""); setConfirmed(false); setLoading(false); }
  }, [open]);

  const isManager = role === "manager";

  const handleConfirm = async () => {
    if (reason.trim().length < 3) { toast.error("Informe um motivo (mín. 3 caracteres)"); return; }
    if (!confirmed) { toast.error("Confirme que entende os efeitos da reabertura"); return; }
    if (isManager && !/^\d{4,6}$/.test(pin)) { toast.error("Digite o PIN do gerente"); return; }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = { tab_id: tabId, reason: reason.trim() };
      if (isManager) payload.pin_hash = await hashManagerPin(pin);

      const { data, error } = await supabase.functions.invoke("reopen-tab-secure", { body: payload });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string; message?: string };
      if (!result?.ok) {
        toast.error(result?.message || ERROR_MESSAGES[result?.error ?? ""] || result?.error || "Erro ao reabrir");
        return;
      }
      toast.success("Comanda reaberta");
      onOpenChange(false);
      await onReopened();
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao reabrir");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Reabrir comanda
          </DialogTitle>
          <DialogDescription>
            Comanda de <span className="font-medium text-foreground">{clientName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" /> Atenção
            </div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Pagamentos registrados serão <b>removidos</b>.</li>
              <li>Comissões pendentes desta comanda serão <b>estornadas</b>.</li>
              <li>Se houver cupom aplicado, o uso será desfeito.</li>
              <li>Se a comissão já foi <b>paga</b>, a reabertura é bloqueada.</li>
              <li>O agendamento vinculado volta para "Em atendimento".</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label>Motivo da reabertura *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: cliente esqueceu um produto, valor incorreto, etc."
              rows={3}
              maxLength={500}
            />
          </div>

          {isManager && (
            <div className="space-y-2">
              <Label>PIN do gerente *</Label>
              <InputOTP maxLength={6} value={pin} onChange={(v) => setPin(v.replace(/\D/g, ""))}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
              <p className="text-xs text-muted-foreground">
                Limite: comandas fechadas há menos de 24h.
              </p>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <span>Entendo que pagamentos e comissões pendentes serão removidos e que esta ação fica registrada.</span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !confirmed || reason.trim().length < 3 || (isManager && pin.length < 4)}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Reabrir comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
