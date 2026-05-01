import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PushScope = "admin" | "establishment" | "professional" | "client";

interface SubscribeArgs {
  scope: PushScope;
  client_id?: string; // required when scope === 'client'
}

interface UsePushNotificationsResult {
  supported: boolean;
  permission: NotificationPermission | "default";
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: (args: SubscribeArgs) => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

const PUSH_SUPPORTED =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

let cachedKey: string | null = null;
async function getVapidPublicKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const { data, error } = await supabase.functions.invoke("push-vapid-public-key");
  if (error || !data?.public_key) throw new Error("vapid_key_unavailable");
  cachedKey = data.public_key as string;
  return cachedKey;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!PUSH_SUPPORTED) return null;
  // ready espera o SW ativo (registrado em main.tsx)
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission | "default">(
    PUSH_SUPPORTED ? Notification.permission : "default",
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!PUSH_SUPPORTED) return;
    setPermission(Notification.permission);
    const reg = await getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setIsSubscribed(!!sub);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback<UsePushNotificationsResult["subscribe"]>(
    async ({ scope, client_id }) => {
      if (!PUSH_SUPPORTED) {
        setError("not_supported");
        return false;
      }
      setIsLoading(true);
      setError(null);
      try {
        // 1. Pede permissão
        let perm = Notification.permission;
        if (perm === "default") {
          perm = await Notification.requestPermission();
        }
        setPermission(perm);
        if (perm !== "granted") {
          setError("permission_denied");
          return false;
        }

        // 2. Garante registration
        const reg = await getRegistration();
        if (!reg) {
          setError("sw_unavailable");
          return false;
        }

        // 3. Reusa subscription se já existir, senão cria nova
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const publicKey = await getVapidPublicKey();
          const keyArray = urlBase64ToUint8Array(publicKey);
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyArray.buffer.slice(
              keyArray.byteOffset,
              keyArray.byteOffset + keyArray.byteLength,
            ) as ArrayBuffer,
          });
        }

        // 4. Persiste no backend
        const json = sub.toJSON();
        const payload: Record<string, unknown> = {
          scope,
          subscription: {
            endpoint: sub.endpoint,
            keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          },
          user_agent: navigator.userAgent,
        };
        if (scope === "client") {
          if (!client_id) {
            setError("client_id_required");
            return false;
          }
          payload.client_id = client_id;
        }

        const { error: invokeErr } = await supabase.functions.invoke("push-subscribe", {
          body: payload,
        });
        if (invokeErr) {
          setError(invokeErr.message);
          return false;
        }

        setIsSubscribed(true);
        return true;
      } catch (e: any) {
        setError(e?.message ?? "subscribe_failed");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const unsubscribe = useCallback(async () => {
    if (!PUSH_SUPPORTED) return false;
    setIsLoading(true);
    setError(null);
    try {
      const reg = await getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) {
        setIsSubscribed(false);
        return true;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await supabase.functions.invoke("push-unsubscribe", { body: { endpoint } });
      setIsSubscribed(false);
      return true;
    } catch (e: any) {
      setError(e?.message ?? "unsubscribe_failed");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    supported: PUSH_SUPPORTED,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    refresh,
  };
}
