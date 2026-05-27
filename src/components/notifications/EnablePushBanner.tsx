import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications, type PushScope } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

interface EnablePushBannerProps {
  scope: PushScope;
  clientId?: string;
  establishmentId?: string;
  storageKey: string;
}

/**
 * Banner visível para incentivar o usuário a ativar notificações push.
 * Aparece somente quando: navegador suporta, ainda não inscrito e permissão
 * não está bloqueada. O usuário pode dispensar (lembrado em localStorage).
 *
 * IMPORTANTE: a ativação acontece em resposta a clique do usuário (gesto),
 * que é exigido pelo Chrome/Android para abrir o prompt de permissão.
 */
export function EnablePushBanner({ scope, clientId, establishmentId, storageKey }: EnablePushBannerProps) {
  const push = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (!push.supported) return null;
  if (push.isSubscribed) return null;
  if (push.permission === "denied") return null;
  if (dismissed) return null;

  const handleEnable = async () => {
    const ok = await push.subscribe({ scope, client_id: clientId, establishment_id: establishmentId });
    if (ok) {
      toast.success("Notificações ativadas neste dispositivo!", { position: "top-center", duration: 2000 });
    } else {
      toast.error(
        "Não foi possível ativar. Verifique se as notificações deste site estão liberadas no navegador.",
        { position: "top-center", duration: 4000 },
      );
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="border-b border-primary/30 bg-primary/10">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
        <Bell className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs sm:text-sm flex-1 leading-tight">
          <span className="font-medium">Receba avisos do salão.</span>{" "}
          <span className="text-muted-foreground">Ative as notificações neste aparelho.</span>
        </p>
        <Button size="sm" className="h-7 text-xs shrink-0" onClick={handleEnable} disabled={push.isLoading}>
          Ativar
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleDismiss}
          aria-label="Dispensar"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
