import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Star, Gift, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface LoyaltyProgram {
  id: string;
  name: string;
  description: string | null;
  points_per_currency: number;
  is_active: boolean;
  created_at: string;
}

interface LoyaltyReward {
  id: string;
  loyalty_program_id: string;
  name: string;
  description: string | null;
  points_required: number;
  reward_type: string;
  reward_value: number;
  is_active: boolean;
}

interface ClientPoints {
  id: string;
  client_id: string;
  points_balance: number;
  total_points_earned: number;
  client_name?: string;
}

export default function Loyalty() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [clientPoints, setClientPoints] = useState<ClientPoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const [isAddRewardOpen, setIsAddRewardOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<LoyaltyProgram | null>(null);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);

  const [programForm, setProgramForm] = useState({
    name: "",
    description: "",
    points_per_currency: 1,
  });

  const [rewardForm, setRewardForm] = useState({
    name: "",
    description: "",
    points_required: 100,
    reward_type: "discount_percentage",
    reward_value: 10,
  });

  useEffect(() => {
    if (user) {
      fetchEstablishment();
    }
  }, [user]);

  useEffect(() => {
    if (establishmentId) {
      fetchPrograms();
    }
  }, [establishmentId]);

  useEffect(() => {
    if (selectedProgram) {
      fetchRewards(selectedProgram.id);
      fetchClientPoints(selectedProgram.id);
    }
  }, [selectedProgram]);

  const fetchEstablishment = async () => {
    const { data } = await supabase
      .from("establishments")
      .select("id")
      .eq("owner_id", user!.id)
      .single();

    if (data) {
      setEstablishmentId(data.id);
    }
  };

  const fetchPrograms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loyalty_programs")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar programas de fidelidade");
    } else {
      setPrograms(data || []);
      if (data && data.length > 0 && !selectedProgram) {
        setSelectedProgram(data[0]);
      }
    }
    setLoading(false);
  };

  const fetchRewards = async (programId: string) => {
    const { data, error } = await supabase
      .from("loyalty_rewards")
      .select("*")
      .eq("loyalty_program_id", programId)
      .order("points_required", { ascending: true });

    if (!error) {
      setRewards(data || []);
    }
  };

  const fetchClientPoints = async (programId: string) => {
    const { data, error } = await supabase
      .from("client_loyalty_points")
      .select(`
        *,
        clients(name)
      `)
      .eq("loyalty_program_id", programId)
      .order("points_balance", { ascending: false });

    if (!error && data) {
      setClientPoints(
        data.map((cp: any) => ({
          ...cp,
          client_name: cp.clients?.name,
        }))
      );
    }
  };

  const handleAddProgram = async () => {
    if (!establishmentId) return;

    const { data, error } = await supabase
      .from("loyalty_programs")
      .insert({
        establishment_id: establishmentId,
        name: programForm.name,
        description: programForm.description || null,
        points_per_currency: programForm.points_per_currency,
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar programa de fidelidade");
    } else {
      toast.success("Programa de fidelidade criado com sucesso!");
      setPrograms([data, ...programs]);
      setSelectedProgram(data);
      setIsAddProgramOpen(false);
      setProgramForm({ name: "", description: "", points_per_currency: 1 });
    }
  };

  const handleUpdateProgram = async () => {
    if (!editingProgram) return;

    const { error } = await supabase
      .from("loyalty_programs")
      .update({
        name: programForm.name,
        description: programForm.description || null,
        points_per_currency: programForm.points_per_currency,
      })
      .eq("id", editingProgram.id);

    if (error) {
      toast.error("Erro ao atualizar programa");
    } else {
      toast.success("Programa atualizado com sucesso!");
      fetchPrograms();
      setEditingProgram(null);
      setProgramForm({ name: "", description: "", points_per_currency: 1 });
    }
  };

  const handleToggleProgramActive = async (program: LoyaltyProgram) => {
    const { error } = await supabase
      .from("loyalty_programs")
      .update({ is_active: !program.is_active })
      .eq("id", program.id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      fetchPrograms();
    }
  };

  const handleDeleteProgram = async (id: string) => {
    const { error } = await supabase
      .from("loyalty_programs")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir programa");
    } else {
      toast.success("Programa excluído com sucesso!");
      setPrograms(programs.filter((p) => p.id !== id));
      if (selectedProgram?.id === id) {
        setSelectedProgram(programs.length > 1 ? programs[0] : null);
      }
    }
  };

  const handleAddReward = async () => {
    if (!selectedProgram) return;

    const { data, error } = await supabase
      .from("loyalty_rewards")
      .insert({
        loyalty_program_id: selectedProgram.id,
        name: rewardForm.name,
        description: rewardForm.description || null,
        points_required: rewardForm.points_required,
        reward_type: rewardForm.reward_type,
        reward_value: rewardForm.reward_value,
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar recompensa");
    } else {
      toast.success("Recompensa criada com sucesso!");
      setRewards([...rewards, data]);
      setIsAddRewardOpen(false);
      setRewardForm({
        name: "",
        description: "",
        points_required: 100,
        reward_type: "discount_percentage",
        reward_value: 10,
      });
    }
  };

  const handleDeleteReward = async (id: string) => {
    const { error } = await supabase
      .from("loyalty_rewards")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir recompensa");
    } else {
      toast.success("Recompensa excluída!");
      setRewards(rewards.filter((r) => r.id !== id));
    }
  };

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
      case "discount_percentage":
        return "Desconto %";
      case "discount_fixed":
        return "Desconto R$";
      case "free_service":
        return "Serviço Grátis";
      default:
        return type;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold">Programa de Fidelidade</h1>
            <p className="text-muted-foreground">
              Gerencie pontos e recompensas para seus clientes
            </p>
          </div>
          <Dialog open={isAddProgramOpen} onOpenChange={setIsAddProgramOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus size={20} />
                Novo Programa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Programa de Fidelidade</DialogTitle>
                <DialogDescription>
                  Configure como seus clientes acumulam pontos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Programa</Label>
                  <Input
                    id="name"
                    value={programForm.name}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, name: e.target.value })
                    }
                    placeholder="Ex: Programa Fidelidade Premium"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={programForm.description}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, description: e.target.value })
                    }
                    placeholder="Descreva os benefícios do programa..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="points">Pontos por R$ gasto</Label>
                  <Input
                    id="points"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={programForm.points_per_currency}
                    onChange={(e) =>
                      setProgramForm({
                        ...programForm,
                        points_per_currency: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <Button onClick={handleAddProgram} className="w-full">
                  Criar Programa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : programs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Star className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum programa de fidelidade
              </h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro programa para começar a fidelizar clientes
              </p>
              <Button onClick={() => setIsAddProgramOpen(true)}>
                Criar Programa
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Programs List */}
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Seus Programas</h2>
              {programs.map((program) => (
                <Card
                  key={program.id}
                  className={`cursor-pointer transition-all ${
                    selectedProgram?.id === program.id
                      ? "ring-2 ring-primary"
                      : "hover:shadow-md"
                  }`}
                  onClick={() => setSelectedProgram(program)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{program.name}</CardTitle>
                      <Badge variant={program.is_active ? "default" : "secondary"}>
                        {program.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <CardDescription>{program.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {program.points_per_currency} pts/R$
                      </span>
                      <div className="flex gap-2">
                        <Switch
                          checked={program.is_active}
                          onCheckedChange={() => handleToggleProgramActive(program)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProgram(program);
                            setProgramForm({
                              name: program.name,
                              description: program.description || "",
                              points_per_currency: program.points_per_currency,
                            });
                          }}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProgram(program.id);
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Selected Program Details */}
            {selectedProgram && (
              <div className="lg:col-span-2 space-y-6">
                {/* Rewards Section */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Gift size={20} />
                        Recompensas
                      </CardTitle>
                      <CardDescription>
                        O que seus clientes podem resgatar com pontos
                      </CardDescription>
                    </div>
                    <Dialog open={isAddRewardOpen} onOpenChange={setIsAddRewardOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                          <Plus size={16} />
                          Adicionar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Nova Recompensa</DialogTitle>
                          <DialogDescription>
                            Configure uma recompensa para o programa{" "}
                            {selectedProgram.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>Nome da Recompensa</Label>
                            <Input
                              value={rewardForm.name}
                              onChange={(e) =>
                                setRewardForm({ ...rewardForm, name: e.target.value })
                              }
                              placeholder="Ex: 10% de desconto"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Descrição</Label>
                            <Textarea
                              value={rewardForm.description}
                              onChange={(e) =>
                                setRewardForm({
                                  ...rewardForm,
                                  description: e.target.value,
                                })
                              }
                              placeholder="Detalhes da recompensa..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Pontos Necessários</Label>
                            <Input
                              type="number"
                              min={1}
                              value={rewardForm.points_required}
                              onChange={(e) =>
                                setRewardForm({
                                  ...rewardForm,
                                  points_required: parseInt(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Tipo</Label>
                              <Select
                                value={rewardForm.reward_type}
                                onValueChange={(value) =>
                                  setRewardForm({ ...rewardForm, reward_type: value })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="discount_percentage">
                                    Desconto %
                                  </SelectItem>
                                  <SelectItem value="discount_fixed">
                                    Desconto R$
                                  </SelectItem>
                                  <SelectItem value="free_service">
                                    Serviço Grátis
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Valor</Label>
                              <Input
                                type="number"
                                min={0}
                                value={rewardForm.reward_value}
                                onChange={(e) =>
                                  setRewardForm({
                                    ...rewardForm,
                                    reward_value: parseFloat(e.target.value),
                                  })
                                }
                              />
                            </div>
                          </div>
                          <Button onClick={handleAddReward} className="w-full">
                            Criar Recompensa
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {rewards.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        Nenhuma recompensa cadastrada
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Recompensa</TableHead>
                            <TableHead>Pontos</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead className="w-20">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rewards.map((reward) => (
                            <TableRow key={reward.id}>
                              <TableCell className="font-medium">
                                {reward.name}
                              </TableCell>
                              <TableCell>{reward.points_required}</TableCell>
                              <TableCell>
                                {getRewardTypeLabel(reward.reward_type)}
                              </TableCell>
                              <TableCell>
                                {reward.reward_type === "discount_percentage"
                                  ? `${reward.reward_value}%`
                                  : `R$ ${reward.reward_value}`}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => handleDeleteReward(reward.id)}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Client Points Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users size={20} />
                      Pontos dos Clientes
                    </CardTitle>
                    <CardDescription>
                      Acompanhe o saldo de pontos de cada cliente
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {clientPoints.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        Nenhum cliente com pontos ainda
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Saldo Atual</TableHead>
                            <TableHead>Total Acumulado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientPoints.map((cp) => (
                            <TableRow key={cp.id}>
                              <TableCell className="font-medium">
                                {cp.client_name || "Cliente"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {cp.points_balance} pts
                                </Badge>
                              </TableCell>
                              <TableCell>{cp.total_points_earned} pts</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Edit Program Dialog */}
        <Dialog
          open={!!editingProgram}
          onOpenChange={(open) => !open && setEditingProgram(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Programa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome do Programa</Label>
                <Input
                  value={programForm.name}
                  onChange={(e) =>
                    setProgramForm({ ...programForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={programForm.description}
                  onChange={(e) =>
                    setProgramForm({ ...programForm, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Pontos por R$ gasto</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={programForm.points_per_currency}
                  onChange={(e) =>
                    setProgramForm({
                      ...programForm,
                      points_per_currency: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <Button onClick={handleUpdateProgram} className="w-full">
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
