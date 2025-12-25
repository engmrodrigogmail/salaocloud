import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Settings as SettingsIcon, Building2, Link, Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function EstablishmentSettings() {
  const [establishment, setEstablishment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchEstablishment = async () => {
      if (!user) return;

      const { data } = await supabase
        .from("establishments")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      setEstablishment(data);
      setLoading(false);
    };

    fetchEstablishment();
  }, [user]);

  const copyLink = () => {
    if (establishment?.slug) {
      navigator.clipboard.writeText(`https://salaocloud.com.br/${establishment.slug}`);
      toast({ title: "Link copiado!" });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as configurações do seu estabelecimento
          </p>
        </div>

        <div className="grid gap-6">
          {/* Establishment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados do Estabelecimento
              </CardTitle>
              <CardDescription>
                Informações básicas do seu espaço
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={establishment?.name || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={establishment?.phone || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={establishment?.email || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={establishment?.city || ""} readOnly />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Link */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Link de Agendamento
              </CardTitle>
              <CardDescription>
                Compartilhe esse link com seus clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={`salaocloud.com.br/${establishment?.slug || ""}`}
                  readOnly
                  className="font-mono"
                />
                <Button onClick={copyLink}>Copiar</Button>
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
                <Label htmlFor="new-bookings" className="flex flex-col gap-1">
                  <span>Novos agendamentos</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Receber notificação quando um cliente agendar
                  </span>
                </Label>
                <Switch id="new-bookings" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="cancellations" className="flex flex-col gap-1">
                  <span>Cancelamentos</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Alertas quando um agendamento for cancelado
                  </span>
                </Label>
                <Switch id="cancellations" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="daily-summary" className="flex flex-col gap-1">
                  <span>Resumo diário</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Receber um resumo dos agendamentos do dia
                  </span>
                </Label>
                <Switch id="daily-summary" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
