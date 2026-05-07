import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo-salaocloud-v5.png";
import salonBg from "@/assets/salon-dark-bg.png";

type Phase = "checking" | "cancelled" | "active" | "timeout";

export default function OnboardingAwaitingPayment() {
  const [params] = useSearchParams();
  const slug = params.get("slug") || "";
  const cancelled = params.get("cancelled") === "1";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [phase, setPhase] = useState<Phase>(cancelled ? "cancelled" : "checking");
  const [attempts, setAttempts] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading || !user || phase !== "checking" || !slug) return;

    let cancelledFlag = false;

    const poll = async () => {
      try {
        // Verifica direto no banco se já foi ativado (check-subscription escreve)
        const { data: est } = await supabase
          .from("establishments")
          .select("status, stripe_subscription_id")
          .eq("slug", slug)
          .maybeSingle();

        if (est?.status === "active" && est.stripe_subscription_id) {
          if (!cancelledFlag) setPhase("active");
          return true;
        }

        // Força sincronização com Stripe
        await supabase.functions.invoke("check-subscription");

        const { data: est2 } = await supabase
          .from("establishments")
          .select("status, stripe_subscription_id")
          .eq("slug", slug)
          .maybeSingle();

        if (est2?.status === "active" && est2.stripe_subscription_id) {
          if (!cancelledFlag) setPhase("active");
          return true;
        }
      } catch (err) {
        console.error("Polling error", err);
      }
      return false;
    };

    // Primeiro check imediato
    poll();

    intervalRef.current = window.setInterval(async () => {
      setAttempts((n) => n + 1);
      const ok = await poll();
      if (ok && intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 3000);

    return () => {
      cancelledFlag = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [authLoading, user, slug, phase]);

  // Após ~60s sem sucesso, oferece ação manual
  useEffect(() => {
    if (attempts >= 20 && phase === "checking") {
      setPhase("timeout");
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    }
  }, [attempts, phase]);

  // Auto-redireciona quando ativa
  useEffect(() => {
    if (phase === "active" && slug) {
      const t = setTimeout(() => navigate(`/portal/${slug}`, { replace: true }), 1200);
      return () => clearTimeout(t);
    }
  }, [phase, slug, navigate]);

  return (
    <div
      className="min-h-screen salon-photo-bg flex flex-col"
      style={{ ["--salon-bg-image" as any]: `url(${salonBg})` }}
    >
      <header className="bg-background border-b border-border py-4 px-6">
        <img src={logo} alt="Salão Cloud" className="h-10 w-auto" />
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center space-y-6">
            {phase === "checking" && (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold mb-2">
                    Confirmando seu pagamento...
                  </h1>
                  <p className="text-muted-foreground">
                    Estamos verificando junto à Stripe. Isso costuma levar poucos segundos.
                    Não feche esta página.
                  </p>
                </div>
              </>
            )}

            {phase === "active" && (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold mb-2">
                    Assinatura confirmada! 🎉
                  </h1>
                  <p className="text-muted-foreground">
                    Redirecionando para o painel do seu salão...
                  </p>
                </div>
              </>
            )}

            {phase === "cancelled" && (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold mb-2">
                    Pagamento cancelado
                  </h1>
                  <p className="text-muted-foreground mb-4">
                    Sua assinatura ainda não foi finalizada. Você pode tentar novamente para
                    liberar o acesso ao seu salão.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setPhase("checking");
                      setAttempts(0);
                      // Recria checkout
                      retryCheckout(slug, navigate);
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Tentar novamente
                  </Button>
                </div>
              </>
            )}

            {phase === "timeout" && (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold mb-2">
                    Ainda confirmando...
                  </h1>
                  <p className="text-muted-foreground mb-4">
                    A confirmação está demorando mais que o normal. Se você concluiu o pagamento,
                    clique abaixo para verificar de novo.
                  </p>
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => {
                        setAttempts(0);
                        setPhase("checking");
                      }}
                    >
                      Verificar novamente
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => retryCheckout(slug, navigate)}
                    >
                      Refazer pagamento
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function retryCheckout(slug: string, navigate: (p: string) => void) {
  try {
    const { data: planData } = await supabase
      .from("subscription_plans")
      .select("slug, stripe_price_id_monthly")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!planData?.stripe_price_id_monthly) {
      navigate("/onboarding");
      return;
    }

    const origin = window.location.origin;
    const { data: checkoutData } = await supabase.functions.invoke("create-checkout", {
      body: {
        priceId: planData.stripe_price_id_monthly,
        planSlug: planData.slug,
        billingCycle: "monthly",
        successUrl: `${origin}/onboarding/aguardando?slug=${slug}`,
        cancelUrl: `${origin}/onboarding/aguardando?slug=${slug}&cancelled=1`,
      },
    });

    if (checkoutData?.url) {
      window.location.href = checkoutData.url;
    }
  } catch (err) {
    console.error("retryCheckout error", err);
  }
}
