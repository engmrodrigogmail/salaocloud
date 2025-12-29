import { useState, useEffect } from "react";
import { Clock, MessageCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TrialCountdownProps {
  trialEndsAt: string | null;
  subscriptionPlan: string;
}

export function TrialCountdown({ trialEndsAt, subscriptionPlan }: TrialCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number } | null>(null);

  useEffect(() => {
    if (!trialEndsAt || subscriptionPlan !== "trial") {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date();
      const endDate = new Date(trialEndsAt);
      const diff = endDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      setTimeLeft({ days, hours });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000 * 60); // Update every minute

    return () => clearInterval(interval);
  }, [trialEndsAt, subscriptionPlan]);

  if (!timeLeft) return null;

  return (
    <Alert className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
      <Clock className="h-5 w-5 text-amber-500" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 text-foreground">
        <span className="font-semibold text-amber-600 dark:text-amber-400">
          Faltam {timeLeft.days} dias e {timeLeft.hours} horas para o término de seu período gratuito.
        </span>
        <span className="text-muted-foreground">
          Para melhorar sua experiência, não hesite em nos consultar em possíveis dúvidas!
        </span>
        <MessageCircle className="h-4 w-4 text-amber-500 hidden sm:block" />
      </AlertDescription>
    </Alert>
  );
}
