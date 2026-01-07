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

interface Professional {
  id: string;
  name: string;
}

interface CommissionRule {
  id: string;
  name: string;
  commission_type: string;
  commission_value: number;
}

interface AddCommissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  professionals: Professional[];
  onSuccess: () => void;
}

export function AddCommissionDialog({
  open,
  onOpenChange,
  establishmentId,
  professionals,
  onSuccess,
}: AddCommissionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [formData, setFormData] = useState({
    professional_id: "",
    commission_rule_id: "",
    reference_value: "",
    commission_amount: "",
    description: "",
  });

  useEffect(() => {
    if (open) {
      fetchRules();
      setFormData({
        professional_id: "",
        commission_rule_id: "",
        reference_value: "",
        commission_amount: "",
        description: "",
      });
    }
  }, [open, establishmentId]);

  const fetchRules = async () => {
    const { data } = await supabase
      .from("commission_rules")
      .select("id, name, commission_type, commission_value")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true);

    setRules(data || []);
  };

  const handleRuleChange = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    const refValue = parseFloat(formData.reference_value) || 0;
    if (rule && refValue > 0) {
      const amount =
        rule.commission_type === "percentage"
          ? (refValue * rule.commission_value) / 100
          : rule.commission_value;

      setFormData({
        ...formData,
        commission_rule_id: ruleId,
        commission_amount: String(amount),
      });
    } else {
      setFormData({ ...formData, commission_rule_id: ruleId });
    }
  };

  const handleReferenceValueChange = (value: string) => {
    const numValue = parseFloat(value.replace(',', '.')) || 0;
    const rule = rules.find((r) => r.id === formData.commission_rule_id);
    let amount = formData.commission_amount;

    if (rule) {
      const calcAmount =
        rule.commission_type === "percentage"
          ? (numValue * rule.commission_value) / 100
          : rule.commission_value;
      amount = String(calcAmount);
    }

    setFormData({
      ...formData,
      reference_value: value.replace(/[^0-9.,]/g, '').replace(',', '.'),
      commission_amount: amount,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const commissionAmount = parseFloat(formData.commission_amount) || 0;
    if (!formData.professional_id || commissionAmount <= 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("professional_commissions").insert({
        establishment_id: establishmentId,
        professional_id: formData.professional_id,
        commission_rule_id: formData.commission_rule_id || null,
        reference_value: parseFloat(formData.reference_value) || 0,
        commission_amount: parseFloat(formData.commission_amount) || 0,
        description: formData.description || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Comissão lançada com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding commission:", error);
      toast.error("Erro ao lançar comissão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar Comissão Manual</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Profissional *</Label>
            <Select
              value={formData.professional_id}
              onValueChange={(v) => setFormData({ ...formData, professional_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Regra de Comissão (opcional)</Label>
            <Select
              value={formData.commission_rule_id}
              onValueChange={handleRuleChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem regra (valor manual)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sem regra (valor manual)</SelectItem>
                {rules.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} ({r.commission_type === "percentage" ? `${r.commission_value}%` : `R$ ${r.commission_value}`})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference_value">Valor de Referência (R$)</Label>
            <Input
              id="reference_value"
              type="text"
              inputMode="decimal"
              value={formData.reference_value}
              onChange={(e) => handleReferenceValueChange(e.target.value)}
              placeholder="Valor da venda/serviço"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commission_amount">Valor da Comissão (R$) *</Label>
            <Input
              id="commission_amount"
              type="text"
              inputMode="decimal"
              value={formData.commission_amount}
              onChange={(e) =>
                setFormData({ ...formData, commission_amount: e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.') })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Comissão sobre venda de produtos"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Salvando..." : "Lançar Comissão"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
