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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Percent, Tag, Calendar, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  min_purchase_value: number | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
}

export default function Promotions() {
  const { user } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [isAddPromotionOpen, setIsAddPromotionOpen] = useState(false);
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const [promotionForm, setPromotionForm] = useState({
    name: "",
    description: "",
    discount_type: "percentage",
    discount_value: 10,
    start_date: "",
    end_date: "",
  });

  const [couponForm, setCouponForm] = useState({
    code: "",
    description: "",
    discount_type: "percentage",
    discount_value: 10,
    max_uses: "",
    min_purchase_value: "",
    valid_from: "",
    valid_until: "",
  });

  useEffect(() => {
    if (user) {
      fetchEstablishment();
    }
  }, [user]);

  useEffect(() => {
    if (establishmentId) {
      fetchPromotions();
      fetchCoupons();
    }
  }, [establishmentId]);

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

  const fetchPromotions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false });

    if (!error) {
      setPromotions(data || []);
    }
    setLoading(false);
  };

  const fetchCoupons = async () => {
    const { data, error } = await supabase
      .from("discount_coupons")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false });

    if (!error) {
      setCoupons(data || []);
    }
  };

  const handleAddPromotion = async () => {
    if (!establishmentId) return;

    const { data, error } = await supabase
      .from("promotions")
      .insert({
        establishment_id: establishmentId,
        name: promotionForm.name,
        description: promotionForm.description || null,
        discount_type: promotionForm.discount_type,
        discount_value: promotionForm.discount_value,
        start_date: promotionForm.start_date,
        end_date: promotionForm.end_date,
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar promoção");
    } else {
      toast.success("Promoção criada com sucesso!");
      setPromotions([data, ...promotions]);
      setIsAddPromotionOpen(false);
      resetPromotionForm();
    }
  };

  const handleUpdatePromotion = async () => {
    if (!editingPromotion) return;

    const { error } = await supabase
      .from("promotions")
      .update({
        name: promotionForm.name,
        description: promotionForm.description || null,
        discount_type: promotionForm.discount_type,
        discount_value: promotionForm.discount_value,
        start_date: promotionForm.start_date,
        end_date: promotionForm.end_date,
      })
      .eq("id", editingPromotion.id);

    if (error) {
      toast.error("Erro ao atualizar promoção");
    } else {
      toast.success("Promoção atualizada!");
      fetchPromotions();
      setEditingPromotion(null);
      resetPromotionForm();
    }
  };

  const handleTogglePromotionActive = async (promo: Promotion) => {
    const { error } = await supabase
      .from("promotions")
      .update({ is_active: !promo.is_active })
      .eq("id", promo.id);

    if (!error) {
      fetchPromotions();
    }
  };

  const handleDeletePromotion = async (id: string) => {
    const { error } = await supabase.from("promotions").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir promoção");
    } else {
      toast.success("Promoção excluída!");
      setPromotions(promotions.filter((p) => p.id !== id));
    }
  };

  const handleAddCoupon = async () => {
    if (!establishmentId) return;

    const { data, error } = await supabase
      .from("discount_coupons")
      .insert({
        establishment_id: establishmentId,
        code: couponForm.code.toUpperCase(),
        description: couponForm.description || null,
        discount_type: couponForm.discount_type,
        discount_value: couponForm.discount_value,
        max_uses: couponForm.max_uses ? parseInt(couponForm.max_uses) : null,
        min_purchase_value: couponForm.min_purchase_value
          ? parseFloat(couponForm.min_purchase_value)
          : null,
        valid_from: couponForm.valid_from || new Date().toISOString(),
        valid_until: couponForm.valid_until || null,
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
      toast.success("Cupom criado com sucesso!");
      setCoupons([data, ...coupons]);
      setIsAddCouponOpen(false);
      resetCouponForm();
    }
  };

  const handleUpdateCoupon = async () => {
    if (!editingCoupon) return;

    const { error } = await supabase
      .from("discount_coupons")
      .update({
        code: couponForm.code.toUpperCase(),
        description: couponForm.description || null,
        discount_type: couponForm.discount_type,
        discount_value: couponForm.discount_value,
        max_uses: couponForm.max_uses ? parseInt(couponForm.max_uses) : null,
        min_purchase_value: couponForm.min_purchase_value
          ? parseFloat(couponForm.min_purchase_value)
          : null,
        valid_from: couponForm.valid_from,
        valid_until: couponForm.valid_until || null,
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

  const handleToggleCouponActive = async (coupon: Coupon) => {
    const { error } = await supabase
      .from("discount_coupons")
      .update({ is_active: !coupon.is_active })
      .eq("id", coupon.id);

    if (!error) {
      fetchCoupons();
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    const { error } = await supabase.from("discount_coupons").delete().eq("id", id);

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

  const resetPromotionForm = () => {
    setPromotionForm({
      name: "",
      description: "",
      discount_type: "percentage",
      discount_value: 10,
      start_date: "",
      end_date: "",
    });
  };

  const resetCouponForm = () => {
    setCouponForm({
      code: "",
      description: "",
      discount_type: "percentage",
      discount_value: 10,
      max_uses: "",
      min_purchase_value: "",
      valid_from: "",
      valid_until: "",
    });
  };

  const generateRandomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCouponForm({ ...couponForm, code });
  };

  const getPromotionStatus = (promo: Promotion) => {
    const now = new Date();
    const start = new Date(promo.start_date);
    const end = new Date(promo.end_date);

    if (!promo.is_active) return { label: "Inativa", variant: "secondary" as const };
    if (now < start) return { label: "Agendada", variant: "outline" as const };
    if (now > end) return { label: "Encerrada", variant: "destructive" as const };
    return { label: "Ativa", variant: "default" as const };
  };

  const getCouponStatus = (coupon: Coupon) => {
    const now = new Date();
    const validFrom = new Date(coupon.valid_from);
    const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;

    if (!coupon.is_active) return { label: "Inativo", variant: "secondary" as const };
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses)
      return { label: "Esgotado", variant: "destructive" as const };
    if (now < validFrom) return { label: "Agendado", variant: "outline" as const };
    if (validUntil && now > validUntil)
      return { label: "Expirado", variant: "destructive" as const };
    return { label: "Ativo", variant: "default" as const };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Promoções & Cupons</h1>
          <p className="text-muted-foreground">
            Gerencie promoções sazonais e cupons de desconto
          </p>
        </div>

        <Tabs defaultValue="promotions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="promotions" className="gap-2">
              <Calendar size={16} />
              Promoções
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2">
              <Tag size={16} />
              Cupons
            </TabsTrigger>
          </TabsList>

          {/* Promotions Tab */}
          <TabsContent value="promotions" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isAddPromotionOpen} onOpenChange={setIsAddPromotionOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus size={20} />
                    Nova Promoção
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Promoção</DialogTitle>
                    <DialogDescription>
                      Crie uma promoção sazonal com período definido
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Nome da Promoção</Label>
                      <Input
                        value={promotionForm.name}
                        onChange={(e) =>
                          setPromotionForm({ ...promotionForm, name: e.target.value })
                        }
                        placeholder="Ex: Black Friday"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={promotionForm.description}
                        onChange={(e) =>
                          setPromotionForm({
                            ...promotionForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Descreva a promoção..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Desconto</Label>
                        <Select
                          value={promotionForm.discount_type}
                          onValueChange={(value) =>
                            setPromotionForm({ ...promotionForm, discount_type: value })
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
                          Valor{" "}
                          {promotionForm.discount_type === "percentage" ? "(%)" : "(R$)"}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={promotionForm.discount_value}
                          onChange={(e) =>
                            setPromotionForm({
                              ...promotionForm,
                              discount_value: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data Início</Label>
                        <Input
                          type="datetime-local"
                          value={promotionForm.start_date}
                          onChange={(e) =>
                            setPromotionForm({
                              ...promotionForm,
                              start_date: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Fim</Label>
                        <Input
                          type="datetime-local"
                          value={promotionForm.end_date}
                          onChange={(e) =>
                            setPromotionForm({
                              ...promotionForm,
                              end_date: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddPromotion} className="w-full">
                      Criar Promoção
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                Carregando...
              </div>
            ) : promotions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Percent className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma promoção</h3>
                  <p className="text-muted-foreground mb-4">
                    Crie promoções sazonais para atrair mais clientes
                  </p>
                  <Button onClick={() => setIsAddPromotionOpen(true)}>
                    Criar Promoção
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Promoção</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-32">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promotions.map((promo) => {
                      const status = getPromotionStatus(promo);
                      return (
                        <TableRow key={promo.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{promo.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {promo.description}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {promo.discount_type === "percentage"
                              ? `${promo.discount_value}%`
                              : `R$ ${promo.discount_value}`}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>
                                {format(new Date(promo.start_date), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })}
                              </p>
                              <p className="text-muted-foreground">
                                até{" "}
                                {format(new Date(promo.end_date), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={promo.is_active}
                                onCheckedChange={() => handleTogglePromotionActive(promo)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingPromotion(promo);
                                  setPromotionForm({
                                    name: promo.name,
                                    description: promo.description || "",
                                    discount_type: promo.discount_type,
                                    discount_value: promo.discount_value,
                                    start_date: promo.start_date.slice(0, 16),
                                    end_date: promo.end_date.slice(0, 16),
                                  });
                                }}
                              >
                                <Edit size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => handleDeletePromotion(promo.id)}
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

          {/* Coupons Tab */}
          <TabsContent value="coupons" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isAddCouponOpen} onOpenChange={setIsAddCouponOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus size={20} />
                    Novo Cupom
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Cupom de Desconto</DialogTitle>
                    <DialogDescription>
                      Crie um código de desconto para seus clientes
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
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
                          placeholder="Ex: DESCONTO10"
                          className="uppercase"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generateRandomCode}
                        >
                          Gerar
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={couponForm.description}
                        onChange={(e) =>
                          setCouponForm({
                            ...couponForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Descrição do cupom..."
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
                          Valor{" "}
                          {couponForm.discount_type === "percentage" ? "(%)" : "(R$)"}
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Máximo de Usos (opcional)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={couponForm.max_uses}
                          onChange={(e) =>
                            setCouponForm({ ...couponForm, max_uses: e.target.value })
                          }
                          placeholder="Ilimitado"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor Mínimo (opcional)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={couponForm.min_purchase_value}
                          onChange={(e) =>
                            setCouponForm({
                              ...couponForm,
                              min_purchase_value: e.target.value,
                            })
                          }
                          placeholder="R$ 0,00"
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

            {coupons.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum cupom</h3>
                  <p className="text-muted-foreground mb-4">
                    Crie cupons de desconto para seus clientes
                  </p>
                  <Button onClick={() => setIsAddCouponOpen(true)}>Criar Cupom</Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Usos</TableHead>
                      <TableHead>Validade</TableHead>
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
                              <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
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
                            {coupon.discount_type === "percentage"
                              ? `${coupon.discount_value}%`
                              : `R$ ${coupon.discount_value}`}
                          </TableCell>
                          <TableCell>
                            {coupon.current_uses}
                            {coupon.max_uses ? `/${coupon.max_uses}` : ""}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {coupon.valid_until ? (
                                <>
                                  até{" "}
                                  {format(new Date(coupon.valid_until), "dd/MM/yyyy", {
                                    locale: ptBR,
                                  })}
                                </>
                              ) : (
                                "Sem validade"
                              )}
                            </div>
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
                                    description: coupon.description || "",
                                    discount_type: coupon.discount_type,
                                    discount_value: coupon.discount_value,
                                    max_uses: coupon.max_uses?.toString() || "",
                                    min_purchase_value:
                                      coupon.min_purchase_value?.toString() || "",
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
        </Tabs>

        {/* Edit Promotion Dialog */}
        <Dialog
          open={!!editingPromotion}
          onOpenChange={(open) => !open && setEditingPromotion(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Promoção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome da Promoção</Label>
                <Input
                  value={promotionForm.name}
                  onChange={(e) =>
                    setPromotionForm({ ...promotionForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={promotionForm.description}
                  onChange={(e) =>
                    setPromotionForm({ ...promotionForm, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Desconto</Label>
                  <Select
                    value={promotionForm.discount_type}
                    onValueChange={(value) =>
                      setPromotionForm({ ...promotionForm, discount_type: value })
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
                    value={promotionForm.discount_value}
                    onChange={(e) =>
                      setPromotionForm({
                        ...promotionForm,
                        discount_value: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="datetime-local"
                    value={promotionForm.start_date}
                    onChange={(e) =>
                      setPromotionForm({ ...promotionForm, start_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="datetime-local"
                    value={promotionForm.end_date}
                    onChange={(e) =>
                      setPromotionForm({ ...promotionForm, end_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button onClick={handleUpdatePromotion} className="w-full">
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Coupon Dialog */}
        <Dialog
          open={!!editingCoupon}
          onOpenChange={(open) => !open && setEditingCoupon(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Cupom</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Máximo de Usos</Label>
                  <Input
                    type="number"
                    min={1}
                    value={couponForm.max_uses}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, max_uses: e.target.value })
                    }
                    placeholder="Ilimitado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Mínimo</Label>
                  <Input
                    type="number"
                    min={0}
                    value={couponForm.min_purchase_value}
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        min_purchase_value: e.target.value,
                      })
                    }
                    placeholder="R$ 0,00"
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
    </DashboardLayout>
  );
}
