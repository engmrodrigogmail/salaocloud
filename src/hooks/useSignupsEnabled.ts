import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lê a flag global `signups_enabled` em platform_settings.
 * Controlada pelo super admin em /admin/configuracoes.
 * Quando false, o /auth bloqueia novos cadastros.
 */
export function useSignupsEnabled() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "signups_enabled")
        .maybeSingle();
      if (!cancelled) {
        // Default seguro: aberto. Só bloqueia se vier explicitamente "false".
        setEnabled(data?.value !== "false");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { signupsEnabled: enabled, loading };
}
