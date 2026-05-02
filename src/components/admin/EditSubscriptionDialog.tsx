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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlanOption {
  slug: string;
  name: string;
}

type Status = "trial" | "active" | "admin_trial" | "expired" | "suspended";

interface EditSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishment: {
    id: string;
    name: string;
    subscription_plan: string;
    status: string;
    admin_trial_granted_at?: string | null;
    trial_ends_at?: string | null;
  } | null;
  onSaved?: () => void;
}

export function EditSubscriptionDialog({
  open,
  onOpenChange,
  establishment,
  onSaved,
}: EditSubscriptionDialogProps) {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<Status>("active");
  const [saving, setSaving] = useState(false);

  // Establishment.status só tem pending/active/suspended.
  // O conceito de "admin_trial" / "trial" / "expired" mora em subscription_plan.
  // Aqui combinamos os dois para o UX ficar parecido com o Chama Que Vou.
  const computeStatus = (e: NonNullable<EditSubscriptionDialogProps["establishment"]>): Status => {
    if (e.subscription_plan === "admin_trial") return "admin_trial";
    if (e.subscription_plan === "trial") {
      if (e.trial_ends_at && new Date(e.trial_ends_at).getTime() < Date.now()) {
        return "expired";
      }
      return "trial";
    }
    if (e.status === "suspended") return "suspended";
    if (e.status === "active") return "active";
    return "trial";
  };

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("slug, name")
        .order("display_order", { ascending: true });
      setPlans(data || []);
    };
    load();
  }, [open]);

  useEffect(() => {
    if (!establishment) return;
    setSelectedPlan(establishment.subscription_plan);
    setSelectedStatus(computeStatus(establishment));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishment]);

  if (!establishment) return null;

  const isCurrentlyAdminTrial = establishment.subscription_plan === "admin_trial";
  const grantedAt = establishment.admin_trial_granted_at
    ? new Date(establishment.admin_trial_granted_at)
    : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

      if (selectedStatus === "admin_trial") {
        // Cortesia ilimitada
        updateData.subscription_plan = "admin_trial";
        updateData.status = "active"; // garante acesso real
        updateData.trial_ends_at = null;
        // Só grava granted_at se for nova concessão (não sobrescrever a data original)
        if (!isCurrentlyAdminTrial || !establishment.admin_trial_granted_at) {
          updateData.admin_trial_granted_at = new Date().toISOString();
        }
      } else {
        // Saindo de admin_trial (ou em qualquer outro fluxo) → limpar granted_at
        if (isCurrentlyAdminTrial) {
          updateData.admin_trial_granted_at = null;
        }

        if (selectedStatus === "trial") {
          updateData.subscription_plan = "trial";
          updateData.status = "active";
          // Mantém trial_ends_at existente; se não houver, dá 7 dias.
          if (!establishment.trial_ends_at) {
            const ends = new Date();
            ends.setDate(ends.getDate() + 7);
            updateData.trial_ends_at = ends.toISOString();
          }
        } else if (selectedStatus === "active") {
          updateData.subscription_plan = selectedPlan || "pro";
          updateData.status = "active";
          updateData.trial_ends_at = null;
        } else if (selectedStatus === "expired") {
          updateData.subscription_plan = "trial";
          updateData.status = "suspended";
          updateData.trial_ends_at = new Date().toISOString();
        } else if (selectedStatus === "suspended") {
          updateData.subscription_plan = selectedPlan || establishment.subscription_plan;
          updateData.status = "suspended";
        }
      }

      const { error } = await supabase
        .from("establishments")
        .update(updateData)
        .eq("id", establishment.id);
      if (error) throw error;

      toast.success("Assinatura atualizada", { position: "top-center", duration: 2000 });
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao atualizar assinatura", {
        position: "top-center",
        duration: 2500,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Editar assinatura
          </DialogTitle>
          <DialogDescription>{establishment.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={selectedStatus}
              onValueChange={(v) => setSelectedStatus(v as Status)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="admin_trial">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-purple-600" />
                    Trial Premium Adm
                  </span>
                </SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedStatus === "admin_trial" && (
            <div className="rounded-md border border-purple-300 bg-purple-50 dark:bg-purple-950/30 p-3 text-sm text-purple-900 dark:text-purple-200 flex gap-2">
              <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Trial Premium Adm:</strong> acesso ilimitado a todas as funcionalidades
                sem cobrança. Válido até remoção manual pelo administrador.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {isCurrentlyAdminTrial && grantedAt && (
            <p className="text-xs text-muted-foreground sm:mr-auto">
              Trial Premium concedido em:{" "}
              {format(grantedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
