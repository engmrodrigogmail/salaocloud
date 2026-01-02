import { useState, useEffect } from "react";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Brain, Plus, Trash2, Check, X, TrendingUp, MessageSquare, Sparkles, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AILearning {
  id: string;
  learning_type: string;
  trigger_pattern: string | null;
  ideal_response: string | null;
  context_tags: string[] | null;
  success_count: number;
  failure_count: number;
  confidence_score: number;
  is_active: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

interface ConversationFeedback {
  id: string;
  feedback_type: string;
  outcome: string | null;
  created_at: string;
}

export default function AILearnings() {
  const { user } = useAuth();
  const [learnings, setLearnings] = useState<AILearning[]>([]);
  const [feedback, setFeedback] = useState<ConversationFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newLearning, setNewLearning] = useState({
    trigger_pattern: "",
    ideal_response: "",
    context_tags: "",
  });

  // Stats
  const [stats, setStats] = useState({
    totalLearnings: 0,
    avgConfidence: 0,
    successfulInteractions: 0,
    failedInteractions: 0,
  });

  useEffect(() => {
    if (user) {
      fetchEstablishmentAndData();
    }
  }, [user]);

  const fetchEstablishmentAndData = async () => {
    try {
      const { data: establishment } = await supabase
        .from("establishments")
        .select("id")
        .eq("owner_id", user?.id)
        .single();

      if (establishment) {
        setEstablishmentId(establishment.id);
        await Promise.all([
          fetchLearnings(establishment.id),
          fetchFeedback(establishment.id),
        ]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchLearnings = async (estId: string) => {
    const { data, error } = await supabase
      .from("establishment_ai_learnings")
      .select("*")
      .eq("establishment_id", estId)
      .order("confidence_score", { ascending: false });

    if (error) {
      console.error("Error fetching learnings:", error);
      return;
    }

    const typedData = data as AILearning[];
    setLearnings(typedData);

    // Calculate stats
    const total = typedData.length;
    const avgConf = total > 0 
      ? typedData.reduce((acc, l) => acc + Number(l.confidence_score), 0) / total 
      : 0;
    const successful = typedData.reduce((acc, l) => acc + l.success_count, 0);
    const failed = typedData.reduce((acc, l) => acc + l.failure_count, 0);

    setStats({
      totalLearnings: total,
      avgConfidence: avgConf,
      successfulInteractions: successful,
      failedInteractions: failed,
    });
  };

  const fetchFeedback = async (estId: string) => {
    const { data, error } = await supabase
      .from("ai_conversation_feedback")
      .select(`
        id,
        feedback_type,
        outcome,
        created_at,
        conversation:ai_assistant_conversations!inner(establishment_id)
      `)
      .eq("conversation.establishment_id", estId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching feedback:", error);
      return;
    }

    setFeedback(data as ConversationFeedback[]);
  };

  const handleAddLearning = async () => {
    if (!establishmentId || !newLearning.trigger_pattern || !newLearning.ideal_response) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const contextTags = newLearning.context_tags
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const { error } = await supabase.from("establishment_ai_learnings").insert({
      establishment_id: establishmentId,
      learning_type: "manual",
      trigger_pattern: newLearning.trigger_pattern,
      ideal_response: newLearning.ideal_response,
      context_tags: contextTags,
      confidence_score: 0.8,
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    });

    if (error) {
      toast.error("Erro ao adicionar aprendizado");
      return;
    }

    toast.success("Aprendizado adicionado!");
    setIsAddDialogOpen(false);
    setNewLearning({ trigger_pattern: "", ideal_response: "", context_tags: "" });
    fetchLearnings(establishmentId);
  };

  const handleToggleActive = async (learning: AILearning) => {
    const { error } = await supabase
      .from("establishment_ai_learnings")
      .update({ is_active: !learning.is_active })
      .eq("id", learning.id);

    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }

    setLearnings(prev =>
      prev.map(l => (l.id === learning.id ? { ...l, is_active: !l.is_active } : l))
    );
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("establishment_ai_learnings")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir");
      return;
    }

    toast.success("Aprendizado excluído");
    setLearnings(prev => prev.filter(l => l.id !== id));
  };

  const handleApprove = async (learning: AILearning) => {
    const { error } = await supabase
      .from("establishment_ai_learnings")
      .update({
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        confidence_score: Math.min(0.95, Number(learning.confidence_score) + 0.1),
      })
      .eq("id", learning.id);

    if (error) {
      toast.error("Erro ao aprovar");
      return;
    }

    toast.success("Aprendizado aprovado!");
    if (establishmentId) fetchLearnings(establishmentId);
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-500/20 text-green-400">Alta</Badge>;
    if (score >= 0.5) return <Badge className="bg-yellow-500/20 text-yellow-400">Média</Badge>;
    return <Badge className="bg-red-500/20 text-red-400">Baixa</Badge>;
  };

  const getTypeBadge = (type: string) => {
    if (type === "manual") return <Badge variant="outline">Manual</Badge>;
    if (type === "auto") return <Badge className="bg-primary/20 text-primary">Automático</Badge>;
    return <Badge variant="secondary">{type}</Badge>;
  };

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Aprendizados da IA
            </h1>
            <p className="text-muted-foreground">
              Gerencie como a assistente virtual aprende e melhora suas respostas
            </p>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Aprendizado
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Aprendizado Manual</DialogTitle>
                <DialogDescription>
                  Ensine a IA como responder a perguntas específicas
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Quando o cliente perguntar sobre...</Label>
                  <Textarea
                    placeholder="Ex: qual horário de funcionamento, vocês abrem domingo, etc."
                    value={newLearning.trigger_pattern}
                    onChange={(e) =>
                      setNewLearning((prev) => ({ ...prev, trigger_pattern: e.target.value }))
                    }
                    rows={2}
                  />
                </div>

                <div>
                  <Label>A IA deve responder algo como...</Label>
                  <Textarea
                    placeholder="Ex: Funcionamos de segunda a sábado, das 9h às 19h. Domingo fechado."
                    value={newLearning.ideal_response}
                    onChange={(e) =>
                      setNewLearning((prev) => ({ ...prev, ideal_response: e.target.value }))
                    }
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Tags de contexto (opcional, separadas por vírgula)</Label>
                  <Input
                    placeholder="horário, funcionamento, aberto"
                    value={newLearning.context_tags}
                    onChange={(e) =>
                      setNewLearning((prev) => ({ ...prev, context_tags: e.target.value }))
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddLearning}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Aprendizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLearnings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Confiança Média
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.avgConfidence * 100).toFixed(0)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Interações Positivas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {stats.successfulInteractions}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-4 w-4 text-red-500" />
                Falhas Registradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {stats.failedInteractions}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Learnings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Base de Conhecimento
            </CardTitle>
            <CardDescription>
              Aprendizados automáticos e manuais que melhoram as respostas da IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            {learnings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum aprendizado registrado ainda</p>
                <p className="text-sm">
                  A IA aprenderá automaticamente com as conversas ou você pode adicionar manualmente
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Padrão / Pergunta</TableHead>
                    <TableHead>Resposta Ideal</TableHead>
                    <TableHead>Confiança</TableHead>
                    <TableHead>Interações</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {learnings.map((learning) => (
                    <TableRow key={learning.id}>
                      <TableCell>{getTypeBadge(learning.learning_type)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {learning.trigger_pattern || "-"}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        {learning.ideal_response || "-"}
                      </TableCell>
                      <TableCell>
                        {getConfidenceBadge(Number(learning.confidence_score))}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {(Number(learning.confidence_score) * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-green-500">+{learning.success_count}</span>
                        {" / "}
                        <span className="text-red-500">-{learning.failure_count}</span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={learning.is_active}
                          onCheckedChange={() => handleToggleActive(learning)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!learning.approved_at && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-500"
                              onClick={() => handleApprove(learning)}
                              title="Aprovar"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(learning.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Como funciona o aprendizado?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Automático:</strong> A IA registra automaticamente interações bem-sucedidas
              (como agendamentos criados) e usa esses padrões para melhorar respostas futuras.
            </p>
            <p>
              <strong>Manual:</strong> Você pode ensinar a IA criando respostas padrão para
              perguntas frequentes do seu estabelecimento.
            </p>
            <p>
              <strong>Confiança:</strong> O score de confiança aumenta com interações positivas e
              diminui com falhas. Aprendizados com alta confiança são priorizados.
            </p>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
