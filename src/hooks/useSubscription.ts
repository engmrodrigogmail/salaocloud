import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionPlanSlug =
  | "trial"
  | "basic"
  | "professional"
  | "premium"
  | "pro"
  | "admin_trial";

interface SubscriptionState {
  loading: boolean;
  establishmentId: string | null;
  subscriptionPlan: SubscriptionPlanSlug | null;
  trialEndsAt: Date | null;
  adminTrialGrantedAt: Date | null;
  stripeSubscriptionId: string | null;

  /** Cortesia ilimitada concedida pelo super admin. */
  isAdminTrial: boolean;
  /** Está em trial automático tradicional (legado). */
  isTrial: boolean;
  /** Possui acesso ativo (admin_trial OU plano pago não expirado). */
  isActive: boolean;
  /** Trial automático já venceu. admin_trial NUNCA expira. */
  isExpired: boolean;
  /** Dias restantes do trial automático. null para admin_trial / planos pagos. */
  daysRemaining: number | null;

  refetch: () => Promise<void>;
}

/**
 * Hook que centraliza a lógica de assinatura/trial do estabelecimento.
 *
 * Regras:
 * - admin_trial: SEMPRE ativo, nunca expira, sem contagem regressiva.
 * - pro / planos pagos: ativos enquanto stripe_subscription_id existe (ou trial_ends_at no futuro).
 * - trial (legado): ativo até trial_ends_at; depois disso vira expirado.
 */
export function useSubscription(slug?: string | null): SubscriptionState {
  const [state, setState] = useState<Omit<SubscriptionState, "refetch">>({
    loading: true,
    establishmentId: null,
    subscriptionPlan: null,
    trialEndsAt: null,
    adminTrialGrantedAt: null,
    stripeSubscriptionId: null,
    isAdminTrial: false,
    isTrial: false,
    isActive: false,
    isExpired: false,
    daysRemaining: null,
  });

  const load = useCallback(async () => {
    if (!slug) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    setState((s) => ({ ...s, loading: true }));

    const { data, error } = await supabase
      .from("establishments")
      .select(
        "id, subscription_plan, trial_ends_at, admin_trial_granted_at, stripe_subscription_id"
      )
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) {
      setState({
        loading: false,
        establishmentId: null,
        subscriptionPlan: null,
        trialEndsAt: null,
        adminTrialGrantedAt: null,
        stripeSubscriptionId: null,
        isAdminTrial: false,
        isTrial: false,
        isActive: false,
        isExpired: false,
        daysRemaining: null,
      });
      return;
    }

    const plan = data.subscription_plan as SubscriptionPlanSlug;
    const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
    const adminTrialGrantedAt = (data as any).admin_trial_granted_at
      ? new Date((data as any).admin_trial_granted_at)
      : null;

    const isAdminTrial = plan === "admin_trial";
    const isTrial = plan === "trial";
    const now = Date.now();
    const trialActive =
      isTrial && trialEndsAt instanceof Date && trialEndsAt.getTime() > now;
    const trialExpired =
      isTrial && trialEndsAt instanceof Date && trialEndsAt.getTime() <= now;

    const hasPaidPlan =
      !isAdminTrial &&
      !isTrial &&
      (plan === "pro" ||
        plan === "basic" ||
        plan === "professional" ||
        plan === "premium");

    const isActive = isAdminTrial || trialActive || hasPaidPlan;
    const isExpired = !isAdminTrial && trialExpired;

    let daysRemaining: number | null = null;
    if (isTrial && trialEndsAt) {
      const ms = trialEndsAt.getTime() - now;
      daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    setState({
      loading: false,
      establishmentId: data.id,
      subscriptionPlan: plan,
      trialEndsAt,
      adminTrialGrantedAt,
      stripeSubscriptionId: data.stripe_subscription_id ?? null,
      isAdminTrial,
      isTrial,
      isActive,
      isExpired,
      daysRemaining,
    });
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
