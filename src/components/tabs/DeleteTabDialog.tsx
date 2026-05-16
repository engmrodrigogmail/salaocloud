import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hashManagerPin } from "@/lib/managerPin";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabId: string;
  establishmentId: string;
  clientName: string;
  /** "owner" hides PIN field and limits warning */
  role: "owner" | "manager";
  onDeleted: () => void | Promise<void>;
}

const REASONS = [
  { value: "duplicate", label: "Comanda duplicada" },
  { value: "error", label: "Erro ao criar" },
  { value: "fraud", label: "Suspeita de fraude" },
  { value: "client_request", label: "Pedido do cliente" },
  { value: "system_error", label: "Erro do sistema" },
  { value: "other", label: "Outro" },
];

const ERROR_MESSAGES: Record<string, string> = {
  invalid_pin: "PIN incorreto.",
  forbidden: "Você não tem permissão para excluir esta comanda.",
  tab_too_old: "Gerente só pode excluir comandas dentro de 24h após a abertura.",
  daily_limit_exceeded: "Limite diário de 5 exclusões atingido.",
  tab_already_deleted: "Esta comanda já foi excluída.",
  tab_not_found: "Comanda não encontrada.",
};

export function DeleteTabDialog({
  open, onOpenChange, tabId, establishmentId, clientName, role, onDeleted,
}: Props) {
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setNotes("");
      setPin("");
      setLoading(false);
    }
  }, [open]);

  const isManager = role === "manager";

  const handleConfirm = async () => {
    if (!reason) {
      toast.error("Selecione um motivo");
      return;
    }
    if (isManager && !/^\d{4,6}$/.test(pin)) {
      toast.error("Digite o PIN do gerente (4 a 6 dígitos)");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { tab_id: tabId, reason, notes: notes.trim() || null };
      if (isManager) payload.pin_hash = await hashManagerPin(pin);

      const { data, error } = await supabase.functions.invoke("delete-tab-secure", { body: payload });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string; message?: string };
      if (!result?.ok) {
        const msg = result?.message || ERROR_MESSAGES[result?.error ?? ""] || result?.error || "Erro ao excluir";
        toast.error(msg);
        return;
      }
      toast.success("Comanda excluída");
      onOpenChange(false);
      await onDeleted();
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Erro ao excluir";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
    // suppress unused warning
    void establishmentId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir comanda
          </DialogTitle>
          <DialogDescription>
            Comanda de <span className="font-medium text-foreground">{clientName}</span>.
            {role === "owner"
              ? " Você pode recuperar esta comanda depois (ficará marcada como recuperada)."
              : " O dono será notificado e esta ação fica registrada na auditoria."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais (opcional)"
              rows={3}
              maxLength={500}
            />
          </div>

          {isManager && (
            <>
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900 p-3 text-xs">
                Como gerente, você pode excluir até <b>5 comandas por dia</b> e
                somente dentro de <b>24h</b> após a abertura. O dono será notificado.
              </div>
              <div className="space-y-2">
                <Label>PIN do gerente *</Label>
                <InputOTP maxLength={6} value={pin} onChange={(v) => setPin(v.replace(/\D/g, ""))}>
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading || !reason || (isManager && pin.length < 4)}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Excluir comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
