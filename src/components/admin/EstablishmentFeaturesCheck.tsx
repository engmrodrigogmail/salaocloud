import { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
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

  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const diagnosticsRef = useRef<string[]>([]);
  const fetchSeqRef = useRef(0);

  const pushDiag = (level: "INFO" | "WARN" | "ERROR", message: string, meta?: Record<string, unknown>) => {
    const metaText = meta ? (() => {
      try {
        const s = JSON.stringify(meta);
        return s.length > 800 ? `${s.slice(0, 800)}…` : s;
      } catch {
        return "[meta]";
      }
    })() : "";

    const line = `${new Date().toISOString()} ${level} ${message}${metaText ? ` | ${metaText}` : ""}`;
    diagnosticsRef.current = [...diagnosticsRef.current, line].slice(-300);
  };

  const flushDiagnostics = () => {
    setDiagnostics([...diagnosticsRef.current]);
  };

  useEffect(() => {
    fetchFeaturesStatus();
    return () => {
      // invalida requests pendentes ao desmontar/trocar de estabelecimento
      fetchSeqRef.current += 1;
    };
  }, [establishmentId]);

  const fetchFeaturesStatus = async () => {
    const fetchSeq = ++fetchSeqRef.current;

    diagnosticsRef.current = [];
    setDiagnostics([]);

    pushDiag("INFO", "Iniciando diagnóstico da aba Funcionalidades", {
      establishmentId,
      subscriptionPlan,
      isTrialPeriod,
    });

    setLoading(true);

    try {
      // Fetch plan limits (trial plan doesn't exist in subscription_plans table)
      let limits: PlanLimits | null = null;

      if (subscriptionPlan && subscriptionPlan !== "trial") {
        const { data: planData, error: planError } = await supabase
          .from("subscription_plans")
          .select("limits")
          .eq("slug", subscriptionPlan)
          .maybeSingle();

        if (planError) {
          pushDiag("WARN", "Falha ao buscar limites do plano", {
            code: (planError as any)?.code,
            message: (planError as any)?.message,
          });
        } else {
          limits = (planData?.limits as unknown as PlanLimits) || null;
        }
      }

      if (fetchSeq !== fetchSeqRef.current) return;
      setPlanLimits(limits);

      pushDiag("INFO", "Buscando dados do estabelecimento (consultas otimizadas)…");

      const t0 = performance.now();

      // PROFISSIONAIS
      // - Trazemos 1 linha por profissional + contagem agregada de vínculos em professional_services.
      // - Evita buscar a tabela professional_services inteira (causa comum de congelamento).
      const professionalsQuery = supabase
        .from("professionals")
        .select("id, professional_services(count)")
        .eq("establishment_id", establishmentId);

      // Horários: contar apenas quem tem working_hours != null (evita carregar JSON de todos)
      const professionalsWithHoursCountQuery = supabase
        .from("professionals")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .not("working_hours", "is", null);

      // SERVIÇOS (somente contagens)
      const servicesCountQuery = supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);

      const servicesActiveCountQuery = supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .eq("is_active", true);

      const servicesZeroPriceCountQuery = supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .eq("price", 0);

      // Categorias
      const categoriesCountQuery = supabase
        .from("service_categories")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);

      // Produtos
      const productsCountQuery = supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);

      const productsActiveCountQuery = supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .eq("is_active", true);

      // Programas de fidelidade
      const loyaltyCountQuery = supabase
        .from("loyalty_programs")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);

      const loyaltyActiveCountQuery = supabase
        .from("loyalty_programs")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .eq("is_active", true);

      // Regras de comissão
      const commissionRulesCountQuery = supabase
        .from("commission_rules")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);

      const commissionRulesActiveCountQuery = supabase
        .from("commission_rules")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .eq("is_active", true);

      // Formas de pagamento
      const paymentMethodsCountQuery = supabase
        .from("payment_methods")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);

      const paymentMethodsActiveCountQuery = supabase
        .from("payment_methods")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .eq("is_active", true);

      // Dados potencialmente grandes (usar count/head pra não travar a UI)
      const clientsCountQuery = supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);

      const appointmentsCountQuery = supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);

      const appointmentsCompletedCountQuery = supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .eq("status", "completed");

      const tabsCountQuery = supabase
        .from("tabs")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);

      const tabsClosedCountQuery = supabase
        .from("tabs")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .eq("status", "closed");

      const commissionsCountQuery = supabase
        .from("professional_commissions")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);

      const couponsCountQuery = supabase
        .from("discount_coupons")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);

      const couponsUsedCountQuery = supabase
        .from("discount_coupons")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .gt("current_uses", 0);

      const [
        professionalsRes,
        professionalsWithHoursCountRes,
        servicesCountRes,
        servicesActiveCountRes,
        servicesZeroPriceCountRes,
        categoriesCountRes,
        productsCountRes,
        productsActiveCountRes,
        loyaltyCountRes,
        loyaltyActiveCountRes,
        commissionRulesCountRes,
        commissionRulesActiveCountRes,
        paymentMethodsCountRes,
        paymentMethodsActiveCountRes,
        clientsCountRes,
        appointmentsCountRes,
        appointmentsCompletedCountRes,
        tabsCountRes,
        tabsClosedCountRes,
        commissionsCountRes,
        couponsCountRes,
        couponsUsedCountRes,
      ] = await Promise.all([
        professionalsQuery,
        professionalsWithHoursCountQuery,
        servicesCountQuery,
        servicesActiveCountQuery,
        servicesZeroPriceCountQuery,
        categoriesCountQuery,
        productsCountQuery,
        productsActiveCountQuery,
        loyaltyCountQuery,
        loyaltyActiveCountQuery,
        commissionRulesCountQuery,
        commissionRulesActiveCountQuery,
        paymentMethodsCountQuery,
        paymentMethodsActiveCountQuery,
        clientsCountQuery,
        appointmentsCountQuery,
        appointmentsCompletedCountQuery,
        tabsCountQuery,
        tabsClosedCountQuery,
        commissionsCountQuery,
        couponsCountQuery,
        couponsUsedCountQuery,
      ]);

      if (fetchSeq !== fetchSeqRef.current) return;

      const dt = Math.round(performance.now() - t0);
      pushDiag("INFO", "Consultas concluídas", { ms: dt });

      const errors = [
        { name: "professionals(+agg)", error: professionalsRes.error },
        { name: "professionals_hours(count)", error: professionalsWithHoursCountRes.error },
        { name: "services(count)", error: servicesCountRes.error },
        { name: "services_active(count)", error: servicesActiveCountRes.error },
        { name: "services_zero_price(count)", error: servicesZeroPriceCountRes.error },
        { name: "service_categories(count)", error: categoriesCountRes.error },
        { name: "products(count)", error: productsCountRes.error },
        { name: "products_active(count)", error: productsActiveCountRes.error },
        { name: "loyalty_programs(count)", error: loyaltyCountRes.error },
        { name: "loyalty_programs_active(count)", error: loyaltyActiveCountRes.error },
        { name: "commission_rules(count)", error: commissionRulesCountRes.error },
        { name: "commission_rules_active(count)", error: commissionRulesActiveCountRes.error },
        { name: "payment_methods(count)", error: paymentMethodsCountRes.error },
        { name: "payment_methods_active(count)", error: paymentMethodsActiveCountRes.error },
        { name: "clients(count)", error: clientsCountRes.error },
        { name: "appointments(count)", error: appointmentsCountRes.error },
        { name: "appointments_completed(count)", error: appointmentsCompletedCountRes.error },
        { name: "tabs(count)", error: tabsCountRes.error },
        { name: "tabs_closed(count)", error: tabsClosedCountRes.error },
        { name: "professional_commissions(count)", error: commissionsCountRes.error },
        { name: "discount_coupons(count)", error: couponsCountRes.error },
        { name: "discount_coupons_used(count)", error: couponsUsedCountRes.error },
      ].filter((x) => !!x.error);

      if (errors.length) {
        pushDiag("ERROR", "Erros retornados pelas consultas", { count: errors.length });
        errors.slice(0, 6).forEach((e) => {
          pushDiag("ERROR", `Query ${e.name} falhou`, {
            code: (e.error as any)?.code,
            message: (e.error as any)?.message,
            details: (e.error as any)?.details,
          });
        });
      }

      const professionals = (professionalsRes.data || []) as Array<{
        id: string;
        professional_services?: Array<{ count: number }>;
      }>;

      const professionalsCount = professionals.length;
      const professionalsWithServicesCount = professionals.reduce((acc, p) => {
        const c = p.professional_services?.[0]?.count ?? 0;
        return acc + (c > 0 ? 1 : 0);
      }, 0);

      const professionalsWithHoursCount = professionalsWithHoursCountRes.count || 0;

      const servicesCount = servicesCountRes.count || 0;
      const servicesActiveCount = servicesActiveCountRes.count || 0;
      const servicesZeroPriceCount = servicesZeroPriceCountRes.count || 0;

      const categoriesCount = categoriesCountRes.count || 0;

      const productsCount = productsCountRes.count || 0;
      const productsActiveCount = productsActiveCountRes.count || 0;

      const loyaltyCount = loyaltyCountRes.count || 0;
      const loyaltyActiveCount = loyaltyActiveCountRes.count || 0;

      const commissionRulesCount = commissionRulesCountRes.count || 0;
      const commissionRulesActiveCount = commissionRulesActiveCountRes.count || 0;

      const paymentMethodsCount = paymentMethodsCountRes.count || 0;
      const paymentMethodsActiveCount = paymentMethodsActiveCountRes.count || 0;

      const clientsCount = clientsCountRes.count || 0;
      const appointmentsCount = appointmentsCountRes.count || 0;
      const appointmentsCompletedCount = appointmentsCompletedCountRes.count || 0;
      const tabsCount = tabsCountRes.count || 0;
      const tabsClosedCount = tabsClosedCountRes.count || 0;
      const commissionsCount = commissionsCountRes.count || 0;
      const couponsCount = couponsCountRes.count || 0;
      const couponsUsedCount = couponsUsedCountRes.count || 0;

      pushDiag("INFO", "Resumo de volumes", {
        professionalsCount,
        professionalsWithServicesCount,
        professionalsWithHoursCount,
        servicesCount,
        servicesActiveCount,
        servicesZeroPriceCount,
        clientsCount,
        appointmentsCount,
        appointmentsCompletedCount,
        tabsCount,
        tabsClosedCount,
        commissionsCount,
        couponsCount,
        couponsUsedCount,
        categoriesCount,
        productsCount,
        productsActiveCount,
        loyaltyCount,
        loyaltyActiveCount,
        paymentMethodsCount,
        paymentMethodsActiveCount,
        commissionRulesCount,
        commissionRulesActiveCount,
      });

      const featuresList: FeatureCheck[] = [
        // Cadastro
        {
          id: "professionals",
          name: "Profissionais cadastrados",
          description: "Profissionais que realizam os atendimentos",
          category: "cadastro",
          isAvailable: true,
          isConfigured: professionalsCount > 0,
          hasActivity: professionalsCount > 0,
          warningMessage:
            professionalsCount === 0
              ? "Nenhum profissional cadastrado. O estabelecimento precisa de pelo menos um profissional para receber agendamentos."
              : undefined,
        },
        {
          id: "professional_services",
          name: "Serviços vinculados aos profissionais",
          description: "Profissionais com serviços associados",
          category: "cadastro",
          isAvailable: true,
          isConfigured: professionalsWithServicesCount > 0,
          hasActivity: professionalsWithServicesCount === professionalsCount && professionalsCount > 0,
          warningMessage:
            professionalsCount > 0 && professionalsWithServicesCount < professionalsCount
              ? `${professionalsCount - professionalsWithServicesCount} profissional(is) sem serviços vinculados. Eles não aparecerão na agenda.`
              : undefined,
        },
        {
          id: "working_hours",
          name: "Horários de trabalho configurados",
          description: "Horários de disponibilidade dos profissionais",
          category: "cadastro",
          isAvailable: true,
          isConfigured: professionalsWithHoursCount > 0,
          hasActivity: professionalsWithHoursCount === professionalsCount && professionalsCount > 0,
          warningMessage:
            professionalsCount > 0 && professionalsWithHoursCount < professionalsCount
              ? `${professionalsCount - professionalsWithHoursCount} profissional(is) sem horários configurados.`
              : undefined,
        },
        {
          id: "services",
          name: "Serviços cadastrados",
          description: "Serviços oferecidos pelo estabelecimento",
          category: "cadastro",
          isAvailable: true,
          isConfigured: servicesCount > 0,
          hasActivity: servicesActiveCount > 0,
          warningMessage:
            servicesCount === 0
              ? "Nenhum serviço cadastrado. O estabelecimento precisa de pelo menos um serviço ativo."
              : servicesZeroPriceCount > 0
                ? `${servicesZeroPriceCount} serviço(s) com preço R$ 0,00.`
                : undefined,
        },
        {
          id: "categories",
          name: "Categorias de serviços",
          description: "Organização dos serviços em categorias",
          category: "cadastro",
          isAvailable: true,
          isConfigured: categoriesCount > 0,
          hasActivity: categoriesCount > 0,
        },
        {
          id: "clients",
          name: "Clientes cadastrados",
          description: "Base de clientes do estabelecimento",
          category: "cadastro",
          isAvailable: true,
          isConfigured: clientsCount > 0,
          hasActivity: clientsCount > 0,
        },

        // Operacional
        {
          id: "appointments",
          name: "Agendamentos realizados",
          description: "Histórico de atendimentos",
          category: "operacional",
          isAvailable: true,
          isConfigured: true,
          hasActivity: appointmentsCount > 0,
        },
        {
          id: "appointments_completed",
          name: "Atendimentos concluídos",
          description: "Agendamentos finalizados com sucesso",
          category: "operacional",
          isAvailable: true,
          isConfigured: true,
          hasActivity: appointmentsCompletedCount > 0,
        },
        {
          id: "internal_tabs",
          name: "Comandas internas",
          description: "Controle de consumo e pagamentos",
          category: "operacional",
          isAvailable: isTrialPeriod || limits?.internal_tabs === true,
          isConfigured: tabsCount > 0,
          hasActivity: tabsClosedCount > 0,
        },
        {
          id: "products",
          name: "Produtos cadastrados",
          description: "Produtos para venda nas comandas",
          category: "operacional",
          isAvailable: isTrialPeriod || limits?.internal_tabs === true,
          isConfigured: productsCount > 0,
          hasActivity: productsActiveCount > 0,
        },
        {
          id: "payment_methods",
          name: "Formas de pagamento",
          description: "Métodos de pagamento configurados",
          category: "operacional",
          isAvailable: true,
          isConfigured: paymentMethodsCount > 0,
          hasActivity: paymentMethodsActiveCount > 0,
          warningMessage:
            paymentMethodsCount === 0
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
          isConfigured: commissionRulesCount > 0,
          hasActivity: commissionRulesActiveCount > 0,
          warningMessage:
            (isTrialPeriod || limits?.commissions) && commissionRulesCount === 0
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
          hasActivity: commissionsCount > 0,
        },

        // Marketing
        {
          id: "loyalty_program",
          name: "Programa de fidelidade",
          description: "Sistema de pontos e recompensas",
          category: "marketing",
          isAvailable: isTrialPeriod || limits?.loyalty_program === true,
          isConfigured: loyaltyCount > 0,
          hasActivity: loyaltyActiveCount > 0,
        },
        {
          id: "discount_coupons",
          name: "Cupons de desconto",
          description: "Cupons promocionais para clientes",
          category: "marketing",
          isAvailable: isTrialPeriod || limits?.discount_coupons === true,
          isConfigured: couponsCount > 0,
          hasActivity: couponsUsedCount > 0,
        },
      ];

      pushDiag("INFO", "Lista de funcionalidades montada", { items: featuresList.length });
      setFeatures(featuresList);
      pushDiag("INFO", "Concluído");
    } catch (error) {
      pushDiag("ERROR", "Falha inesperada ao analisar funcionalidades", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
      flushDiagnostics();
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

      <Card>
        <CardHeader className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Diagnóstico</CardTitle>
              <CardDescription className="text-xs">
                Logs desta aba (útil para investigar travamentos e permissões).
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDiagnostics([...diagnosticsRef.current]);
                  toast("Diagnóstico atualizado.");
                }}
              >
                Atualizar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const text = (diagnosticsRef.current.length ? diagnosticsRef.current : diagnostics).join("\n");
                  try {
                    await navigator.clipboard.writeText(text);
                    toast("Logs copiados.");
                  } catch {
                    toast("Não foi possível copiar os logs.");
                  }
                }}
              >
                Copiar
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowDiagnostics((v) => !v)}
              >
                {showDiagnostics ? "Ocultar" : "Mostrar"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showDiagnostics && (
          <CardContent className="pt-0">
            <div className="rounded-md border bg-muted/30 p-3">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {(diagnostics.length ? diagnostics : ["(Sem logs capturados ainda)"]).join("\n")}
              </pre>
            </div>
          </CardContent>
        )}
      </Card>

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
