import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Role = "owner" | "manager";

interface FinanceAccess {
  loading: boolean;
  establishmentId: string | null;
  establishmentName: string;
  role: Role | null;
  /** true até resolver tudo ou quando sem permissão */
  guard: boolean;
}

/**
 * Permite acesso à área financeira para dono OU profissional com is_manager=true.
 * Redireciona para `/` se não tiver permissão.
 */
export function useFinanceAccess(slug: string | undefined): FinanceAccess {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<{
    establishmentId: string | null;
    establishmentName: string;
    role: Role | null;
  }>({ establishmentId: null, establishmentName: "", role: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?redirect=/portal/${slug ?? ""}/financeiro`);
      return;
    }
    if (!slug) {
      navigate("/");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: est } = await supabase
        .from("establishments")
        .select("id, name, owner_id")
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled || !est) {
        if (!cancelled) navigate("/");
        return;
      }

      let role: Role | null = null;
      if (est.owner_id === user.id) {
        role = "owner";
      } else {
        const { data: prof } = await supabase
          .from("professionals")
          .select("id, is_manager, is_active")
          .eq("establishment_id", est.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (prof?.is_manager && prof.is_active) role = "manager";
      }

      if (cancelled) return;
      if (!role) {
        navigate("/");
        return;
      }

      setState({ establishmentId: est.id, establishmentName: est.name, role });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, user, authLoading, navigate]);

  return {
    loading: authLoading || loading,
    establishmentId: state.establishmentId,
    establishmentName: state.establishmentName,
    role: state.role,
    guard: authLoading || loading || !state.establishmentId,
  };
}
