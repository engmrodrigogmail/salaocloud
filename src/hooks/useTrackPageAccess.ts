import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const PAGE_NAMES: Record<string, string> = {
  "": "Dashboard",
  agenda: "Agenda",
  clientes: "Clientes",
  profissionais: "Profissionais",
  servicos: "Serviços",
  produtos: "Produtos",
  categorias: "Categorias",
  financeiro: "Financeiro",
  comissoes: "Comissões",
  assinatura: "Assinatura",
  promocoes: "Promoções",
  cupons: "Cupons",
  fidelidade: "Fidelidade",
  vitrine: "Vitrine",
  comunicacao: "Comunicação",
  "assistente-ia": "Assistente IA",
  "conversas-ia": "Conversas IA",
  "aprendizados-ia": "Aprendizados IA",
  edu: "Consultor Edu",
  auditoria: "Auditoria",
  configuracoes: "Configurações",
};

function getSessionId(): string {
  const KEY = "sc_session_id";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

function pageNameFromPath(pathname: string): string {
  // /portal/:slug/<rest>
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("portal");
  if (idx === -1) return "Outro";
  const sub = parts[idx + 2] || "";
  return PAGE_NAMES[sub] ?? sub.replace(/-/g, " ") ?? "Outro";
}

export function useTrackPageAccess(establishmentId: string | null | undefined) {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !establishmentId) return;
    if (!location.pathname.startsWith("/portal/")) return;

    const session_id = getSessionId();
    const page_name = pageNameFromPath(location.pathname);

    supabase
      .from("user_session_logs" as any)
      .insert({
        establishment_id: establishmentId,
        user_id: user.id,
        page_route: location.pathname,
        page_name,
        session_id,
        referrer_page: document.referrer || null,
        user_agent: navigator.userAgent,
      } as any)
      .then(({ error }) => {
        if (error) console.warn("[trackPageAccess]", error.message);
      });
  }, [location.pathname, user?.id, establishmentId]);
}
