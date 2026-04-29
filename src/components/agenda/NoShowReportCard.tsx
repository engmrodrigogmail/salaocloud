import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertOctagon, UserX } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

interface Props {
  establishmentId: string;
  /** Mínimo de faltas para o cliente entrar na lista de "reincidentes". Padrão: 2 */
  minNoShows?: number;
  /** Quantos clientes mostrar. Padrão: 5 */
  limit?: number;
}

interface Row {
  client_id: string;
  client_name: string;
  client_phone: string | null;
  no_show_count: number;
  total_finalized: number;
  no_show_rate_percent: number;
  last_no_show_at: string | null;
}

export function NoShowReportCard({ establishmentId, minNoShows = 2, limit = 5 }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalNoShowsLast30d, setTotalNoShowsLast30d] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("client_no_show_stats")
          .select("client_id, client_name, client_phone, no_show_count, total_finalized, no_show_rate_percent, last_no_show_at")
          .eq("establishment_id", establishmentId)
          .gte("no_show_count", minNoShows)
          .order("no_show_count", { ascending: false })
          .order("last_no_show_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        if (!active) return;
        setRows((data || []) as Row[]);

        // Total de faltas nos últimos 30 dias
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const { count } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("establishment_id", establishmentId)
          .eq("status", "no_show" as any)
          .gte("scheduled_at", since.toISOString());
        if (active) setTotalNoShowsLast30d(count || 0);
      } catch (err) {
        console.error("[NoShowReportCard] error:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [establishmentId, minNoShows, limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserX className="h-5 w-5 text-orange-600" />
          Faltas (no-show)
        </CardTitle>
        <CardDescription>
          {totalNoShowsLast30d} {totalNoShowsLast30d === 1 ? "falta" : "faltas"} nos últimos 30 dias.
          {rows.length > 0 && ` Top ${rows.length} reincidentes:`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cliente com {minNoShows}+ faltas. 🎉
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.client_id}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.client_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.client_phone || "sem telefone"}
                    {r.last_no_show_at && ` · última falta: ${formatDate(r.last_no_show_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                    {r.no_show_count}x
                  </Badge>
                  {r.no_show_rate_percent >= 50 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertOctagon className="h-3 w-3" />
                      {r.no_show_rate_percent}%
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
