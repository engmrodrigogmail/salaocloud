import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Settings, Bell, Shield, Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function AdminSettings() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Configure as preferências do sistema
          </p>
        </div>

        <div className="grid gap-6">
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
