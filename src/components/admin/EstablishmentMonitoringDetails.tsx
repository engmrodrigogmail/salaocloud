import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dateUtils";
import { User, Users, BarChart3, Activity } from "lucide-react";

interface Props {
  establishmentId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Detail {
  est: any;
  owner: any;
  access: any;
  clients: any;
  weekly: { day: string; count: number }[];
  topPages: { page_name: string; count: number; pct: number }[];
}

export function EstablishmentMonitoringDetails({ establishmentId, open, onOpenChange }: Props) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !establishmentId) { setData(null); return; }
    (async () => {
      setLoading(true);
      try {
        const [est, accessRow, clientsRow, logs] = await Promise.all([
          supabase.from("establishments").select("id,name,phone,email,subscription_plan,owner_id").eq("id", establishmentId).single(),
          (supabase as any).from("vw_last_establishment_access").select("*").eq("id", establishmentId).maybeSingle(),
          (supabase as any).from("vw_client_registration_status").select("*").eq("establishment_id", establishmentId).maybeSingle(),
          (supabase as any).from("user_session_logs").select("page_name, session_start").eq("establishment_id", establishmentId).gte("session_start", new Date(Date.now() - 7 * 86400000).toISOString()),
        ]);

        let owner: any = null;
        if (est.data?.owner_id) {
          const { data: prof } = await supabase.from("profiles").select("full_name, phone").eq("id", est.data.owner_id).maybeSingle();
          owner = prof;
        }

        // weekly
        const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const weekly: { day: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          d.setHours(0, 0, 0, 0);
          const next = new Date(d); next.setDate(next.getDate() + 1);
          const c = (logs.data || []).filter((l: any) => {
            const t = new Date(l.session_start);
            return t >= d && t < next;
          }).length;
          weekly.push({ day: days[d.getDay()], count: c });
        }

        // top pages
        const counts: Record<string, number> = {};
        (logs.data || []).forEach((l: any) => { counts[l.page_name] = (counts[l.page_name] || 0) + 1; });
        const total = (logs.data || []).length || 1;
        const topPages = Object.entries(counts)
          .map(([page_name, count]) => ({ page_name, count, pct: Math.round((count / total) * 100) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setData({ est: est.data, owner, access: accessRow.data, clients: clientsRow.data, weekly, topPages });
      } catch (e) {
        console.error("[EstDetails]", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, establishmentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📍 {data?.est?.name || "Detalhes do salão"}</DialogTitle>
        </DialogHeader>

        {loading || !data ? (
          <div className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-32 w-full" /></div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-1 text-sm">
                <div className="flex items-center gap-2 font-semibold mb-1"><User className="h-4 w-4" />Dono</div>
                <p>{data.owner?.full_name || "—"}</p>
                <p className="text-muted-foreground">{data.est?.email || "—"} · {data.owner?.phone || data.est?.phone || "—"}</p>
                <p><Badge variant="outline">{data.est?.subscription_plan}</Badge></p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1 text-sm">
                <div className="flex items-center gap-2 font-semibold mb-1"><Activity className="h-4 w-4" />Acesso</div>
                <p>Último acesso: <span className="font-medium">{data.access?.last_access_at ? formatDateTime(data.access.last_access_at) : "Nunca"}</span></p>
                <p>Última página: <span className="font-medium">{data.access?.last_page_accessed || "—"}</span></p>
                <p>Dias ativos no mês: {data.access?.days_active_this_month ?? 0}</p>
                <p>Sessões no mês: {data.access?.total_sessions_this_month ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1 text-sm">
                <div className="flex items-center gap-2 font-semibold mb-1"><Users className="h-4 w-4" />Clientes</div>
                <p>Total: <span className="font-medium">{data.clients?.total_clients ?? 0}</span></p>
                <p className="text-green-700">Cadastro completo: {data.clients?.clients_complete ?? 0} ({data.clients?.completion_percentage ?? 0}%)</p>
                <p className="text-orange-700">Pendentes de senha: {data.clients?.clients_pending ?? 0} ({data.clients?.pending_percentage ?? 0}%)</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 font-semibold text-sm mb-2"><BarChart3 className="h-4 w-4" />Acessos (últimos 7 dias)</div>
                <div className="flex items-end gap-2 h-24">
                  {data.weekly.map((w, i) => {
                    const max = Math.max(1, ...data.weekly.map((d) => d.count));
                    const h = (w.count / max) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-primary/20 rounded-t" style={{ height: `${h}%`, minHeight: w.count ? 4 : 2 }}>
                          <div className="w-full h-full bg-primary rounded-t" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{w.day}</span>
                        <span className="text-[10px]">{w.count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="font-semibold text-sm mb-2">Páginas mais acessadas (7d)</div>
                {data.topPages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem registros.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {data.topPages.map((p) => (
                      <li key={p.page_name} className="flex justify-between">
                        <span>{p.page_name}</span>
                        <span className="text-muted-foreground">{p.count} ({p.pct}%)</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
