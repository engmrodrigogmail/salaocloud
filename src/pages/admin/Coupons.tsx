import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Copy, Ticket, Users, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlatformCoupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  applies_to: string;
  applicable_plans: string[];
  applicable_features: string[];
  max_redemptions: number | null;
  current_redemptions: number;
  min_months: number | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

interface CouponRedemption {
  id: string;
  coupon_id: string;
  establishment_id: string;
  applied_to_plan: string | null;
  discount_amount: number | null;
  redeemed_at: string;
  is_active: boolean;
  establishment_name?: string;
}

const SUBSCRIPTION_PLANS = [
  { value: "basic", label: "Básico" },
  { value: "professional", label: "Profissional" },
  { value: "premium", label: "Premium" },
];

const SAAS_FEATURES = [
  { value: "whatsapp_reminders", label: "Lembretes WhatsApp" },
  { value: "reports", label: "Relatórios" },
  { value: "commissions", label: "Controle de Comissões" },
  { value: "api_access", label: "Acesso à API" },
  { value: "multi_units", label: "Multi-unidades" },
];

export default function AdminCoupons() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<PlatformCoupon[]>([]);
  const [redemptions, setRedemptions] = useState<CouponRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<PlatformCoupon | null>(null);
  const [selectedCouponForRedemptions, setSelectedCouponForRedemptions] = useState<string | null>(null);

  const [couponForm, setCouponForm] = useState({
    code: "",
    name: "",
    description: "",
    discount_type: "percentage",
    discount_value: 10,
    applies_to: "subscription",
    applicable_plans: [] as string[],
    applicable_features: [] as string[],
    max_redemptions: "",
    min_months: "1",
    valid_from: "",
    valid_until: "",
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar cupons da plataforma");
    } else {
      setCoupons(data || []);
    }
    setLoading(false);
  };

  const fetchRedemptions = async (couponId: string) => {
    const { data, error } = await supabase
      .from("platform_coupon_redemptions")
      .select(`
        *,
        establishments(name)
      `)
      .eq("coupon_id", couponId)
      .order("redeemed_at", { ascending: false });

    if (!error && data) {
      setRedemptions(
        data.map((r: any) => ({
          ...r,
          establishment_name: r.establishments?.name,
        }))
      );
    }
  };

  const handleAddCoupon = async () => {
    const { data, error } = await supabase
      .from("platform_coupons")
      .insert({
        code: couponForm.code.toUpperCase(),
        name: couponForm.name,
        description: couponForm.description || null,
        discount_type: couponForm.discount_type,
        discount_value: couponForm.discount_value,
        applies_to: couponForm.applies_to,
        applicable_plans: couponForm.applicable_plans,
        applicable_features: couponForm.applicable_features,
        max_redemptions: couponForm.max_redemptions ? parseInt(couponForm.max_redemptions) : null,
        min_months: couponForm.min_months ? parseInt(couponForm.min_months) : 1,
        valid_from: couponForm.valid_from || new Date().toISOString(),
        valid_until: couponForm.valid_until || null,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("Já existe um cupom com este código");
      } else {
        toast.error("Erro ao criar cupom");
      }
    } else {
      toast.success("Cupom da plataforma criado com sucesso!");
      setCoupons([data, ...coupons]);
      setIsAddCouponOpen(false);
      resetCouponForm();
    }
  };

  const handleUpdateCoupon = async () => {
    if (!editingCoupon) return;

    const { error } = await supabase
      .from("platform_coupons")
      .update({
        code: couponForm.code.toUpperCase(),
        name: couponForm.name,
        description: couponForm.description || null,
        discount_type: couponForm.discount_type,
        discount_value: couponForm.discount_value,
        applies_to: couponForm.applies_to,
        applicable_plans: couponForm.applicable_plans,
        applicable_features: couponForm.applicable_features,
        max_redemptions: couponForm.max_redemptions ? parseInt(couponForm.max_redemptions) : null,
        min_months: couponForm.min_months ? parseInt(couponForm.min_months) : 1,
        valid_from: couponForm.valid_from,
        valid_until: couponForm.valid_until || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingCoupon.id);

    if (error) {
      toast.error("Erro ao atualizar cupom");
    } else {
      toast.success("Cupom atualizado!");
      fetchCoupons();
      setEditingCoupon(null);
      resetCouponForm();
    }
  };

  const handleToggleCouponActive = async (coupon: PlatformCoupon) => {
    const { error } = await supabase
      .from("platform_coupons")
      .update({ is_active: !coupon.is_active, updated_at: new Date().toISOString() })
      .eq("id", coupon.id);

    if (!error) {
      fetchCoupons();
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    const { error } = await supabase.from("platform_coupons").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir cupom");
    } else {
      toast.success("Cupom excluído!");
      setCoupons(coupons.filter((c) => c.id !== id));
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const resetCouponForm = () => {
    setCouponForm({
      code: "",
      name: "",
      description: "",
      discount_type: "percentage",
      discount_value: 10,
      applies_to: "subscription",
      applicable_plans: [],
      applicable_features: [],
      max_redemptions: "",
      min_months: "1",
      valid_from: "",
      valid_until: "",
    });
  };

  const generateRandomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "SAAS";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCouponForm({ ...couponForm, code });
  };

  const getCouponStatus = (coupon: PlatformCoupon) => {
    const now = new Date();
    const validFrom = new Date(coupon.valid_from);
    const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;

    if (!coupon.is_active) return { label: "Inativo", variant: "secondary" as const };
    if (coupon.max_redemptions && coupon.current_redemptions >= coupon.max_redemptions)
      return { label: "Esgotado", variant: "destructive" as const };
    if (now < validFrom) return { label: "Agendado", variant: "outline" as const };
    if (validUntil && now > validUntil)
      return { label: "Expirado", variant: "destructive" as const };
    return { label: "Ativo", variant: "default" as const };
  };

  const handlePlanToggle = (plan: string) => {
    const newPlans = couponForm.applicable_plans.includes(plan)
      ? couponForm.applicable_plans.filter((p) => p !== plan)
      : [...couponForm.applicable_plans, plan];
    setCouponForm({ ...couponForm, applicable_plans: newPlans });
  };

  const handleFeatureToggle = (feature: string) => {
    const newFeatures = couponForm.applicable_features.includes(feature)
      ? couponForm.applicable_features.filter((f) => f !== feature)
      : [...couponForm.applicable_features, feature];
    setCouponForm({ ...couponForm, applicable_features: newFeatures });
  };

  const stats = {
    totalCoupons: coupons.length,
    activeCoupons: coupons.filter((c) => c.is_active).length,
    totalRedemptions: coupons.reduce((acc, c) => acc + c.current_redemptions, 0),
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold">Cupons da Plataforma</h1>
            <p className="text-muted-foreground">
              Gerencie cupons de desconto para assinaturas do SaaS
            </p>
          </div>
          <Dialog open={isAddCouponOpen} onOpenChange={setIsAddCouponOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus size={20} />
                Novo Cupom
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Cupom da Plataforma</DialogTitle>
                <DialogDescription>
                  Crie um cupom de desconto para assinaturas de estabelecimentos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="space-y-2">
                  <Label>Código do Cupom</Label>
                  <div className="flex gap-2">
                    <Input
                      value={couponForm.code}
                      onChange={(e) =>
                        setCouponForm({
                          ...couponForm,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="Ex: SAAS2024"
                      className="uppercase"
                    />
                    <Button type="button" variant="outline" onClick={generateRandomCode}>
                      Gerar
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nome do Cupom</Label>
                  <Input
                    value={couponForm.name}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, name: e.target.value })
                    }
                    placeholder="Ex: Desconto de Lançamento"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={couponForm.description}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, description: e.target.value })
                    }
                    placeholder="Descrição interna do cupom..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Desconto</Label>
                    <Select
                      value={couponForm.discount_type}
                      onValueChange={(value) =>
                        setCouponForm({ ...couponForm, discount_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentagem</SelectItem>
                        <SelectItem value="fixed">Valor Fixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Valor {couponForm.discount_type === "percentage" ? "(%)" : "(R$)"}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={couponForm.discount_value}
                      onChange={(e) =>
                        setCouponForm({
                          ...couponForm,
                          discount_value: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Planos Aplicáveis</Label>
                  <div className="flex flex-wrap gap-4">
                    {SUBSCRIPTION_PLANS.map((plan) => (
                      <div key={plan.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`plan-${plan.value}`}
                          checked={couponForm.applicable_plans.includes(plan.value)}
                          onCheckedChange={() => handlePlanToggle(plan.value)}
                        />
                        <Label htmlFor={`plan-${plan.value}`} className="font-normal">
                          {plan.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para aplicar a todos os planos
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Funcionalidades Aplicáveis</Label>
                  <div className="flex flex-wrap gap-4">
                    {SAAS_FEATURES.map((feature) => (
                      <div key={feature.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`feature-${feature.value}`}
                          checked={couponForm.applicable_features.includes(feature.value)}
                          onCheckedChange={() => handleFeatureToggle(feature.value)}
                        />
                        <Label htmlFor={`feature-${feature.value}`} className="font-normal">
                          {feature.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecione funcionalidades específicas para aplicar desconto (ex: desconto em WhatsApp)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Máximo de Usos</Label>
                    <Input
                      type="number"
                      min={1}
                      value={couponForm.max_redemptions}
                      onChange={(e) =>
                        setCouponForm({ ...couponForm, max_redemptions: e.target.value })
                      }
                      placeholder="Ilimitado"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mínimo de Meses</Label>
                    <Input
                      type="number"
                      min={1}
                      value={couponForm.min_months}
                      onChange={(e) =>
                        setCouponForm({ ...couponForm, min_months: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Válido a partir de</Label>
                    <Input
                      type="datetime-local"
                      value={couponForm.valid_from}
                      onChange={(e) =>
                        setCouponForm({ ...couponForm, valid_from: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Válido até (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={couponForm.valid_until}
                      onChange={(e) =>
                        setCouponForm({ ...couponForm, valid_until: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Button onClick={handleAddCoupon} className="w-full">
                  Criar Cupom
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Cupons</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCoupons}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeCoupons} ativos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cupons Ativos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeCoupons}</div>
              <p className="text-xs text-muted-foreground">
                Disponíveis para uso
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Resgates</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRedemptions}</div>
              <p className="text-xs text-muted-foreground">
                Cupons utilizados
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="coupons" className="space-y-4">
          <TabsList>
            <TabsTrigger value="coupons">Cupons</TabsTrigger>
            <TabsTrigger value="redemptions">Histórico de Resgates</TabsTrigger>
          </TabsList>

          <TabsContent value="coupons">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                Carregando...
              </div>
            ) : coupons.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Ticket className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Nenhum cupom da plataforma
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Crie cupons de desconto para oferecer aos estabelecimentos
                  </p>
                  <Button onClick={() => setIsAddCouponOpen(true)}>
                    Criar Cupom
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Planos</TableHead>
                      <TableHead>Usos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-40">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map((coupon) => {
                      const status = getCouponStatus(coupon);
                      return (
                        <TableRow key={coupon.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="bg-primary/10 text-primary px-2 py-1 rounded font-mono text-sm font-semibold">
                                {coupon.code}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(coupon.code)}
                              >
                                <Copy size={14} />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{coupon.name}</p>
                              {coupon.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {coupon.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {coupon.discount_type === "percentage"
                                ? `${coupon.discount_value}%`
                                : `R$ ${coupon.discount_value}`}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {coupon.applicable_plans.length === 0 ? (
                              <span className="text-sm text-muted-foreground">Todos</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {coupon.applicable_plans.map((plan) => (
                                  <Badge key={plan} variant="outline" className="text-xs">
                                    {SUBSCRIPTION_PLANS.find((p) => p.value === plan)?.label || plan}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{coupon.current_redemptions}</span>
                            {coupon.max_redemptions && (
                              <span className="text-muted-foreground">
                                /{coupon.max_redemptions}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={coupon.is_active}
                                onCheckedChange={() => handleToggleCouponActive(coupon)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingCoupon(coupon);
                                  setCouponForm({
                                    code: coupon.code,
                                    name: coupon.name,
                                    description: coupon.description || "",
                                    discount_type: coupon.discount_type,
                                    discount_value: coupon.discount_value,
                                    applies_to: coupon.applies_to,
                                    applicable_plans: coupon.applicable_plans || [],
                                    applicable_features: coupon.applicable_features || [],
                                    max_redemptions: coupon.max_redemptions?.toString() || "",
                                    min_months: coupon.min_months?.toString() || "1",
                                    valid_from: coupon.valid_from.slice(0, 16),
                                    valid_until: coupon.valid_until?.slice(0, 16) || "",
                                  });
                                }}
                              >
                                <Edit size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => handleDeleteCoupon(coupon.id)}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="redemptions">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Resgates</CardTitle>
                <CardDescription>
                  Selecione um cupom para ver os resgates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Select
                    value={selectedCouponForRedemptions || ""}
                    onValueChange={(value) => {
                      setSelectedCouponForRedemptions(value);
                      fetchRedemptions(value);
                    }}
                  >
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue placeholder="Selecione um cupom" />
                    </SelectTrigger>
                    <SelectContent>
                      {coupons.map((coupon) => (
                        <SelectItem key={coupon.id} value={coupon.id}>
                          {coupon.code} - {coupon.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedCouponForRedemptions && redemptions.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhum resgate para este cupom
                    </p>
                  ) : selectedCouponForRedemptions && redemptions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Estabelecimento</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Desconto Aplicado</TableHead>
                          <TableHead>Data do Resgate</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {redemptions.map((redemption) => (
                          <TableRow key={redemption.id}>
                            <TableCell className="font-medium">
                              {redemption.establishment_name || "Estabelecimento"}
                            </TableCell>
                            <TableCell>
                              {SUBSCRIPTION_PLANS.find(
                                (p) => p.value === redemption.applied_to_plan
                              )?.label || redemption.applied_to_plan || "-"}
                            </TableCell>
                            <TableCell>
                              {redemption.discount_amount
                                ? `R$ ${redemption.discount_amount.toFixed(2)}`
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {format(new Date(redemption.redeemed_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={redemption.is_active ? "default" : "secondary"}>
                                {redemption.is_active ? "Ativo" : "Expirado"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      Selecione um cupom para ver o histórico de resgates
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Coupon Dialog */}
        <Dialog
          open={!!editingCoupon}
          onOpenChange={(open) => !open && setEditingCoupon(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Cupom</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-2">
                <Label>Código do Cupom</Label>
                <Input
                  value={couponForm.code}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })
                  }
                  className="uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome do Cupom</Label>
                <Input
                  value={couponForm.name}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={couponForm.description}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Desconto</Label>
                  <Select
                    value={couponForm.discount_type}
                    onValueChange={(value) =>
                      setCouponForm({ ...couponForm, discount_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentagem</SelectItem>
                      <SelectItem value="fixed">Valor Fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    type="number"
                    min={0}
                    value={couponForm.discount_value}
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        discount_value: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Planos Aplicáveis</Label>
                <div className="flex flex-wrap gap-4">
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <div key={plan.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-plan-${plan.value}`}
                        checked={couponForm.applicable_plans.includes(plan.value)}
                        onCheckedChange={() => handlePlanToggle(plan.value)}
                      />
                      <Label htmlFor={`edit-plan-${plan.value}`} className="font-normal">
                        {plan.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Máximo de Usos</Label>
                  <Input
                    type="number"
                    min={1}
                    value={couponForm.max_redemptions}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, max_redemptions: e.target.value })
                    }
                    placeholder="Ilimitado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mínimo de Meses</Label>
                  <Input
                    type="number"
                    min={1}
                    value={couponForm.min_months}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, min_months: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Válido a partir de</Label>
                  <Input
                    type="datetime-local"
                    value={couponForm.valid_from}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, valid_from: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Válido até</Label>
                  <Input
                    type="datetime-local"
                    value={couponForm.valid_until}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, valid_until: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button onClick={handleUpdateCoupon} className="w-full">
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
