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
import { CommissionMatrixTab } from "@/components/commissions/CommissionMatrixTab";

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

        <Tabs defaultValue="matrix" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-5 sm:max-w-3xl gap-1">
              <TabsTrigger value="matrix" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">Matriz</TabsTrigger>
              <TabsTrigger value="tracking" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">Acompanhamento</TabsTrigger>
              <TabsTrigger value="rules" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">Regras</TabsTrigger>
              <TabsTrigger value="challenges" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">Desafios</TabsTrigger>
              <TabsTrigger value="report" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">Relatório</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="matrix">
            <CommissionMatrixTab establishmentId={establishmentId} />
          </TabsContent>

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
