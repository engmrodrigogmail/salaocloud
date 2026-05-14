import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SandboxState {
  slug: string | null;
  establishmentId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Garante que o vendedor logado tenha um salão de treino próprio.
 * Cria o sandbox no primeiro acesso via RPC `provision_training_sandbox`.
 */
export function useTrainingSandbox() {
  const { user } = useAuth();
  const [state, setState] = useState<SandboxState>({
    slug: null,
    establishmentId: null,
    loading: true,
    error: null,
  });

  const provision = useCallback(async () => {
    if (!user) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await (supabase.rpc as any)("provision_training_sandbox");
    if (error) {
      setState({ slug: null, establishmentId: null, loading: false, error: error.message });
      return;
    }
    setState({
      slug: (data as any)?.slug ?? null,
      establishmentId: (data as any)?.establishment_id ?? null,
      loading: false,
      error: null,
    });
  }, [user]);

  const reset = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await (supabase.rpc as any)("reset_training_sandbox");
    if (error) {
      setState({ slug: null, establishmentId: null, loading: false, error: error.message });
      return false;
    }
    setState({
      slug: (data as any)?.slug ?? null,
      establishmentId: (data as any)?.establishment_id ?? null,
      loading: false,
      error: null,
    });
    return true;
  }, []);

  useEffect(() => {
    if (user) provision();
  }, [user, provision]);

  return { ...state, reset };
}

/**
 * Reescreve o iframe_path do módulo trocando o salão demo mestre pelo sandbox do vendedor.
 */
export function resolveSandboxPath(
  iframePath: string | null,
  view: string,
  sandboxSlug: string | null
): string | null {
  if (!iframePath) return null;
  if (!sandboxSlug) return iframePath;

  // Caminhos que já carregam slug do salão demo
  if (iframePath.includes("demo-treinamento")) {
    return iframePath.split("demo-treinamento").join(sandboxSlug);
  }

  // Caminhos relativos (sem slug): prefixa de acordo com a view
  if (view === "portal") return `/portal/${sandboxSlug}${iframePath === "/" ? "" : iframePath}`;
  if (view === "interno") return `/interno/${sandboxSlug}${iframePath === "/" ? "" : iframePath}`;
  if (view === "cliente") return `/${sandboxSlug}${iframePath === "/" ? "" : iframePath}`;

  return iframePath;
}
