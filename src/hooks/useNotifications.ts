import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NotificationRecipientType = "admin" | "establishment" | "professional" | "client";

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

interface UseNotificationsArgs {
  /** Para 'admin': user_id; 'establishment': establishment_id; 'professional': professional_id; 'client': client_id */
  recipientType: NotificationRecipientType;
  recipientId: string | null | undefined;
  limit?: number;
}

interface UseNotificationsResult {
  items: NotificationRow[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications({
  recipientType,
  recipientId,
  limit = 50,
}: UseNotificationsArgs): UseNotificationsResult {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!recipientId) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      if (recipientType === "client") {
        const { data, error: invokeErr } = await supabase.functions.invoke(
          "client-notifications-list",
          { body: { client_id: recipientId, limit } },
        );
        if (invokeErr) throw new Error(invokeErr.message);
        setItems((data?.items ?? []) as NotificationRow[]);
      } else {
        const { data, error: dbErr } = await supabase
          .from("notifications")
          .select("id, title, body, link, data, read_at, created_at")
          .eq("recipient_type", recipientType)
          .eq("recipient_id", recipientId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (dbErr) throw new Error(dbErr.message);
        setItems((data ?? []) as NotificationRow[]);
      }
    } catch (e: any) {
      setError(e?.message ?? "load_failed");
    } finally {
      setIsLoading(false);
    }
  }, [recipientType, recipientId, limit]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime — somente para destinatários autenticados (não cliente sem auth)
  useEffect(() => {
    if (!recipientId || recipientType === "client") return;
    const channel = supabase
      .channel(`notif-${recipientType}-${recipientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${recipientId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow & { recipient_type: string };
          if (row.recipient_type === recipientType) {
            setItems((prev) => [row, ...prev].slice(0, limit));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [recipientType, recipientId, limit]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (!ids.length || !recipientId) return;
      setItems((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      if (recipientType === "client") {
        await supabase.functions.invoke("client-notifications-list", {
          body: { client_id: recipientId, limit, mark_read_ids: ids },
        });
      } else {
        await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .in("id", ids);
      }
    },
    [recipientType, recipientId, limit],
  );

  const markAllRead = useCallback(async () => {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length) await markRead(ids);
  }, [items, markRead]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  return { items, unreadCount, isLoading, error, reload: load, markRead, markAllRead };
}
