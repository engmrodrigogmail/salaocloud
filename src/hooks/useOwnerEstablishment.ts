import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OwnerEstablishment {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
}

interface UseOwnerEstablishmentResult {
  establishment: OwnerEstablishment | null;
  establishmentId: string | null;
  loading: boolean;
  /** True quando ainda checando OU quando o usuário não é o dono. */
  guard: boolean;
}

/**
 * Garante que o usuário autenticado é o dono do estabelecimento referenciado pelo slug.
 * Se não for, redireciona para `/`. Use em todas as páginas /portal/:slug que ainda
 * não fazem essa verificação.
 *
 * Padrão de uso:
 *   const { establishmentId, guard } = useOwnerEstablishment(slug);
 *   if (guard) return <PortalLayout><Skeleton /></PortalLayout>;
 */
export function useOwnerEstablishment(slug: string | undefined): UseOwnerEstablishmentResult {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [establishment, setEstablishment] = useState<OwnerEstablishment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate(`/auth?redirect=/portal/${slug ?? ""}`);
      return;
    }

    if (!slug) {
      navigate("/");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("establishments")
        .select("id, name, slug, owner_id")
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data || data.owner_id !== user.id) {
        navigate("/");
        return;
      }

      setEstablishment(data as OwnerEstablishment);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, user, authLoading, navigate]);

  return {
    establishment,
    establishmentId: establishment?.id ?? null,
    loading: authLoading || loading,
    guard: authLoading || loading || !establishment,
  };
}
