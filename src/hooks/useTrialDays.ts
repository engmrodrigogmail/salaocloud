import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useTrialDays = (defaultDays: number = 14) => {
  const [trialDays, setTrialDays] = useState<number>(defaultDays);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrialDays = async () => {
      try {
        const { data } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "trial_days")
          .single();

        if (data?.value) {
          setTrialDays(parseInt(data.value) || defaultDays);
        }
      } catch (error) {
        console.error("Error fetching trial days:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrialDays();
  }, [defaultDays]);

  return { trialDays, loading };
};
