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
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hashManagerPin } from "@/lib/managerPin";

export interface ManagerPinAuthorization {
  /** professional id of the gerente that authorized (empty string when authorized by the owner) */
  managerProfessionalId: string;
  /** name for audit/UI */
  managerName: string;
  /** true when the action was authorized by the salon owner (no PIN required) */
  isOwner?: boolean;
  /** user id of the owner when isOwner is true */
  ownerUserId?: string | null;
}

interface ManagerPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Establishment id — managers are scoped per establishment.
   */
  establishmentId: string;
  /**
   * Why we're asking for the PIN. Shown to the user.
   * E.g. "Aplicar 25% de desconto", "Sobrescrever preço do item", "Editar comissão".
   */
  reason: string;
  /**
   * Called with the authorized manager when the PIN is correct.
   * The dialog closes automatically after this resolves.
   */
  onAuthorized: (auth: ManagerPinAuthorization) => void | Promise<void>;
}

/**
 * Generic confirmation dialog that requires a manager PIN before allowing
 * a sensitive action (override price, override commission, large discount…).
 *
 * It looks up *any* gerente in the establishment whose stored hash matches
 * the entered PIN. We never compare PINs in JS — the comparison happens
 * server-side via the `verify_manager_pin` SECURITY DEFINER function.
 */
export function ManagerPinDialog({
  open,
  onOpenChange,
  establishmentId,
  reason,
  onAuthorized,
}: ManagerPinDialogProps) {
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setVerifying(false);

      // Owner bypass: if the logged-in user is the salon owner, authorize
      // the action immediately without asking for a PIN.
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data: est } = await supabase
            .from("establishments")
            .select("owner_id")
            .eq("id", establishmentId)
            .maybeSingle();
          if (est?.owner_id && est.owner_id === user.id) {
            await onAuthorized({
              managerProfessionalId: "",
              managerName: "Dono do salão",
              isOwner: true,
              ownerUserId: user.id,
            });
            onOpenChange(false);
          }
        } catch (e) {
          console.error("Owner bypass check failed:", e);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, establishmentId]);

  const handleVerify = async () => {
    setError(null);

    if (!/^\d{4,6}$/.test(pin)) {
      setError("PIN deve ter de 4 a 6 dígitos numéricos.");
      return;
    }

    setVerifying(true);
    try {
      const hash = await hashManagerPin(pin);

      // Find a gerente in this establishment whose hash matches.
      // RLS lets owners and the gerente themselves read this; in practice
      // this query runs in the operations area where the user is logged in.
      const { data: managers, error: qErr } = await supabase
        .from("professionals")
        .select("id, name, manager_pin_hash, is_manager")
        .eq("establishment_id", establishmentId)
        .eq("is_manager", true)
        .eq("manager_pin_hash", hash)
        .limit(1);

      if (qErr) {
        console.error("Manager PIN lookup failed:", qErr);
        setError("Não foi possível validar o PIN. Tente novamente.");
        return;
      }

      const match = managers?.[0];
      if (!match) {
        setError("PIN incorreto.");
        return;
      }

      await onAuthorized({
        managerProfessionalId: match.id,
        managerName: match.name,
      });
      onOpenChange(false);
    } catch (e) {
      console.error("Manager PIN verify error:", e);
      setError("Erro ao validar PIN.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Autorização de gerente
          </DialogTitle>
          <DialogDescription>
            Esta ação exige o PIN de um gerente.
            <br />
            <span className="text-foreground font-medium">{reason}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-4">
          <Label className="text-sm">Digite o PIN do gerente</Label>
          <InputOTP
            maxLength={6}
            value={pin}
            onChange={(v) => {
              setPin(v.replace(/\D/g, ""));
              setError(null);
            }}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>

          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={verifying}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleVerify}
            disabled={pin.length < 4 || verifying}
          >
            {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Autorizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper to log a manager-authorized override into the audit table.
 * Call right after the actual action succeeds.
 */
export async function logManagerOverride(params: {
  establishmentId: string;
  managerProfessionalId?: string | null;
  ownerUserId?: string | null;
  actionType: string;
  targetType?: string;
  targetId?: string;
  tabId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}) {
  try {
    const managerId = params.managerProfessionalId && params.managerProfessionalId.length > 0
      ? params.managerProfessionalId
      : null;
    const ownerId = params.ownerUserId ?? null;
    if (!managerId && !ownerId) {
      console.warn("logManagerOverride called without manager nor owner authorizer");
      return;
    }
    await supabase.from("manager_pin_audit").insert({
      establishment_id: params.establishmentId,
      manager_professional_id: managerId,
      authorized_by_owner_user_id: ownerId,
      action_type: params.actionType,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      tab_id: params.tabId ?? null,
      old_value: (params.oldValue ?? null) as any,
      new_value: (params.newValue ?? null) as any,
      reason: params.reason ?? null,
    } as any);
  } catch (e) {
    console.error("Failed to log manager override:", e);
  }
}
