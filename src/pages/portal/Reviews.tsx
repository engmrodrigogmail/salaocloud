import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Settings as SettingsIcon, History, BarChart3, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ReviewSettings = {
  id?: string;
  establishment_id: string;
  reviews_enabled: boolean;
  show_professional_ratings: boolean;
  show_comments_on_dashboard: boolean;
  show_numeric_rating: boolean;
  google_business_url: string | null;
  reward_enabled: boolean;
  reward_discount_type: "percentage" | "fixed";
  reward_discount_value: number;
  reward_target: "total" | "service" | "product";
  reward_target_service_id: string | null;
  reward_target_product_id: string | null;
  reward_deduct_from_commission: boolean;
  reward_description: string | null;
  reward_coupon_validity_days: number;
};

const DEFAULTS: Omit<ReviewSettings, "establishment_id"> = {
  reviews_enabled: false,
  show_professional_ratings: true,
  show_comments_on_dashboard: true,
  show_numeric_rating: true,
  google_business_url: "",
  reward_enabled: false,
  reward_discount_type: "percentage",
  reward_discount_value: 0,
  reward_target: "total",
  reward_target_service_id: null,
  reward_target_product_id: null,
  reward_deduct_from_commission: false,
  reward_description: "",
  reward_coupon_validity_days: 30,
};

export default function PortalReviews() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [estId, setEstId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ReviewSettings | null>(null);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [discountValueStr, setDiscountValueStr] = useState("0");
  const [validityDaysStr, setValidityDaysStr] = useState("30");

  useEffect(() => {
    (async () => {
      if (!slug) return;
      setLoading(true);
      const { data: est } = await supabase
        .from("establishments")
        .select("id")
        .eq("slug", slug)
        .single();
      if (!est) {
        setLoading(false);
        return;
      }
      setEstId(est.id);

      const [{ data: rs }, { data: srv }, { data: prd }] = await Promise.all([
        supabase.from("review_settings").select("*").eq("establishment_id", est.id).maybeSingle(),
        supabase.from("services").select("id, name").eq("establishment_id", est.id).eq("is_active", true).order("name"),
        supabase.from("products").select("id, name").eq("establishment_id", est.id).eq("is_active", true).order("name"),
      ]);

      const merged: ReviewSettings = rs
        ? (rs as ReviewSettings)
        : { establishment_id: est.id, ...DEFAULTS };
      setSettings(merged);
      setDiscountValueStr(String(merged.reward_discount_value ?? 0));
      setValidityDaysStr(String(merged.reward_coupon_validity_days ?? 30));
      setServices(srv ?? []);
      setProducts(prd ?? []);
      setLoading(false);
    })();
  }, [slug]);

  const update = (patch: Partial<ReviewSettings>) =>
    setSettings((s) => (s ? { ...s, ...patch } : s));

  const save = async () => {
    if (!settings || !estId) return;
    setSaving(true);
    const payload = {
      ...settings,
      establishment_id: estId,
      reward_discount_value: parseFloat(discountValueStr.replace(",", ".")) || 0,
      reward_coupon_validity_days: Math.max(1, parseInt(validityDaysStr || "30", 10) || 30),
    };
    const { error } = await supabase
      .from("review_settings")
      .upsert(payload, { onConflict: "establishment_id" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message, { position: "top-center", duration: 2000 });
      return;
    }
    toast.success("Configurações salvas", { position: "top-center", duration: 2000 });
  };

  return (
    <PortalLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-5xl">
        <div className="flex items-center gap-3">
          <Star className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Avaliações</h1>
            <p className="text-muted-foreground text-sm">
              Configure, acompanhe e visualize as avaliações dos seus clientes.
            </p>
          </div>
        </div>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <SettingsIcon className="h-4 w-4" /> <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" /> <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Dashboard de Avaliações</CardTitle>
                <CardDescription>Métricas, distribuição de notas e desempenho por profissional.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Em breve (Fase 3). Habilite as avaliações em "Configurações" para começar a coletar dados.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Avaliações</CardTitle>
                <CardDescription>Lista completa com filtros por período, profissional e nota.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Em breve (Fase 3).</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="mt-4 space-y-4">
            {loading || !settings ? (
              <Card>
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Visibilidade & Funcionamento</CardTitle>
                    <CardDescription>
                      Ative o sistema e escolha o que aparece para sua equipe.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ToggleRow
                      label="Habilitar sistema de avaliações"
                      description="Quando ativo, ao fechar uma comanda o cliente recebe um pedido de avaliação."
                      checked={settings.reviews_enabled}
                      onChange={(v) => update({ reviews_enabled: v })}
                    />
                    <ToggleRow
                      label="Mostrar avaliações dos profissionais"
                      description="Exibe a nota individual de cada profissional no dashboard."
                      checked={settings.show_professional_ratings}
                      onChange={(v) => update({ show_professional_ratings: v })}
                    />
                    <ToggleRow
                      label="Mostrar comentários no dashboard"
                      checked={settings.show_comments_on_dashboard}
                      onChange={(v) => update({ show_comments_on_dashboard: v })}
                    />
                    <ToggleRow
                      label="Mostrar nota numérica no dashboard"
                      checked={settings.show_numeric_rating}
                      onChange={(v) => update({ show_numeric_rating: v })}
                    />
                    <div className="space-y-1.5">
                      <Label>Link do Google Meu Negócio</Label>
                      <Input
                        placeholder="https://g.page/r/..."
                        value={settings.google_business_url ?? ""}
                        onChange={(e) => update({ google_business_url: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Quando o cliente avaliar com 5 estrelas, será convidado a deixar uma avaliação no Google.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recompensa por Avaliação</CardTitle>
                    <CardDescription>
                      Gere automaticamente um cupom de desconto quando o cliente preencher a avaliação.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ToggleRow
                      label="Habilitar recompensa"
                      checked={settings.reward_enabled}
                      onChange={(v) => update({ reward_enabled: v })}
                    />

                    {settings.reward_enabled && (
                      <div className="space-y-4 border-l-2 border-primary/30 pl-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label>Tipo de desconto</Label>
                            <Select
                              value={settings.reward_discount_type}
                              onValueChange={(v: "percentage" | "fixed") =>
                                update({ reward_discount_type: v })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">Percentual (%)</SelectItem>
                                <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>
                              Valor do desconto {settings.reward_discount_type === "percentage" ? "(%)" : "(R$)"}
                            </Label>
                            <Input
                              inputMode="decimal"
                              value={discountValueStr}
                              onChange={(e) => setDiscountValueStr(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Aplicação do desconto</Label>
                          <Select
                            value={settings.reward_target}
                            onValueChange={(v: "total" | "service" | "product") =>
                              update({
                                reward_target: v,
                                reward_target_service_id: v === "service" ? settings.reward_target_service_id : null,
                                reward_target_product_id: v === "product" ? settings.reward_target_product_id : null,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="total">Sobre o total da próxima comanda</SelectItem>
                              <SelectItem value="service">Sobre um serviço específico</SelectItem>
                              <SelectItem value="product">Sobre um produto específico</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {settings.reward_target === "service" && (
                          <div className="space-y-1.5">
                            <Label>Serviço alvo</Label>
                            <Select
                              value={settings.reward_target_service_id ?? ""}
                              onValueChange={(v) => update({ reward_target_service_id: v || null })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o serviço" />
                              </SelectTrigger>
                              <SelectContent>
                                {services.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {settings.reward_target === "product" && (
                          <div className="space-y-1.5">
                            <Label>Produto alvo</Label>
                            <Select
                              value={settings.reward_target_product_id ?? ""}
                              onValueChange={(v) => update({ reward_target_product_id: v || null })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o produto" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <ToggleRow
                          label="Descontar este benefício da comissão do profissional"
                          description="Se ativo, a comissão do profissional será calculada após o desconto da recompensa."
                          checked={settings.reward_deduct_from_commission}
                          onChange={(v) => update({ reward_deduct_from_commission: v })}
                        />

                        <div className="space-y-1.5">
                          <Label>Descrição do benefício</Label>
                          <Textarea
                            placeholder='Ex.: "5% de desconto na hidratação"'
                            value={settings.reward_description ?? ""}
                            onChange={(e) => update({ reward_description: e.target.value })}
                            maxLength={200}
                            rows={2}
                          />
                          <p className="text-xs text-muted-foreground">
                            Aparece na notificação enviada ao cliente.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Validade do cupom (dias)</Label>
                          <Input
                            inputMode="numeric"
                            value={validityDaysStr}
                            onChange={(e) => setValidityDaysStr(e.target.value.replace(/\D/g, ""))}
                            placeholder="30"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={save} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar configurações
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
