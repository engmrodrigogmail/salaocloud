import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface FeatureCheck {
  id: string;
  name: string;
  description: string;
  category: "cadastro" | "financeiro" | "marketing" | "operacional";
  isAvailable: boolean;
  isConfigured: boolean;
  hasActivity: boolean;
  warningMessage?: string;
}

interface PlanLimits {
  max_professionals: number;
  max_services: number;
  max_clients: number;
  commissions: boolean;
  loyalty_program: boolean;
  discount_coupons: boolean;
  internal_tabs: boolean;
  portfolio_catalog: boolean;
  whatsapp_reminders: boolean;
  email_reminders: boolean;
  reports_basic: boolean;
  reports_advanced: boolean;
}

interface Props {
  establishmentId: string;
  subscriptionPlan: string;
  isTrialPeriod: boolean;
}

export function EstablishmentFeaturesCheck({ establishmentId, subscriptionPlan, isTrialPeriod }: Props) {
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<FeatureCheck[]>([]);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["cadastro", "financeiro", "marketing", "operacional"]);

  useEffect(() => {
    fetchFeaturesStatus();
  }, [establishmentId]);

  const fetchFeaturesStatus = async () => {
    setLoading(true);
    try {
      // Fetch plan limits
      const { data: planData } = await supabase
        .from("subscription_plans")
        .select("limits")
        .eq("slug", subscriptionPlan)
        .single();

      const limits = (planData?.limits as unknown as PlanLimits) || null;
      setPlanLimits(limits);

      // Fetch all data in parallel
      const [
        professionalsRes,
        servicesRes,
        clientsRes,
        appointmentsRes,
        loyaltyRes,
        couponsRes,
        tabsRes,
        commissionRulesRes,
        commissionsRes,
        paymentMethodsRes,
        categoriesRes,
        professionalServicesRes,
        productsRes,
      ] = await Promise.all([
        supabase.from("professionals").select("id, working_hours").eq("establishment_id", establishmentId),
        supabase.from("services").select("id, is_active, price").eq("establishment_id", establishmentId),
        supabase.from("clients").select("id").eq("establishment_id", establishmentId),
        supabase.from("appointments").select("id, status").eq("establishment_id", establishmentId),
        supabase.from("loyalty_programs").select("id, is_active").eq("establishment_id", establishmentId),
        supabase.from("discount_coupons").select("id, is_active, current_uses").eq("establishment_id", establishmentId),
        supabase.from("tabs").select("id, status").eq("establishment_id", establishmentId),
        supabase.from("commission_rules").select("id, is_active").eq("establishment_id", establishmentId),
        supabase.from("professional_commissions").select("id").eq("establishment_id", establishmentId),
        supabase.from("payment_methods").select("id, is_active").eq("establishment_id", establishmentId),
        supabase.from("service_categories").select("id").eq("establishment_id", establishmentId),
        supabase.from("professional_services").select("professional_id, service_id"),
        supabase.from("products").select("id, is_active").eq("establishment_id", establishmentId),
      ]);

      const professionals = professionalsRes.data || [];
      const services = servicesRes.data || [];
      const clients = clientsRes.data || [];
      const appointments = appointmentsRes.data || [];
      const loyaltyPrograms = loyaltyRes.data || [];
      const coupons = couponsRes.data || [];
      const tabs = tabsRes.data || [];
      const commissionRules = commissionRulesRes.data || [];
      const commissions = commissionsRes.data || [];
      const paymentMethods = paymentMethodsRes.data || [];
      const categories = categoriesRes.data || [];
      const professionalServices = professionalServicesRes.data || [];
      const products = productsRes.data || [];

      // Check if professionals have services linked
      const professionalIds = professionals.map(p => p.id);
      const professionalsWithServices = new Set(
        professionalServices.filter(ps => professionalIds.includes(ps.professional_id)).map(ps => ps.professional_id)
      );

      // Check if professionals have working hours configured
      const professionalsWithHours = professionals.filter(p => {
        const hours = p.working_hours as Record<string, unknown> | null;
        return hours && Object.keys(hours).length > 0;
      });

      // Build features list
      const featuresList: FeatureCheck[] = [
        // Cadastro
        {
          id: "professionals",
          name: "Profissionais cadastrados",
          description: "Profissionais que realizam os atendimentos",
          category: "cadastro",
          isAvailable: true,
          isConfigured: professionals.length > 0,
          hasActivity: professionals.length > 0,
          warningMessage: professionals.length === 0 
            ? "Nenhum profissional cadastrado. O estabelecimento precisa de pelo menos um profissional para receber agendamentos."
            : undefined,
        },
        {
          id: "professional_services",
          name: "Serviços vinculados aos profissionais",
          description: "Profissionais com serviços associados",
          category: "cadastro",
          isAvailable: true,
          isConfigured: professionalsWithServices.size > 0,
          hasActivity: professionalsWithServices.size === professionals.length && professionals.length > 0,
          warningMessage: professionals.length > 0 && professionalsWithServices.size < professionals.length
            ? `${professionals.length - professionalsWithServices.size} profissional(is) sem serviços vinculados. Eles não aparecerão na agenda.`
            : undefined,
        },
        {
          id: "working_hours",
          name: "Horários de trabalho configurados",
          description: "Horários de disponibilidade dos profissionais",
          category: "cadastro",
          isAvailable: true,
          isConfigured: professionalsWithHours.length > 0,
          hasActivity: professionalsWithHours.length === professionals.length && professionals.length > 0,
          warningMessage: professionals.length > 0 && professionalsWithHours.length < professionals.length
            ? `${professionals.length - professionalsWithHours.length} profissional(is) sem horários configurados.`
            : undefined,
        },
        {
          id: "services",
          name: "Serviços cadastrados",
          description: "Serviços oferecidos pelo estabelecimento",
          category: "cadastro",
          isAvailable: true,
          isConfigured: services.length > 0,
          hasActivity: services.filter(s => s.is_active).length > 0,
          warningMessage: services.length === 0
            ? "Nenhum serviço cadastrado. O estabelecimento precisa de pelo menos um serviço ativo."
            : services.filter(s => s.price === 0).length > 0
            ? `${services.filter(s => s.price === 0).length} serviço(s) com preço R$ 0,00.`
            : undefined,
        },
        {
          id: "categories",
          name: "Categorias de serviços",
          description: "Organização dos serviços em categorias",
          category: "cadastro",
          isAvailable: true,
          isConfigured: categories.length > 0,
          hasActivity: categories.length > 0,
        },
        {
          id: "clients",
          name: "Clientes cadastrados",
          description: "Base de clientes do estabelecimento",
          category: "cadastro",
          isAvailable: true,
          isConfigured: clients.length > 0,
          hasActivity: clients.length > 0,
        },

        // Operacional
        {
          id: "appointments",
          name: "Agendamentos realizados",
          description: "Histórico de atendimentos",
          category: "operacional",
          isAvailable: true,
          isConfigured: true,
          hasActivity: appointments.length > 0,
        },
        {
          id: "appointments_completed",
          name: "Atendimentos concluídos",
          description: "Agendamentos finalizados com sucesso",
          category: "operacional",
          isAvailable: true,
          isConfigured: true,
          hasActivity: appointments.filter(a => a.status === "completed").length > 0,
        },
        {
          id: "internal_tabs",
          name: "Comandas internas",
          description: "Controle de consumo e pagamentos",
          category: "operacional",
          isAvailable: isTrialPeriod || limits?.internal_tabs === true,
          isConfigured: tabs.length > 0,
          hasActivity: tabs.filter(t => t.status === "closed").length > 0,
        },
        {
          id: "products",
          name: "Produtos cadastrados",
          description: "Produtos para venda nas comandas",
          category: "operacional",
          isAvailable: isTrialPeriod || limits?.internal_tabs === true,
          isConfigured: products.length > 0,
          hasActivity: products.filter(p => p.is_active).length > 0,
        },
        {
          id: "payment_methods",
          name: "Formas de pagamento",
          description: "Métodos de pagamento configurados",
          category: "operacional",
          isAvailable: true,
          isConfigured: paymentMethods.length > 0,
          hasActivity: paymentMethods.filter(pm => pm.is_active).length > 0,
          warningMessage: paymentMethods.length === 0
            ? "Nenhuma forma de pagamento configurada. Pode afetar o fechamento de comandas."
            : undefined,
        },

        // Financeiro
        {
          id: "commission_rules",
          name: "Regras de comissão",
          description: "Configuração de comissões para profissionais",
          category: "financeiro",
          isAvailable: isTrialPeriod || limits?.commissions === true,
          isConfigured: commissionRules.length > 0,
          hasActivity: commissionRules.filter(c => c.is_active).length > 0,
          warningMessage: (isTrialPeriod || limits?.commissions) && commissionRules.length === 0
            ? "Comissões disponíveis mas não configuradas. Profissionais não receberão comissões."
            : undefined,
        },
        {
          id: "commissions_generated",
          name: "Comissões geradas",
          description: "Histórico de comissões calculadas",
          category: "financeiro",
          isAvailable: isTrialPeriod || limits?.commissions === true,
          isConfigured: true,
          hasActivity: commissions.length > 0,
        },

        // Marketing
        {
          id: "loyalty_program",
          name: "Programa de fidelidade",
          description: "Sistema de pontos e recompensas",
          category: "marketing",
          isAvailable: isTrialPeriod || limits?.loyalty_program === true,
          isConfigured: loyaltyPrograms.length > 0,
          hasActivity: loyaltyPrograms.filter(l => l.is_active).length > 0,
        },
        {
          id: "discount_coupons",
          name: "Cupons de desconto",
          description: "Cupons promocionais para clientes",
          category: "marketing",
          isAvailable: isTrialPeriod || limits?.discount_coupons === true,
          isConfigured: coupons.length > 0,
          hasActivity: coupons.some(c => c.current_uses > 0),
        },
      ];

      setFeatures(featuresList);
    } catch (error) {
      console.error("Error fetching features status:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getFeaturesByCategory = (category: string) => features.filter(f => f.category === category);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      cadastro: "Cadastros Básicos",
      financeiro: "Financeiro",
      marketing: "Marketing e Fidelização",
      operacional: "Operacional",
    };
    return labels[category] || category;
  };

  const getFeatureStatus = (feature: FeatureCheck) => {
    if (!feature.isAvailable) {
      return { icon: XCircle, color: "text-muted-foreground", bg: "bg-muted/50", label: "Não disponível" };
    }
    if (feature.hasActivity) {
      return { icon: CheckCircle2, color: "text-success", bg: "bg-success/10", label: "Em uso" };
    }
    if (feature.isConfigured) {
      return { icon: CheckCircle2, color: "text-success/70", bg: "bg-success/5", label: "Configurado" };
    }
    if (feature.warningMessage) {
      return { icon: AlertCircle, color: "text-warning", bg: "bg-warning/10", label: "Atenção" };
    }
    return { icon: XCircle, color: "text-muted-foreground/50", bg: "bg-muted/30", label: "Não configurado" };
  };

  const availableFeatures = features.filter(f => f.isAvailable);
  const configuredFeatures = features.filter(f => f.isAvailable && (f.isConfigured || f.hasActivity));
  const warnings = features.filter(f => f.warningMessage);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Analisando funcionalidades...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border">
        <div className="text-center">
          <p className="text-2xl font-bold text-success">{configuredFeatures.length}</p>
          <p className="text-xs text-muted-foreground">Configuradas</p>
        </div>
        <div className="h-10 w-px bg-border" />
        <div className="text-center">
          <p className="text-2xl font-bold">{availableFeatures.length}</p>
          <p className="text-xs text-muted-foreground">Disponíveis</p>
        </div>
        <div className="h-10 w-px bg-border" />
        <div className="text-center">
          <p className="text-2xl font-bold text-warning">{warnings.length}</p>
          <p className="text-xs text-muted-foreground">Alertas</p>
        </div>
        {isTrialPeriod && (
          <>
            <div className="h-10 w-px bg-border" />
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Período Trial (todas liberadas)
            </Badge>
          </>
        )}
      </div>

      {/* Warnings Section */}
      {warnings.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-warning">
              <AlertCircle className="h-4 w-4" />
              Pontos de Atenção ({warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            <ul className="space-y-2">
              {warnings.map((feature) => (
                <li key={feature.id} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning mt-2 flex-shrink-0" />
                  <span><strong>{feature.name}:</strong> {feature.warningMessage}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Features by Category */}
      <div className="space-y-2">
        {["cadastro", "operacional", "financeiro", "marketing"].map((category) => {
          const categoryFeatures = getFeaturesByCategory(category);
          const isExpanded = expandedCategories.includes(category);
          const configuredInCategory = categoryFeatures.filter(f => f.isAvailable && (f.isConfigured || f.hasActivity)).length;
          const availableInCategory = categoryFeatures.filter(f => f.isAvailable).length;

          return (
            <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-3 h-auto hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getCategoryLabel(category)}</span>
                    <Badge variant="secondary" className="text-xs">
                      {configuredInCategory}/{availableInCategory}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pl-2 pr-2 pb-2 space-y-1">
                  {categoryFeatures.map((feature) => {
                    const status = getFeatureStatus(feature);
                    const StatusIcon = status.icon;

                    return (
                      <div
                        key={feature.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg",
                          status.bg
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <StatusIcon className={cn("h-4 w-4", status.color)} />
                          <div>
                            <p className={cn(
                              "text-sm font-medium",
                              !feature.isAvailable && "text-muted-foreground"
                            )}>
                              {feature.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{feature.description}</p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            feature.hasActivity && "border-success/30 bg-success/10 text-success",
                            feature.isConfigured && !feature.hasActivity && "border-success/20 bg-success/5 text-success/70",
                            feature.warningMessage && !feature.hasActivity && "border-warning/30 bg-warning/10 text-warning",
                            !feature.isAvailable && "border-muted bg-muted/50 text-muted-foreground"
                          )}
                        >
                          {status.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
