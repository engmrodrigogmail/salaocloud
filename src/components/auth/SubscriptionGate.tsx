import { ReactNode, useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Bloqueia o acesso ao estabelecimento (slug da rota) quando o trial
 * expirou ou a assinatura não está mais ativa. Funciona para donos,
 * profissionais e clientes vinculados a este salão — outros salões
 * onde a pessoa também atua não são afetados.
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<"loading" | "active" | "blocked" | "unknown">("loading");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!slug) { setState("unknown"); return; }
      const { data: est } = await supabase
        .from("establishments")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!est?.id) { if (!cancelled) setState("unknown"); return; }
      const { data, error } = await supabase.rpc("is_establishment_active", {
        _establishment_id: est.id,
      });
      if (cancelled) return;
      if (error) { setState("unknown"); return; }
      setState(data ? "active" : "blocked");
    }
    check();
    return () => { cancelled = true; };
  }, [slug]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (state === "blocked") {
    return <Navigate to={`/assinatura/expirada?slug=${slug}`} replace />;
  }
  return <>{children}</>;
}
