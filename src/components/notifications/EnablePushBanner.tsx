import { useEffect, useRef, useState } from "react";
import { Bell, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications, type PushScope } from "@/hooks/usePushNotifications";
import { getPushBlockedInstruction, getPushFailureInstruction } from "@/lib/pushPlatform";
import { toast } from "sonner";

interface EnablePushBannerProps {
  scope: PushScope;
  clientId?: string;
  establishmentId?: string;
  /** Mantido por compatibilidade; agora a dispensa é por sessão (sessionStorage). */
  storageKey: string;
}

/**
 * Banner para ativar notificações push.
 *
 * - Aparece quando o navegador suporta e ainda não há subscription ativa.
 * - Se a permissão já foi NEGADA, mostra variante com instrução para reabilitar
 *   nas configurações do site (não some silenciosamente).
 * - "Dispensar" usa sessionStorage: volta a aparecer no próximo acesso/sessão,
 *   evitando que um clique antigo silencie o banner para sempre.
 */
export function EnablePushBanner({ scope, clientId, establishmentId, storageKey }: EnablePushBannerProps) {
  const push = usePushNotifications();
  const syncTriedRef = useRef(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Limpa eventual flag antiga de localStorage (versão anterior do banner)
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem(storageKey)) {
        localStorage.removeItem(storageKey);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!push.supported || dismissed || syncTriedRef.current) return;
    if (!push.isSubscribed || push.permission !== "granted") return;
    if (scope === "client" && !clientId) return;
    if (scope === "establishment" && !establishmentId) return;

    syncTriedRef.current = true;
    void push
      .subscribe({ scope, client_id: clientId, establishment_id: establishmentId })
      .then((ok) => setSyncFailed(!ok))
      .catch(() => setSyncFailed(true));
  }, [clientId, dismissed, establishmentId, push, scope]);

  if (!push.supported) return null;
  if (push.isSubscribed && !syncFailed) return null;
  if (dismissed) return null;

  const blocked = push.permission === "denied";

  const handleEnable = async () => {
    const ok = await push.subscribe({ scope, client_id: clientId, establishment_id: establishmentId });
    if (ok) {
      toast.success("Notificações ativadas neste dispositivo!", { position: "top-center", duration: 2000 });
      return;
    }
    toast.error(getPushFailureInstruction(), { position: "top-center", duration: 10000 });
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (blocked) {
    return (
      <div className="border-b border-destructive/30 bg-destructive/10">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs sm:text-sm flex-1 leading-tight">
            <span className="font-medium">Notificações bloqueadas.</span>{" "}
            <span className="text-muted-foreground">
              {getPushBlockedInstruction()}
            </span>
          </p>
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
