import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Bell, Shield, Database, UserPlus, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminSettings() {
  const [signupsEnabled, setSignupsEnabled] = useState(true);
  const [loadingSignups, setLoadingSignups] = useState(true);
  const [savingSignups, setSavingSignups] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "signups_enabled")
        .maybeSingle();
      setSignupsEnabled(data?.value !== "false");
      setLoadingSignups(false);
    })();
  }, []);

  const toggleSignups = async (next: boolean) => {
    setSavingSignups(true);
    const previous = signupsEnabled;
    setSignupsEnabled(next);
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: next ? "true" : "false", updated_at: new Date().toISOString() })
      .eq("key", "signups_enabled");
    setSavingSignups(false);

    if (error) {
      setSignupsEnabled(previous);
      toast.error("Não foi possível atualizar a configuração", {
        position: "top-center",
        duration: 2000,
      });
      return;
    }

    toast.success(
      next ? "Novos cadastros liberados" : "Novos cadastros bloqueados",
      { position: "top-center", duration: 2000 },
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Configure as preferências do sistema e parâmetros da plataforma
          </p>
        </div>

        <div className="grid gap-6">
          {/* Cadastros públicos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Novos cadastros de salões
              </CardTitle>
              <CardDescription>
                Controla se a tela <code className="text-xs">/auth</code> aceita novos cadastros.
                Quando bloqueado, a página exibe "Novos cadastros suspensos" e qualquer tentativa
                de signup é rejeitada com toast de erro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="signups-enabled" className="flex flex-col gap-1">
                  <span>
                    {signupsEnabled ? "Cadastros liberados" : "Cadastros bloqueados"}
                  </span>
                  <span className="text-sm text-muted-foreground font-normal">
                    {signupsEnabled
                      ? "Novos salões podem se cadastrar normalmente."
                      : "Apenas o super admin pode criar salões manualmente."}
                  </span>
                </Label>
                {loadingSignups ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    id="signups-enabled"
                    checked={signupsEnabled}
                    disabled={savingSignups}
                    onCheckedChange={toggleSignups}
                  />
                )}
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
