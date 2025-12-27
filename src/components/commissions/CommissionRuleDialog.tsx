import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
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
import { toast } from "sonner";

interface CommissionRule {
  id: string;
  name: string;
  description: string | null;
  commission_type: string;
  commission_value: number;
  applies_to: string;
  is_challenge: boolean;
  challenge_target?: number | null;
  challenge_start_date?: string | null;
  challenge_end_date?: string | null;
}

interface CommissionRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  rule: CommissionRule | null;
  isChallenge: boolean;
  onSuccess: () => void;
}

export function CommissionRuleDialog({
  open,
  onOpenChange,
  establishmentId,
  rule,
  isChallenge,
  onSuccess,
}: CommissionRuleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    commission_type: "percentage",
    commission_value: 0,
    applies_to: "own_services",
    challenge_target: 0,
    challenge_start_date: "",
    challenge_end_date: "",
  });

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name,
        description: rule.description || "",
        commission_type: rule.commission_type,
        commission_value: rule.commission_value,
        applies_to: rule.applies_to,
        challenge_target: rule.challenge_target || 0,
        challenge_start_date: rule.challenge_start_date
          ? new Date(rule.challenge_start_date).toISOString().split("T")[0]
          : "",
        challenge_end_date: rule.challenge_end_date
          ? new Date(rule.challenge_end_date).toISOString().split("T")[0]
          : "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        commission_type: "percentage",
        commission_value: 0,
        applies_to: "own_services",
        challenge_target: 0,
        challenge_start_date: "",
        challenge_end_date: "",
      });
    }
  }, [rule, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.commission_value <= 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        establishment_id: establishmentId,
        name: formData.name,
        description: formData.description || null,
        commission_type: formData.commission_type,
        commission_value: formData.commission_value,
        applies_to: formData.applies_to,
        is_challenge: isChallenge,
        challenge_target: isChallenge ? formData.challenge_target : null,
        challenge_start_date: isChallenge && formData.challenge_start_date
          ? new Date(formData.challenge_start_date).toISOString()
          : null,
        challenge_end_date: isChallenge && formData.challenge_end_date
          ? new Date(formData.challenge_end_date).toISOString()
          : null,
      };

      if (rule) {
        const { error } = await supabase
          .from("commission_rules")
          .update(payload)
          .eq("id", rule.id);

        if (error) throw error;
        toast.success(isChallenge ? "Desafio atualizado!" : "Regra atualizada!");
      } else {
        const { error } = await supabase.from("commission_rules").insert(payload);

        if (error) throw error;
        toast.success(isChallenge ? "Desafio criado!" : "Regra criada!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error("Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {rule
              ? isChallenge
                ? "Editar Desafio"
                : "Editar Regra"
              : isChallenge
              ? "Novo Desafio de Vendas"
              : "Nova Regra de Comissão"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={isChallenge ? "Ex: Desafio de Natal" : "Ex: Comissão Padrão"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva a regra..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Comissão</Label>
              <Select
                value={formData.commission_type}
                onValueChange={(v) => setFormData({ ...formData, commission_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                  <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">
                Valor {formData.commission_type === "percentage" ? "(%)" : "(R$)"}
              </Label>
              <Input
                id="value"
                type="number"
                step={formData.commission_type === "percentage" ? "1" : "0.01"}
                min="0"
                value={formData.commission_value}
                onChange={(e) =>
                  setFormData({ ...formData, commission_value: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Aplica-se a</Label>
            <Select
              value={formData.applies_to}
              onValueChange={(v) => setFormData({ ...formData, applies_to: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="own_services">Serviços realizados pelo profissional</SelectItem>
                <SelectItem value="all_services">Todos os serviços vendidos</SelectItem>
                <SelectItem value="products">Produtos vendidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isChallenge && (
            <>
              <div className="space-y-2">
                <Label htmlFor="target">Meta de Vendas (R$)</Label>
                <Input
                  id="target"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.challenge_target}
                  onChange={(e) =>
                    setFormData({ ...formData, challenge_target: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data Início</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.challenge_start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, challenge_start_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Data Fim</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.challenge_end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, challenge_end_date: e.target.value })
                    }
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
