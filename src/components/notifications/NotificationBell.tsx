import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  useNotifications,
  type NotificationRecipientType,
} from "@/hooks/useNotifications";
import { usePushNotifications, type PushScope } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface NotificationBellProps {
  recipientType: NotificationRecipientType;
  recipientId: string | null | undefined;
  pushScope: PushScope;
  pushClientId?: string;
  className?: string;
}

export function NotificationBell({
  recipientType,
  recipientId,
  pushScope,
  pushClientId,
  className,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { items, unreadCount, isLoading, markRead, markAllRead } = useNotifications({
    recipientType,
    recipientId,
  });
  const push = usePushNotifications();

  const handleClick = async (id: string, link: string | null, isRead: boolean) => {
    if (!isRead) await markRead([id]);
    setOpen(false);
    if (link) navigate(link);
  };

  const handleEnablePush = async () => {
    const ok = await push.subscribe({ scope: pushScope, client_id: pushClientId });
    if (ok) toast.success("Notificações ativadas neste dispositivo!", { position: "top-center" });
    else toast.error("Não foi possível ativar as notificações.", { position: "top-center" });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative", className)} aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs gap-1">
              <CheckCheck className="h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>

        {push.supported && !push.isSubscribed && push.permission !== "denied" && (
          <div className="border-b bg-muted/40 px-4 py-2 text-xs">
            <p className="text-muted-foreground mb-1">
              Receba avisos mesmo com o app fechado.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleEnablePush}
              disabled={push.isLoading}
            >
              Ativar notificações
            </Button>
          </div>
        )}

        <ScrollArea className="h-80">
          {isLoading && <p className="px-4 py-6 text-sm text-muted-foreground text-center">Carregando…</p>}
          {!isLoading && items.length === 0 && (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center">
              Nada por aqui ainda.
            </p>
          )}
          {!isLoading &&
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n.id, n.link, !!n.read_at)}
                className={cn(
                  "w-full text-left border-b px-4 py-3 hover:bg-accent/50 transition-colors",
                  !n.read_at && "bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm leading-tight">{n.title}</p>
                  {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </button>
            ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
