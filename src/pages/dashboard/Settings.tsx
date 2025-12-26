import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Building2, Link, Bell, Menu, Users } from "lucide-react";
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
  const [showCatalog, setShowCatalog] = useState(false);
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
      setShowCatalog(data?.show_catalog || false);
      setLoading(false);
    };

    fetchEstablishment();
  }, [user]);

  const copyBookingLink = () => {
    if (establishment?.slug) {
      navigator.clipboard.writeText(`${window.location.origin}/agendar/${establishment.slug}`);
      toast({ title: "Link de agendamento copiado!" });
    }
  };

  const copyClientLink = () => {
    if (establishment?.slug) {
      navigator.clipboard.writeText(`${window.location.origin}/cliente/${establishment.slug}`);
      toast({ title: "Link do portal do cliente copiado!" });
    }
  };

  const handleShowCatalogChange = async (checked: boolean) => {
    if (!establishment) return;
    
    setShowCatalog(checked);
    
    const { error } = await supabase
      .from("establishments")
      .update({ show_catalog: checked })
      .eq("id", establishment.id);

    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
      setShowCatalog(!checked);
      return;
    }

    toast({ 
      title: checked 
        ? "Cardápio de serviços ativado!" 
        : "Cardápio de serviços desativado" 
    });
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

          {/* Client Catalog */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Menu className="h-5 w-5" />
                Cardápio de Serviços
              </CardTitle>
              <CardDescription>
                Controle a visibilidade dos seus serviços para os clientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-catalog" className="flex flex-col gap-1">
                  <span>Exibir cardápio de serviços</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Quando ativo, os clientes podem visualizar seus serviços e preços no portal
                  </span>
                </Label>
                <Switch 
                  id="show-catalog" 
                  checked={showCatalog}
                  onCheckedChange={handleShowCatalogChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Links para Clientes
              </CardTitle>
              <CardDescription>
                Compartilhe esses links com seus clientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Link de Agendamento</Label>
                <div className="flex gap-2">
                  <Input
                    value={`${window.location.origin}/agendar/${establishment?.slug || ""}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button onClick={copyBookingLink}>Copiar</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Portal do Cliente
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={`${window.location.origin}/cliente/${establishment?.slug || ""}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button onClick={copyClientLink}>Copiar</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Neste portal, clientes cadastrados podem ver agendamentos, serviços, fidelidade e promoções
                </p>
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