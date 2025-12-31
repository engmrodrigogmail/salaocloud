import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, GripVertical, Plus, X, Star, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SubscriptionPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  features: string[];
  limits: Record<string, number | boolean>;
  is_active: boolean;
  is_highlighted: boolean;
  badge: string | null;
  cta_text: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_LIMITS = {
  max_professionals: 2,
  max_services: 20,
  max_clients: -1,
  email_reminders: true,
  reports_basic: true,
  reports_advanced: false,
  commissions: false,
  loyalty_program: false,
  discount_coupons: false,
  portfolio_catalog: false,
  internal_tabs: false,
  api_access: false,
  multi_units: false,
  priority_support: false,
  dedicated_manager: false,
  custom_branding: false,
};

const LIMIT_LABELS: Record<string, { label: string; description: string; type: 'number' | 'boolean' }> = {
  max_professionals: { label: 'Máx. Profissionais', description: '-1 = ilimitado', type: 'number' },
  max_services: { label: 'Máx. Serviços', description: '-1 = ilimitado', type: 'number' },
  max_clients: { label: 'Máx. Clientes', description: '-1 = ilimitado', type: 'number' },
  email_reminders: { label: 'Lembretes por Email', description: 'Notificações via email', type: 'boolean' },
  reports_basic: { label: 'Relatórios Básicos', description: 'Relatórios de agendamentos e clientes', type: 'boolean' },
  reports_advanced: { label: 'Relatórios Avançados', description: 'Análises detalhadas e métricas', type: 'boolean' },
  commissions: { label: 'Controle de Comissões', description: 'Gestão de comissões por profissional', type: 'boolean' },
  loyalty_program: { label: 'Programa de Fidelidade', description: 'Sistema de pontos e recompensas', type: 'boolean' },
  discount_coupons: { label: 'Cupons de Desconto', description: 'Criar e gerenciar cupons', type: 'boolean' },
  portfolio_catalog: { label: 'Portfólio/Catálogo', description: 'Exibir serviços na página de agendamento', type: 'boolean' },
  internal_tabs: { label: 'Sistema de Comandas', description: 'Controle interno de consumo', type: 'boolean' },
  api_access: { label: 'Acesso à API', description: 'Integrações personalizadas', type: 'boolean' },
  multi_units: { label: 'Multi-unidades', description: 'Gerenciar várias filiais', type: 'boolean' },
  priority_support: { label: 'Suporte Prioritário', description: 'Atendimento preferencial', type: 'boolean' },
  dedicated_manager: { label: 'Gerente Dedicado', description: 'Gerente de conta exclusivo', type: 'boolean' },
  custom_branding: { label: 'Marca Personalizada', description: 'Logo e cores próprias', type: 'boolean' },
};

// Sortable Row Component
interface SortableRowProps {
  plan: SubscriptionPlan;
  formatPrice: (price: number) => string;
  handleToggleActive: (plan: SubscriptionPlan) => void;
  handleToggleHighlighted: (plan: SubscriptionPlan) => void;
  handleEdit: (plan: SubscriptionPlan) => void;
  handleDelete: (id: string) => void;
}

function SortableRow({
  plan,
  formatPrice,
  handleToggleActive,
  handleToggleHighlighted,
  handleEdit,
  handleDelete,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plan.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{plan.name}</span>
          {plan.badge && <Badge variant="secondary">{plan.badge}</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">{plan.slug}</span>
      </TableCell>
      <TableCell>{formatPrice(plan.price_monthly)}</TableCell>
      <TableCell>
        {plan.price_yearly ? formatPrice(plan.price_yearly) : "-"}
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {plan.features.length} features
        </span>
      </TableCell>
      <TableCell>
        <Switch
          checked={plan.is_active}
          onCheckedChange={() => handleToggleActive(plan)}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={plan.is_highlighted}
          onCheckedChange={() => handleToggleHighlighted(plan)}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(plan.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getDefaultForm = () => ({
    slug: "",
    name: "",
    description: "",
    price_monthly: 0,
    price_yearly: 0,
    features: [] as string[],
    limits: { ...DEFAULT_LIMITS },
    is_active: true,
    is_highlighted: false,
    badge: "",
    cta_text: "Começar Grátis",
    display_order: plans.length + 1,
  });

  const [planForm, setPlanForm] = useState(getDefaultForm());

  const [newFeature, setNewFeature] = useState("");

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscription_plans" as any)
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar planos");
      console.error(error);
    } else {
      const parsedData = (data || []).map((plan: any) => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : [],
        limits: typeof plan.limits === 'object' && plan.limits !== null ? plan.limits : DEFAULT_LIMITS,
      }));
      setPlans(parsedData);
    }
    setLoading(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingPlan(null);
    setPlanForm({
      ...getDefaultForm(),
      display_order: plans.length + 1,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setIsCreating(false);
    setEditingPlan(plan);
    setPlanForm({
      slug: plan.slug,
      name: plan.name,
      description: plan.description || "",
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly || 0,
      features: plan.features,
      limits: { ...DEFAULT_LIMITS, ...plan.limits },
      is_active: plan.is_active,
      is_highlighted: plan.is_highlighted,
      badge: plan.badge || "",
      cta_text: plan.cta_text,
      display_order: plan.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleSaveNew = async () => {
    if (!planForm.slug || !planForm.name) {
      toast.error("Slug e nome são obrigatórios");
      return;
    }

    const { error } = await supabase
      .from("subscription_plans" as any)
      .insert({
        slug: planForm.slug,
        name: planForm.name,
        description: planForm.description || null,
        price_monthly: planForm.price_monthly,
        price_yearly: planForm.price_yearly || null,
        features: planForm.features,
        limits: planForm.limits,
        is_active: planForm.is_active,
        is_highlighted: planForm.is_highlighted,
        badge: planForm.badge || null,
        cta_text: planForm.cta_text,
        display_order: planForm.display_order,
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("Já existe um plano com este slug");
      } else {
        toast.error("Erro ao criar plano");
        console.error(error);
      }
    } else {
      toast.success("Plano criado com sucesso!");
      fetchPlans();
      setIsDialogOpen(false);
      setIsCreating(false);
    }
  };

  const handleSave = async () => {
    if (!editingPlan) return;

    const { error } = await supabase
      .from("subscription_plans" as any)
      .update({
        slug: planForm.slug,
        name: planForm.name,
        description: planForm.description || null,
        price_monthly: planForm.price_monthly,
        price_yearly: planForm.price_yearly || null,
        features: planForm.features,
        limits: planForm.limits,
        is_active: planForm.is_active,
        is_highlighted: planForm.is_highlighted,
        badge: planForm.badge || null,
        cta_text: planForm.cta_text,
        display_order: planForm.display_order,
      })
      .eq("id", editingPlan.id);

    if (error) {
      toast.error("Erro ao salvar plano");
      console.error(error);
    } else {
      toast.success("Plano atualizado com sucesso!");
      fetchPlans();
      setIsDialogOpen(false);
      setEditingPlan(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = plans.findIndex((p) => p.id === active.id);
      const newIndex = plans.findIndex((p) => p.id === over.id);

      const newPlans = arrayMove(plans, oldIndex, newIndex);
      setPlans(newPlans);

      // Update display_order for all affected plans
      const updates = newPlans.map((plan, index) => ({
        id: plan.id,
        display_order: index + 1,
      }));

      // Update each plan's display_order in the database
      for (const update of updates) {
        await supabase
          .from("subscription_plans" as any)
          .update({ display_order: update.display_order })
          .eq("id", update.id);
      }

      toast.success("Ordem dos planos atualizada!");
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    const { error } = await supabase
      .from("subscription_plans" as any)
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      fetchPlans();
    }
  };

  const handleToggleHighlighted = async (plan: SubscriptionPlan) => {
    const { error } = await supabase
      .from("subscription_plans" as any)
      .update({ is_highlighted: !plan.is_highlighted })
      .eq("id", plan.id);

    if (error) {
      toast.error("Erro ao atualizar destaque");
    } else {
      fetchPlans();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este plano?")) return;

    const { error } = await supabase
      .from("subscription_plans" as any)
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir plano");
    } else {
      toast.success("Plano excluído!");
      fetchPlans();
    }
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setPlanForm({
        ...planForm,
        features: [...planForm.features, newFeature.trim()],
      });
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    setPlanForm({
      ...planForm,
      features: planForm.features.filter((_, i) => i !== index),
    });
  };

  const updateLimit = (key: string, value: number | boolean) => {
    setPlanForm({
      ...planForm,
      limits: { ...planForm.limits, [key]: value },
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const stats = {
    totalPlans: plans.length,
    activePlans: plans.filter((p) => p.is_active).length,
    highlightedPlan: plans.find((p) => p.is_highlighted)?.name || "Nenhum",
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold">Planos de Assinatura</h1>
            <p className="text-muted-foreground">
              Gerencie os planos de assinatura da plataforma
            </p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus size={20} />
            Novo Plano
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Planos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPlans}</div>
              <p className="text-xs text-muted-foreground">{stats.activePlans} ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activePlans}</div>
              <p className="text-xs text-muted-foreground">Visíveis para clientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Plano em Destaque</CardTitle>
              <Star className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.highlightedPlan}</div>
              <p className="text-xs text-muted-foreground">Mais recomendado</p>
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle>Todos os Planos</CardTitle>
            <CardDescription>
              Arraste para reordenar os planos. A ordem será refletida na página de preços.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Preço Mensal</TableHead>
                      <TableHead>Preço Anual</TableHead>
                      <TableHead>Features</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Destaque</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={plans.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {plans.map((plan) => (
                        <SortableRow
                          key={plan.id}
                          plan={plan}
                          formatPrice={formatPrice}
                          handleToggleActive={handleToggleActive}
                          handleToggleHighlighted={handleToggleHighlighted}
                          handleEdit={handleEdit}
                          handleDelete={handleDelete}
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isCreating ? "Novo Plano" : `Editar Plano: ${editingPlan?.name}`}
              </DialogTitle>
              <DialogDescription>
                {isCreating 
                  ? "Crie um novo plano de assinatura" 
                  : "Atualize os detalhes, preços e limites do plano"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={planForm.slug}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, slug: e.target.value })
                    }
                    placeholder="basic"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={planForm.name}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, name: e.target.value })
                    }
                    placeholder="Básico"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={planForm.description}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, description: e.target.value })
                  }
                  placeholder="Descrição do plano..."
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço Mensal (R$)</Label>
                  <Input
                    type="number"
                    value={planForm.price_monthly}
                    onChange={(e) =>
                      setPlanForm({
                        ...planForm,
                        price_monthly: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Anual (R$)</Label>
                  <Input
                    type="number"
                    value={planForm.price_yearly}
                    onChange={(e) =>
                      setPlanForm({
                        ...planForm,
                        price_yearly: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              {/* Appearance */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Badge (opcional)</Label>
                  <Input
                    value={planForm.badge}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, badge: e.target.value })
                    }
                    placeholder="Mais Popular"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Texto do Botão (CTA)</Label>
                  <Input
                    value={planForm.cta_text}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, cta_text: e.target.value })
                    }
                    placeholder="Começar Grátis"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label>Plano Ativo</Label>
                  <Switch
                    checked={planForm.is_active}
                    onCheckedChange={(checked) =>
                      setPlanForm({ ...planForm, is_active: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label>Destacar Plano</Label>
                  <Switch
                    checked={planForm.is_highlighted}
                    onCheckedChange={(checked) =>
                      setPlanForm({ ...planForm, is_highlighted: checked })
                    }
                  />
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3">
                <Label>Features do Plano</Label>
                <div className="flex gap-2">
                  <Input
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="Nova feature..."
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                  />
                  <Button type="button" variant="outline" onClick={addFeature}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {planForm.features.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <span className="text-sm">{feature}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFeature(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Limits */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Limites e Recursos do Plano</Label>
                
                {/* Numeric Limits */}
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(LIMIT_LABELS)
                    .filter(([_, config]) => config.type === 'number')
                    .map(([key, config]) => (
                      <div key={key} className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                          {config.label}
                        </Label>
                        <Input
                          type="number"
                          value={(planForm.limits as Record<string, number | boolean>)[key] as number ?? 0}
                          onChange={(e) =>
                            updateLimit(key, parseInt(e.target.value) || 0)
                          }
                          placeholder={config.description}
                        />
                        <span className="text-xs text-muted-foreground">{config.description}</span>
                      </div>
                    ))}
                </div>

                {/* Boolean Limits */}
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(LIMIT_LABELS)
                    .filter(([_, config]) => config.type === 'boolean')
                    .map(([key, config]) => (
                      <div key={key} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">{config.label}</Label>
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                        </div>
                        <Switch
                          checked={(planForm.limits as Record<string, number | boolean>)[key] as boolean ?? false}
                          onCheckedChange={(checked) => updateLimit(key, checked)}
                        />
                      </div>
                    ))}
                </div>
              </div>

              <Button 
                onClick={isCreating ? handleSaveNew : handleSave} 
                className="w-full"
              >
                {isCreating ? "Criar Plano" : "Salvar Alterações"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
