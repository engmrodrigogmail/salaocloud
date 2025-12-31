import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Percent, DollarSign, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CommissionRuleDialog } from "./CommissionRuleDialog";
import { AdvancedRulesDialog } from "./AdvancedRulesDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CommissionRule {
  id: string;
  name: string;
  description: string | null;
  commission_type: string;
  commission_value: number;
  applies_to: string;
  is_challenge: boolean;
  is_active: boolean;
}

interface CommissionRulesTabProps {
  establishmentId: string;
}

export function CommissionRulesTab({ establishmentId }: CommissionRulesTabProps) {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);
  const [advancedDialogOpen, setAdvancedDialogOpen] = useState(false);
  const [advancedRuleId, setAdvancedRuleId] = useState<string | null>(null);

  useEffect(() => {
    fetchRules();
  }, [establishmentId]);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("*")
        .eq("establishment_id", establishmentId)
        .eq("is_challenge", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error("Error fetching rules:", error);
      toast.error("Erro ao carregar regras");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rule: CommissionRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;

    try {
      const { error } = await supabase
        .from("commission_rules")
        .delete()
        .eq("id", ruleToDelete);

      if (error) throw error;
      toast.success("Regra excluída com sucesso");
      fetchRules();
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Erro ao excluir regra");
    } finally {
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  const handleToggleActive = async (rule: CommissionRule) => {
    try {
      const { error } = await supabase
        .from("commission_rules")
        .update({ is_active: !rule.is_active })
        .eq("id", rule.id);

      if (error) throw error;
      toast.success(rule.is_active ? "Regra desativada" : "Regra ativada");
      fetchRules();
    } catch (error) {
      console.error("Error toggling rule:", error);
      toast.error("Erro ao atualizar regra");
    }
  };

  const getAppliesToLabel = (appliesTo: string) => {
    const labels: Record<string, string> = {
      own_services: "Serviços próprios",
      all_services: "Todos os serviços",
      products: "Produtos",
      specific_services: "Serviços específicos",
      specific_products: "Produtos específicos",
    };
    return labels[appliesTo] || appliesTo;
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Regras de Comissionamento</h2>
          <p className="text-sm text-muted-foreground">
            Configure as regras padrão de comissão para os profissionais
          </p>
        </div>
        <Button onClick={() => { setEditingRule(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Regra
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Percent className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">Nenhuma regra de comissão cadastrada</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie regras para calcular automaticamente as comissões
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rules.map((rule) => (
            <Card key={rule.id} className={!rule.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {rule.commission_type === "percentage" ? (
                        <Percent className="h-4 w-4 text-primary" />
                      ) : (
                        <DollarSign className="h-4 w-4 text-primary" />
                      )}
                      {rule.name}
                    </CardTitle>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                    )}
                  </div>
                  <Badge variant={rule.is_active ? "default" : "secondary"}>
                    {rule.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-semibold">
                    {rule.commission_type === "percentage"
                      ? `${rule.commission_value}%`
                      : `R$ ${rule.commission_value.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Aplica-se a:</span>
                  <span>{getAppliesToLabel(rule.applies_to)}</span>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleToggleActive(rule)}
                  >
                    {rule.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRuleToDelete(rule.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CommissionRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        establishmentId={establishmentId}
        rule={editingRule}
        isChallenge={false}
        onSuccess={fetchRules}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As comissões já calculadas com esta regra serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
