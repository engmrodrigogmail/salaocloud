import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerEstablishment } from "@/hooks/useOwnerEstablishment";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, Save, Loader2, Users, Settings, CalendarDays, Eye, ShieldCheck, Bell } from "lucide-react";
import { NotificationSettingsCard } from "@/components/notifications/NotificationSettingsCard";
import type { Tables, Json } from "@/integrations/supabase/types";

import { QRCodeCard } from "@/components/booking/QRCodeCard";

type Establishment = Tables<"establishments"> & {
  show_professional_names?: boolean | null;
  show_prices?: boolean | null;
  show_service_duration?: boolean | null;
};

interface WorkingHoursDay {
  open: string;
  close: string;
  enabled: boolean;
}

interface WorkingHours {
  [key: string]: WorkingHoursDay;
}

const DEFAULT_WORKING_HOURS: WorkingHours = {
  "0": { open: "09:00", close: "18:00", enabled: false },
  "1": { open: "09:00", close: "20:00", enabled: true },
  "2": { open: "09:00", close: "20:00", enabled: true },
  "3": { open: "09:00", close: "20:00", enabled: true },
  "4": { open: "09:00", close: "20:00", enabled: true },
  "5": { open: "09:00", close: "20:00", enabled: true },
  "6": { open: "09:00", close: "18:00", enabled: true },
};

const DAY_NAMES: Record<string, string> = {
  "0": "Domingo",
  "1": "Segunda-feira",
  "2": "Terça-feira",
  "3": "Quarta-feira",
  "4": "Quinta-feira",
  "5": "Sexta-feira",
  "6": "Sábado",
};

export default function PortalSettings() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const { guard } = useOwnerEstablishment(slug);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [agendaSlotInterval, setAgendaSlotInterval] = useState(30);
  const [agendaExpandHours, setAgendaExpandHours] = useState(1);
  const [noShowAutoDetect, setNoShowAutoDetect] = useState(true);
  const [noShowToleranceMinutes, setNoShowToleranceMinutes] = useState(30);
  const [showProfessionalNames, setShowProfessionalNames] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showServiceDuration, setShowServiceDuration] = useState(true);
  const [savingPortal, setSavingPortal] = useState(false);
  const [discountPinThreshold, setDiscountPinThreshold] = useState("10");
  const [savingCheckout, setSavingCheckout] = useState(false);
  const [activeTab, setActiveTab] = useState("working-hours");

  useEffect(() => {
    if (user && slug) {
      fetchEstablishment();
    }
  }, [user, slug]);

  const fetchEstablishment = async () => {
    try {
      const { data, error } = await supabase
        .from("establishments")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw error;

      setEstablishment(data);
      
      // Parse working hours
      if (data.working_hours) {
        const wh = data.working_hours as unknown;
        if (typeof wh === "object" && wh !== null) {
          setWorkingHours({ ...DEFAULT_WORKING_HOURS, ...(wh as WorkingHours) });
        }
      }
      
      // Set agenda settings
      if (data.agenda_slot_interval) setAgendaSlotInterval(data.agenda_slot_interval);
      if (data.agenda_expand_hours) setAgendaExpandHours(data.agenda_expand_hours);
      const anyData = data as any;
      if (typeof anyData.no_show_auto_detect === "boolean") setNoShowAutoDetect(anyData.no_show_auto_detect);
      if (typeof anyData.no_show_tolerance_minutes === "number") setNoShowToleranceMinutes(anyData.no_show_tolerance_minutes);

      // Portal display toggles (default to true if not set)
      const portalData = data as Establishment;
      setShowProfessionalNames(portalData.show_professional_names !== false);
      setShowPrices(portalData.show_prices !== false);
      setShowServiceDuration(portalData.show_service_duration !== false);

      // Discount PIN threshold (default 10%)
      const threshold = (data as any).discount_pin_threshold_percent;
      setDiscountPinThreshold(
        threshold === null || threshold === undefined ? "10" : String(threshold),
      );
    } catch (error) {
      console.error("Error fetching establishment:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleWorkingHoursChange = (day: string, field: keyof WorkingHoursDay, value: string | boolean) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleSaveWorkingHours = async () => {
    if (!establishment) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("establishments")
        .update({ working_hours: workingHours as unknown as Json })
        .eq("id", establishment.id);

      if (error) throw error;
      
      toast.success("Horário de funcionamento atualizado!");
    } catch (error) {
      console.error("Error saving working hours:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAgendaSettings = async () => {
    if (!establishment) return;
    
    setSavingAgenda(true);
    try {
      const { error } = await supabase
        .from("establishments")
        .update({ 
          agenda_slot_interval: agendaSlotInterval,
          agenda_expand_hours: agendaExpandHours,
          no_show_auto_detect: noShowAutoDetect,
          no_show_tolerance_minutes: noShowToleranceMinutes,
        } as any)
        .eq("id", establishment.id);

      if (error) throw error;
      
      toast.success("Configurações da agenda atualizadas!");
    } catch (error) {
      console.error("Error saving agenda settings:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSavingAgenda(false);
    }
  };

  const handleSavePortalSettings = async () => {
    if (!establishment) return;
    setSavingPortal(true);
    try {
      const { error } = await supabase
        .from("establishments")
        .update({
          show_professional_names: showProfessionalNames,
          show_prices: showPrices,
          show_service_duration: showServiceDuration,
        } as never)
        .eq("id", establishment.id);
      if (error) throw error;
      toast.success("Configurações do portal atualizadas!");
    } catch (error) {
      console.error("Error saving portal settings:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSavingPortal(false);
    }
  };

  const handleSaveCheckoutSettings = async () => {
    if (!establishment) return;
    const parsed = parseFloat(discountPinThreshold.replace(",", "."));
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      toast.error("Informe um percentual entre 0 e 100");
      return;
    }
    setSavingCheckout(true);
    try {
      const { error } = await supabase
        .from("establishments")
        .update({ discount_pin_threshold_percent: parsed } as never)
        .eq("id", establishment.id);
      if (error) throw error;
      toast.success("Limite de desconto atualizado!");
    } catch (e) {
      console.error("Error saving checkout settings:", e);
      toast.error("Erro ao salvar");
    } finally {
      setSavingCheckout(false);
    }
  };

  if (authLoading || loading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </PortalLayout>
    );
  }

  const SECTIONS = [
    { value: "working-hours", label: "Horário de Funcionamento", icon: Clock },
    { value: "agenda-settings", label: "Visualização da Agenda", icon: CalendarDays },
    { value: "client-portal", label: "Portal da Cliente", icon: Eye },
    { value: "checkout", label: "Caixa & Comandas", icon: ShieldCheck },
    { value: "notifications", label: "Notificações", icon: Bell },
  ];


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
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Personalize seu estabelecimento e a experiência das suas clientes
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Mobile: Select dropdown */}
          <div className="md:hidden mb-4">
            <Label htmlFor="settings-section" className="text-xs text-muted-foreground mb-1.5 block">
              Seção
            </Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger id="settings-section" className="w-full h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map(({ value, label, icon: Icon }) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop: Grid tabs (no horizontal scroll) */}
          <TabsList className="hidden md:grid md:grid-cols-4 mb-6 h-auto p-1 w-full">
            {SECTIONS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-2 py-2.5 text-xs lg:text-sm whitespace-normal text-center"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="working-hours">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Horário de Funcionamento
                </CardTitle>
                <CardDescription>
                  Configure os dias e horários em que seu estabelecimento está aberto para agendamentos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(DAY_NAMES).map(([key, name]) => (
                  <div 
                    key={key} 
                    className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border transition-colors ${
                      workingHours[key]?.enabled 
                        ? "bg-primary/5 border-primary/20" 
                        : "bg-muted/50 border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <Switch
                        checked={workingHours[key]?.enabled || false}
                        onCheckedChange={(checked) => handleWorkingHoursChange(key, "enabled", checked)}
                      />
                      <Label className={`font-medium ${!workingHours[key]?.enabled ? "text-muted-foreground" : ""}`}>
                        {name}
                      </Label>
                    </div>
                    
                    {workingHours[key]?.enabled && (
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">Abre às</Label>
                          <Input
                            type="time"
                            value={workingHours[key]?.open || "09:00"}
                            onChange={(e) => handleWorkingHoursChange(key, "open", e.target.value)}
                            className="w-28"
                          />
                        </div>
                        <span className="text-muted-foreground">—</span>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">Fecha às</Label>
                          <Input
                            type="time"
                            value={workingHours[key]?.close || "20:00"}
                            onChange={(e) => handleWorkingHoursChange(key, "close", e.target.value)}
                            className="w-28"
                          />
                        </div>
                      </div>
                    )}
                    
                    {!workingHours[key]?.enabled && (
                      <span className="text-sm text-muted-foreground italic">Fechado</span>
                    )}
                  </div>
                ))}

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveWorkingHours} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Horários
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agenda-settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Visualização da Agenda
                </CardTitle>
                <CardDescription>
                  Configure como os slots de tempo são exibidos na agenda
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="slot-interval">Intervalo entre slots</Label>
                    <Select value={agendaSlotInterval.toString()} onValueChange={(v) => setAgendaSlotInterval(parseInt(v))}>
                      <SelectTrigger id="slot-interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutos</SelectItem>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="60">60 minutos</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Define o intervalo de tempo entre cada linha da agenda
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expand-hours">Horas extras (expandir)</Label>
                    <Select value={agendaExpandHours.toString()} onValueChange={(v) => setAgendaExpandHours(parseInt(v))}>
                      <SelectTrigger id="expand-hours">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sem expansão</SelectItem>
                        <SelectItem value="1">±1 hora</SelectItem>
                        <SelectItem value="2">±2 horas</SelectItem>
                        <SelectItem value="3">±3 horas</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Horas antes/depois do expediente ao expandir a agenda
                    </p>
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Detecção automática de "Não compareceu"</h3>
                    <p className="text-xs text-muted-foreground">
                      Marca automaticamente como falta agendamentos cuja hora de início + tolerância já passou.
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="no-show-auto" className="cursor-pointer">Ativar detecção automática</Label>
                    <Switch id="no-show-auto" checked={noShowAutoDetect} onCheckedChange={setNoShowAutoDetect} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="no-show-tolerance">Tolerância (minutos após o horário)</Label>
                    <Select
                      value={noShowToleranceMinutes.toString()}
                      onValueChange={(v) => setNoShowToleranceMinutes(parseInt(v))}
                      disabled={!noShowAutoDetect}
                    >
                      <SelectTrigger id="no-show-tolerance">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 minutos</SelectItem>
                        <SelectItem value="15">15 minutos</SelectItem>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="45">45 minutos</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="90">1h30</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Após esse tempo sem ser concluído ou em atendimento, o sistema marca como "Não compareceu".
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveAgendaSettings} disabled={savingAgenda}>
                    {savingAgenda ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Configurações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="client-portal" className="space-y-6">
            {establishment && (
              <QRCodeCard slug={establishment.slug} establishmentName={establishment.name} />
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Exibição na Página de Agendamento
                </CardTitle>
                <CardDescription>
                  Controle quais informações suas clientes veem ao agendar online.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    id: "show-prof",
                    label: "Exibir nome dos profissionais",
                    description: "Quando desligado, o sistema escolhe o profissional automaticamente.",
                    checked: showProfessionalNames,
                    setter: setShowProfessionalNames,
                  },
                  {
                    id: "show-prices",
                    label: "Exibir preços dos serviços",
                    description: "Quando desligado, será mostrado \"Preço sob consulta\".",
                    checked: showPrices,
                    setter: setShowPrices,
                  },
                  {
                    id: "show-duration",
                    label: "Exibir duração dos serviços",
                    description: "Quando desligado, oculta os minutos/horas no card do serviço.",
                    checked: showServiceDuration,
                    setter: setShowServiceDuration,
                  },
                ].map(({ id, label, description, checked, setter }) => (
                  <div
                    key={id}
                    className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4"
                  >
                    <div className="space-y-0.5">
                      <Label htmlFor={id} className="text-base">{label}</Label>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <Switch id={id} checked={checked} onCheckedChange={setter} />
                  </div>
                ))}

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSavePortalSettings} disabled={savingPortal}>
                    {savingPortal ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Preferências
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checkout" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Limite de desconto sem PIN
                </CardTitle>
                <CardDescription>
                  Descontos manuais aplicados na comanda ou no caixa até este percentual
                  do total não pedem autorização. Acima disso, será exigido o PIN de um
                  gerente. Cupons e fidelidade não passam por essa regra (já são
                  pré-aprovados).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-sm">
                <div className="space-y-2">
                  <Label htmlFor="discount-pin-threshold">Percentual livre (%)</Label>
                  <Input
                    id="discount-pin-threshold"
                    type="text"
                    inputMode="decimal"
                    value={discountPinThreshold}
                    onChange={(e) =>
                      setDiscountPinThreshold(
                        e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."),
                      )
                    }
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex.: 10 = qualquer desconto manual de até 10% é aplicado direto.
                    Acima disso, exige PIN. Use 0 para exigir PIN em todo desconto manual.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveCheckoutSettings} disabled={savingCheckout}>
                    {savingCheckout ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
