import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Settings, Bell, Shield, Database, Calendar, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trialDays, setTrialDays] = useState("14");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("*")
      .order("key");

    if (error) {
      console.error("Error fetching settings:", error);
    } else {
      setSettings(data || []);
      const trialSetting = data?.find(s => s.key === "trial_days");
      if (trialSetting) {
        setTrialDays(trialSetting.value);
      }
    }
    setLoading(false);
  };

  const updateSetting = async (key: string, value: string, description?: string) => {
    setSaving(true);
    
    const existingSetting = settings.find(s => s.key === key);
    
    if (existingSetting) {
      const { error } = await supabase
        .from("platform_settings")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("id", existingSetting.id);

      if (error) {
        toast.error("Erro ao salvar configuração");
        console.error(error);
      } else {
        toast.success("Configuração salva com sucesso!");
        fetchSettings();
      }
    } else {
      const { error } = await supabase
        .from("platform_settings")
        .insert({ key, value, description: description || null });

      if (error) {
        toast.error("Erro ao criar configuração");
        console.error(error);
      } else {
        toast.success("Configuração criada com sucesso!");
        fetchSettings();
      }
    }
    
    setSaving(false);
  };

  const handleSaveTrialDays = () => {
    const days = parseInt(trialDays);
    if (isNaN(days) || days < 0 || days > 365) {
      toast.error("Dias de teste deve ser um número entre 0 e 365");
      return;
    }
    updateSetting("trial_days", trialDays, "Número de dias do período de teste gratuito");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Configure as preferências do sistema e parâmetros da plataforma
          </p>
        </div>

        <div className="grid gap-6">
          {/* Trial Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Período de Teste
              </CardTitle>
              <CardDescription>
                Configure o período de teste gratuito para novos estabelecimentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="trial-days">Dias de Teste Grátis</Label>
                  <Input
                    id="trial-days"
                    type="number"
                    min="0"
                    max="365"
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                    placeholder="14"
                  />
                  <p className="text-xs text-muted-foreground">
                    Novos estabelecimentos terão acesso completo por este período
                  </p>
                </div>
                <Button onClick={handleSaveTrialDays} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificações
              </CardTitle>
              <CardDescription>
                Configure como você deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-establishments" className="flex flex-col gap-1">
                  <span>Novos estabelecimentos</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Receber notificação quando um novo salão se cadastrar
                  </span>
                </Label>
                <Switch id="new-establishments" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="payment-issues" className="flex flex-col gap-1">
                  <span>Problemas de pagamento</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Alertas sobre pagamentos com falha
                  </span>
                </Label>
                <Switch id="payment-issues" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="weekly-report" className="flex flex-col gap-1">
                  <span>Relatório semanal</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Receber um resumo semanal por email
                  </span>
                </Label>
                <Switch id="weekly-report" />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Segurança
              </CardTitle>
              <CardDescription>
                Configurações de segurança do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="two-factor" className="flex flex-col gap-1">
                  <span>Autenticação em duas etapas</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Adicione uma camada extra de segurança
                  </span>
                </Label>
                <Switch id="two-factor" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="session-timeout" className="flex flex-col gap-1">
                  <span>Timeout de sessão</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Encerrar sessão após 30 minutos de inatividade
                  </span>
                </Label>
                <Switch id="session-timeout" defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* System */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Sistema
              </CardTitle>
              <CardDescription>
                Informações e configurações do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Versão</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Ambiente</span>
                  <span className="font-medium">Produção</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Dias de teste configurados</span>
                  <span className="font-medium">{loading ? "..." : `${trialDays} dias`}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Última atualização</span>
                  <span className="font-medium">Hoje</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
