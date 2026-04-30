import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
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
  DialogFooter,
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
import { Plus, Edit, Trash2, Copy, Tag, Users, TrendingUp, Ticket, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerEstablishment } from "@/hooks/useOwnerEstablishment";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  discount_target: string;
  applicable_service_ids: string[];
  applicable_product_ids: string[];
  calculate_commission_after_discount: boolean;
  max_uses: number | null;
  current_uses: number;
  min_purchase_value: number | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

interface Service {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

interface CouponUsage {
  id: string;
  coupon_id: string;
  client_id: string | null;
  appointment_id: string | null;
  used_at: string;
  client_name?: string;
}

export default function PortalCoupons() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { guard } = useOwnerEstablishment(slug);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [usages, setUsages] = useState<CouponUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [selectedCouponForUsages, setSelectedCouponForUsages] = useState<string | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [couponForm, setCouponForm] = useState({
    code: "",
    description: "",
    discount_type: "percentage",
    discount_value: 10,
    discount_target: "total",
    applicable_service_ids: [] as string[],
    applicable_product_ids: [] as string[],
    calculate_commission_after_discount: true,
    max_uses: "",
    min_purchase_value: "",
    valid_from: "",
    valid_until: "",
  });

  useEffect(() => {
    if (slug) {
      fetchEstablishment();
    }
  }, [slug]);

  useEffect(() => {
    if (establishmentId) {
      fetchCoupons();
      fetchServices();
      fetchProducts();
    }
  }, [establishmentId]);

  const fetchServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("id, name")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .order("name");
    if (data) setServices(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .order("name");
    if (data) setProducts(data);
  };

  const fetchEstablishment = async () => {
    const { data } = await supabase
      .from("establishments")
      .select("id")
      .eq("slug", slug)
      .single();

    if (data) {
      setEstablishmentId(data.id);
    }
  };

  const fetchCoupons = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("discount_coupons")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false });

    if (!error) {
      setCoupons(data || []);
    }
    setLoading(false);
  };

  const fetchUsages = async (couponId: string) => {
    const { data, error } = await supabase
      .from("coupon_usage")
      .select(`
        *,
        clients(name)
      `)
      .eq("coupon_id", couponId)
      .order("used_at", { ascending: false });

    if (!error && data) {
      setUsages(
        data.map((u: any) => ({
          ...u,
          client_name: u.clients?.name || "Cliente não identificado",
        }))
      );
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
        discount_target: couponForm.discount_target,
        applicable_service_ids: couponForm.applicable_service_ids,
        applicable_product_ids: couponForm.applicable_product_ids,
        calculate_commission_after_discount: couponForm.calculate_commission_after_discount,
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
        discount_target: couponForm.discount_target,
        applicable_service_ids: couponForm.applicable_service_ids,
        applicable_product_ids: couponForm.applicable_product_ids,
        calculate_commission_after_discount: couponForm.calculate_commission_after_discount,
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

  const resetCouponForm = () => {
    setCouponForm({
      code: "",
      description: "",
      discount_type: "percentage",
      discount_value: 10,
      discount_target: "total",
      applicable_service_ids: [],
      applicable_product_ids: [],
      calculate_commission_after_discount: true,
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

  const startEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_target: coupon.discount_target || "total",
      applicable_service_ids: coupon.applicable_service_ids || [],
      applicable_product_ids: coupon.applicable_product_ids || [],
      calculate_commission_after_discount: coupon.calculate_commission_after_discount ?? true,
      max_uses: coupon.max_uses?.toString() || "",
      min_purchase_value: coupon.min_purchase_value?.toString() || "",
      valid_from: coupon.valid_from ? coupon.valid_from.slice(0, 16) : "",
      valid_until: coupon.valid_until ? coupon.valid_until.slice(0, 16) : "",
    });
  };

  const stats = {
    totalCoupons: coupons.length,
    activeCoupons: coupons.filter((c) => c.is_active).length,
    totalUses: coupons.reduce((acc, c) => acc + c.current_uses, 0),
  };

  if (guard) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Cupons de Desconto</h1>
            <p className="text-muted-foreground">
              Crie e gerencie cupons para seus clientes utilizarem nas comandas
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
                <DialogTitle>Novo Cupom</DialogTitle>
                <DialogDescription>
                  Crie um cupom de desconto para seus clientes
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
                      placeholder="Ex: DESCONTO10"
                      className="uppercase"
                    />
                    <Button type="button" variant="outline" onClick={generateRandomCode}>
                      Gerar
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
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
                
                {/* Discount Target Section */}
                <div className="space-y-2">
                  <Label>Aplicar desconto sobre</Label>
                  <Select
                    value={couponForm.discount_target}
                    onValueChange={(value) =>
                      setCouponForm({ 
                        ...couponForm, 
                        discount_target: value,
                        applicable_service_ids: [],
                        applicable_product_ids: []
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total da Comanda</SelectItem>
                      <SelectItem value="services">Serviços</SelectItem>
                      <SelectItem value="products">Produtos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {couponForm.discount_target === "services" && (
                  <div className="space-y-2">
                    <Label>Serviços Aplicáveis</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
                      {services.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado</p>
                      ) : (
                        services.map((service) => (
                          <div key={service.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`service-${service.id}`}
                              checked={couponForm.applicable_service_ids.includes(service.id)}
                              onCheckedChange={(checked) => {
                                const newIds = checked
                                  ? [...couponForm.applicable_service_ids, service.id]
                                  : couponForm.applicable_service_ids.filter(id => id !== service.id);
                                setCouponForm({ ...couponForm, applicable_service_ids: newIds });
                              }}
                            />
                            <Label htmlFor={`service-${service.id}`} className="font-normal text-sm">
                              {service.name}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Deixe vazio para aplicar a todos os serviços
                    </p>
                  </div>
                )}

                {couponForm.discount_target === "products" && (
                  <div className="space-y-2">
                    <Label>Produtos Aplicáveis</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
                      {products.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum produto cadastrado</p>
                      ) : (
                        products.map((product) => (
                          <div key={product.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`product-${product.id}`}
                              checked={couponForm.applicable_product_ids.includes(product.id)}
                              onCheckedChange={(checked) => {
                                const newIds = checked
                                  ? [...couponForm.applicable_product_ids, product.id]
                                  : couponForm.applicable_product_ids.filter(id => id !== product.id);
                                setCouponForm({ ...couponForm, applicable_product_ids: newIds });
                              }}
                            />
                            <Label htmlFor={`product-${product.id}`} className="font-normal text-sm">
                              {product.name}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Deixe vazio para aplicar a todos os produtos
                    </p>
                  </div>
                )}

                {/* Commission calculation option */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label className="text-sm">Calcular comissão após desconto</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {couponForm.calculate_commission_after_discount 
                        ? "A comissão será calculada sobre o valor com desconto"
                        : "A comissão será calculada sobre o valor original"}
                    </p>
                  </div>
                  <Switch
                    checked={couponForm.calculate_commission_after_discount}
                    onCheckedChange={(checked) =>
                      setCouponForm({ ...couponForm, calculate_commission_after_discount: checked })
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
                    <Label>Valor Mínimo (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={couponForm.min_purchase_value}
                      onChange={(e) =>
                        setCouponForm({ ...couponForm, min_purchase_value: e.target.value })
                      }
                      placeholder="Sem mínimo"
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
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsAddCouponOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddCoupon} disabled={!couponForm.code}>
                  Criar Cupom
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Ticket className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Cupons</p>
                  <p className="text-2xl font-bold">{stats.totalCoupons}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Tag className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cupons Ativos</p>
                  <p className="text-2xl font-bold">{stats.activeCoupons}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Usos</p>
                  <p className="text-2xl font-bold">{stats.totalUses}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="coupons" className="space-y-4">
          <TabsList>
            <TabsTrigger value="coupons">Cupons</TabsTrigger>
            <TabsTrigger value="history">Histórico de Uso</TabsTrigger>
          </TabsList>

          <TabsContent value="coupons">
            <Card>
              <CardHeader>
                <CardTitle>Seus Cupons</CardTitle>
                <CardDescription>
                  Cupons que seus clientes podem usar para obter descontos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando cupons...
                  </div>
                ) : coupons.length === 0 ? (
                  <div className="text-center py-8">
                    <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Nenhum cupom criado ainda</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setIsAddCouponOpen(true)}
                    >
                      <Plus size={16} className="mr-2" />
                      Criar primeiro cupom
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Desconto</TableHead>
                          <TableHead>Usos</TableHead>
                          <TableHead>Validade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coupons.map((coupon) => {
                          const status = getCouponStatus(coupon);
                          return (
                            <TableRow key={coupon.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <code className="font-mono font-bold text-sm bg-muted px-2 py-1 rounded">
                                    {coupon.code}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => copyToClipboard(coupon.code)}
                                  >
                                    <Copy size={12} />
                                  </Button>
                                </div>
                                {coupon.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {coupon.description}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">
                                  {coupon.discount_type === "percentage"
                                    ? `${coupon.discount_value}%`
                                    : `R$ ${coupon.discount_value.toFixed(2)}`}
                                </span>
                                {coupon.min_purchase_value && (
                                  <p className="text-xs text-muted-foreground">
                                    Mín: R$ {coupon.min_purchase_value.toFixed(2)}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <span>
                                  {coupon.current_uses}
                                  {coupon.max_uses && ` / ${coupon.max_uses}`}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">
                                {coupon.valid_until ? (
                                  <span>
                                    até{" "}
                                    {format(new Date(coupon.valid_until), "dd/MM/yy", {
                                      locale: ptBR,
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Sem expiração</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={status.variant}>{status.label}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Switch
                                    checked={coupon.is_active}
                                    onCheckedChange={() => handleToggleCouponActive(coupon)}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startEdit(coupon)}
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
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Uso</CardTitle>
                <CardDescription>
                  Veja quando e por quem seus cupons foram utilizados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label>Selecione um cupom:</Label>
                    <Select
                      value={selectedCouponForUsages || ""}
                      onValueChange={(value) => {
                        setSelectedCouponForUsages(value);
                        fetchUsages(value);
                      }}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Escolher cupom" />
                      </SelectTrigger>
                      <SelectContent>
                        {coupons.map((coupon) => (
                          <SelectItem key={coupon.id} value={coupon.id}>
                            {coupon.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCouponForUsages && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data de Uso</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usages.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground">
                              Nenhum uso registrado para este cupom
                            </TableCell>
                          </TableRow>
                        ) : (
                          usages.map((usage) => (
                            <TableRow key={usage.id}>
                              <TableCell>{usage.client_name}</TableCell>
                              <TableCell>
                                {format(new Date(usage.used_at), "dd/MM/yyyy 'às' HH:mm", {
                                  locale: ptBR,
                                })}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={!!editingCoupon} onOpenChange={(open) => !open && setEditingCoupon(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Cupom</DialogTitle>
              <DialogDescription>
                Atualize as informações do cupom
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-2">
                <Label>Código do Cupom</Label>
                <Input
                  value={couponForm.code}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
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
              
              {/* Discount Target Section */}
              <div className="space-y-2">
                <Label>Aplicar desconto sobre</Label>
                <Select
                  value={couponForm.discount_target}
                  onValueChange={(value) =>
                    setCouponForm({ 
                      ...couponForm, 
                      discount_target: value,
                      applicable_service_ids: [],
                      applicable_product_ids: []
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total da Comanda</SelectItem>
                    <SelectItem value="services">Serviços</SelectItem>
                    <SelectItem value="products">Produtos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {couponForm.discount_target === "services" && (
                <div className="space-y-2">
                  <Label>Serviços Aplicáveis</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
                    {services.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado</p>
                    ) : (
                      services.map((service) => (
                        <div key={service.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-service-${service.id}`}
                            checked={couponForm.applicable_service_ids.includes(service.id)}
                            onCheckedChange={(checked) => {
                              const newIds = checked
                                ? [...couponForm.applicable_service_ids, service.id]
                                : couponForm.applicable_service_ids.filter(id => id !== service.id);
                              setCouponForm({ ...couponForm, applicable_service_ids: newIds });
                            }}
                          />
                          <Label htmlFor={`edit-service-${service.id}`} className="font-normal text-sm">
                            {service.name}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para aplicar a todos os serviços
                  </p>
                </div>
              )}

              {couponForm.discount_target === "products" && (
                <div className="space-y-2">
                  <Label>Produtos Aplicáveis</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
                    {products.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum produto cadastrado</p>
                    ) : (
                      products.map((product) => (
                        <div key={product.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-product-${product.id}`}
                            checked={couponForm.applicable_product_ids.includes(product.id)}
                            onCheckedChange={(checked) => {
                              const newIds = checked
                                ? [...couponForm.applicable_product_ids, product.id]
                                : couponForm.applicable_product_ids.filter(id => id !== product.id);
                              setCouponForm({ ...couponForm, applicable_product_ids: newIds });
                            }}
                          />
                          <Label htmlFor={`edit-product-${product.id}`} className="font-normal text-sm">
                            {product.name}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para aplicar a todos os produtos
                  </p>
                </div>
              )}

              {/* Commission calculation option */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm">Calcular comissão após desconto</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {couponForm.calculate_commission_after_discount 
                      ? "A comissão será calculada sobre o valor com desconto"
                      : "A comissão será calculada sobre o valor original"}
                  </p>
                </div>
                <Switch
                  checked={couponForm.calculate_commission_after_discount}
                  onCheckedChange={(checked) =>
                    setCouponForm({ ...couponForm, calculate_commission_after_discount: checked })
                  }
                />
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
                  <Label>Valor Mínimo (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={couponForm.min_purchase_value}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, min_purchase_value: e.target.value })
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
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setEditingCoupon(null)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateCoupon}>Salvar Alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PortalLayout>
  );
}
