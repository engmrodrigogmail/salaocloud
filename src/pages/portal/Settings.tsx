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
import { useAuth } from "@/contexts/AuthContext";
import { Clock, Save, Loader2, Users, Settings, Upload, X, Image, CalendarDays, Palette, Eye } from "lucide-react";
import type { Tables, Json } from "@/integrations/supabase/types";
import { ProfessionalWorkingHoursCard } from "@/components/settings/ProfessionalWorkingHoursCard";
import { BrandColorsCard } from "@/components/settings/BrandColorsCard";
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
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [agendaSlotInterval, setAgendaSlotInterval] = useState(30);
  const [agendaExpandHours, setAgendaExpandHours] = useState(1);
  const [brandColors, setBrandColors] = useState({
    primary: null as string | null,
    secondary: null as string | null,
    accent: null as string | null
  });
  const [showProfessionalNames, setShowProfessionalNames] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showServiceDuration, setShowServiceDuration] = useState(true);
  const [savingPortal, setSavingPortal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      
      // Set brand colors - need to cast since types may not be updated yet
      const estData = data as Establishment & {
        brand_primary_color?: string | null;
        brand_secondary_color?: string | null;
        brand_accent_color?: string | null;
      };
      setBrandColors({
        primary: estData.brand_primary_color || null,
        secondary: estData.brand_secondary_color || null,
        accent: estData.brand_accent_color || null
      });

      // Portal display toggles (default to true if not set)
      const portalData = data as Establishment;
      setShowProfessionalNames(portalData.show_professional_names !== false);
      setShowPrices(portalData.show_prices !== false);
      setShowServiceDuration(portalData.show_service_duration !== false);
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
          agenda_expand_hours: agendaExpandHours 
        })
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

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !establishment) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setUploadingLogo(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${establishment.id}-${Date.now()}.${fileExt}`;

      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from("establishment-logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("establishment-logos")
        .getPublicUrl(fileName);

      // Update establishment with new logo URL
      const { error: updateError } = await supabase
        .from("establishments")
        .update({ logo_url: urlData.publicUrl })
        .eq("id", establishment.id);

      if (updateError) throw updateError;

      setEstablishment({ ...establishment, logo_url: urlData.publicUrl });
      toast.success("Logo atualizado com sucesso!");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Erro ao fazer upload do logo");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!establishment) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("establishments")
        .update({ logo_url: null })
        .eq("id", establishment.id);

      if (error) throw error;

      setEstablishment({ ...establishment, logo_url: null });
      toast.success("Logo removido!");
    } catch (error) {
      console.error("Error removing logo:", error);
      toast.error("Erro ao remover logo");
    } finally {
      setSaving(false);
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
    { value: "general", label: "Geral", icon: Settings },
    { value: "working-hours", label: "Horário de Funcionamento", icon: Clock },
    { value: "professional-hours", label: "Jornada dos Profissionais", icon: Users },
    { value: "agenda-settings", label: "Visualização da Agenda", icon: CalendarDays },
    { value: "client-portal", label: "Portal da Cliente", icon: Eye },
  ];

  const [activeTab, setActiveTab] = [tabState[0], tabState[1]] as const;

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
          <TabsList className="hidden md:grid md:grid-cols-5 mb-6 h-auto p-1 w-full">
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

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5 text-primary" />
                  Logo do Estabelecimento
                </CardTitle>
                <CardDescription>
                  Adicione seu logo para personalizar a página de agendamento vista pelos seus clientes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  {/* Logo Preview */}
                  <div className="flex-shrink-0">
                    {establishment?.logo_url ? (
                      <div className="relative group">
                        <div className="w-32 h-32 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 flex items-center justify-center overflow-hidden">
                          <img
                            src={establishment.logo_url}
                            alt="Logo do estabelecimento"
                            className="max-w-full max-h-full object-contain p-2"
                          />
                        </div>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={handleRemoveLogo}
                          disabled={saving}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="logo-upload"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="w-full sm:w-auto"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {uploadingLogo ? "Enviando..." : "Enviar Logo"}
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>• Formatos aceitos: JPG, PNG, WEBP, SVG</p>
                      <p>• Tamanho máximo: 2MB</p>
                      <p>• Recomendado: imagem quadrada ou com proporção 2:1</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Brand Colors Card */}
            {establishment && (
              <BrandColorsCard
                establishmentId={establishment.id}
                logoUrl={establishment.logo_url}
                savedColors={brandColors}
                onColorsUpdate={(colors) => setBrandColors(colors)}
              />
            )}
          </TabsContent>

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

          <TabsContent value="professional-hours">
            {establishment && (
              <ProfessionalWorkingHoursCard establishmentId={establishment.id} />
            )}
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
        </Tabs>
      </div>
    </PortalLayout>
  );
}
