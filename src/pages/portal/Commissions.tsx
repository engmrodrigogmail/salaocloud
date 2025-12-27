import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommissionRulesTab } from "@/components/commissions/CommissionRulesTab";
import { CommissionTrackingTab } from "@/components/commissions/CommissionTrackingTab";
import { CommissionChallengesTab } from "@/components/commissions/CommissionChallengesTab";
import { CommissionReportTab } from "@/components/commissions/CommissionReportTab";

export default function PortalCommissions() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/portal/${slug}/comissoes`);
      return;
    }

    if (slug && user) {
      fetchEstablishment();
    }
  }, [slug, user, authLoading]);

  const fetchEstablishment = async () => {
    try {
      const { data: est, error } = await supabase
        .from("establishments")
        .select("id, owner_id")
        .eq("slug", slug)
        .single();

      if (error || !est || est.owner_id !== user?.id) {
        navigate("/");
        return;
      }

      setEstablishmentId(est.id);
    } catch (error) {
      console.error("Error fetching establishment:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !establishmentId) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Comissões</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie regras de comissionamento e acompanhe os ganhos dos profissionais
          </p>
        </div>

        <Tabs defaultValue="tracking" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="tracking">Acompanhamento</TabsTrigger>
            <TabsTrigger value="rules">Regras</TabsTrigger>
            <TabsTrigger value="challenges">Desafios</TabsTrigger>
            <TabsTrigger value="report">Relatório</TabsTrigger>
          </TabsList>

          <TabsContent value="tracking">
            <CommissionTrackingTab establishmentId={establishmentId} />
          </TabsContent>

          <TabsContent value="rules">
            <CommissionRulesTab establishmentId={establishmentId} />
          </TabsContent>

          <TabsContent value="challenges">
            <CommissionChallengesTab establishmentId={establishmentId} />
          </TabsContent>

          <TabsContent value="report">
            <CommissionReportTab establishmentId={establishmentId} />
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
