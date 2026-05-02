import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useEduAccess(establishmentId: string | null | undefined) {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!establishmentId) {
      setLoading(false);
      setIsActive(false);
      return;
    }
    setLoading(true);
    supabase
      .from("edu_access_control")
      .select("is_active")
      .eq("establishment_id", establishmentId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setIsActive(!!data?.is_active);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [establishmentId]);

  return { isActive: !!isActive, loading };
}
