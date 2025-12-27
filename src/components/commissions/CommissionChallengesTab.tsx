import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Target, Trophy, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CommissionRuleDialog } from "./CommissionRuleDialog";
import { Progress } from "@/components/ui/progress";
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

interface Challenge {
  id: string;
  name: string;
  description: string | null;
  commission_type: string;
  commission_value: number;
  applies_to: string;
  is_challenge: boolean;
  challenge_target: number | null;
  challenge_start_date: string | null;
  challenge_end_date: string | null;
  is_active: boolean;
}

interface CommissionChallengesTabProps {
  establishmentId: string;
}

export function CommissionChallengesTab({ establishmentId }: CommissionChallengesTabProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [challengeToDelete, setChallengeToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchChallenges();
  }, [establishmentId]);

  const fetchChallenges = async () => {
    try {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("*")
        .eq("establishment_id", establishmentId)
        .eq("is_challenge", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChallenges(data || []);
    } catch (error) {
      console.error("Error fetching challenges:", error);
      toast.error("Erro ao carregar desafios");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!challengeToDelete) return;

    try {
      const { error } = await supabase
        .from("commission_rules")
        .delete()
        .eq("id", challengeToDelete);

      if (error) throw error;
      toast.success("Desafio excluído com sucesso");
      fetchChallenges();
    } catch (error) {
      console.error("Error deleting challenge:", error);
      toast.error("Erro ao excluir desafio");
    } finally {
      setDeleteDialogOpen(false);
      setChallengeToDelete(null);
    }
  };

  const getChallengeStatus = (challenge: Challenge) => {
    const now = new Date();
    const start = challenge.challenge_start_date ? new Date(challenge.challenge_start_date) : null;
    const end = challenge.challenge_end_date ? new Date(challenge.challenge_end_date) : null;

    if (!challenge.is_active) return { label: "Inativo", variant: "secondary" as const };
    if (start && now < start) return { label: "Agendado", variant: "outline" as const };
    if (end && now > end) return { label: "Encerrado", variant: "secondary" as const };
    return { label: "Em andamento", variant: "default" as const };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getAppliesToLabel = (appliesTo: string) => {
    const labels: Record<string, string> = {
      own_services: "Serviços próprios",
      all_services: "Todos os serviços",
      products: "Produtos",
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
          <h2 className="text-xl font-semibold">Desafios de Vendas</h2>
          <p className="text-sm text-muted-foreground">
            Crie metas de vendas com bonificação para os profissionais
          </p>
        </div>
        <Button onClick={() => { setEditingChallenge(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Desafio
        </Button>
      </div>

      {challenges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">Nenhum desafio cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie desafios para motivar sua equipe a vender mais
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {challenges.map((challenge) => {
            const status = getChallengeStatus(challenge);
            return (
              <Card key={challenge.id} className={!challenge.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        {challenge.name}
                      </CardTitle>
                      {challenge.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {challenge.description}
                        </p>
                      )}
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {challenge.challenge_target && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Meta:</span>
                        <span className="font-semibold">{formatCurrency(challenge.challenge_target)}</span>
                      </div>
                      <Progress value={0} className="h-2" />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Bonificação:</span>
                    <span className="font-semibold">
                      {challenge.commission_type === "percentage"
                        ? `${challenge.commission_value}%`
                        : formatCurrency(challenge.commission_value)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Aplica-se a:</span>
                    <span>{getAppliesToLabel(challenge.applies_to)}</span>
                  </div>

                  {(challenge.challenge_start_date || challenge.challenge_end_date) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {challenge.challenge_start_date &&
                          format(new Date(challenge.challenge_start_date), "dd/MM/yyyy", { locale: ptBR })}
                        {challenge.challenge_start_date && challenge.challenge_end_date && " - "}
                        {challenge.challenge_end_date &&
                          format(new Date(challenge.challenge_end_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(challenge)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setChallengeToDelete(challenge.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CommissionRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        establishmentId={establishmentId}
        rule={editingChallenge}
        isChallenge={true}
        onSuccess={fetchChallenges}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir desafio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O histórico de comissões deste desafio será mantido.
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
