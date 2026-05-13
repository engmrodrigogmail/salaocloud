import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Clock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ReviewsSummaryCard({ establishmentId, slug }: { establishmentId: string; slug: string }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [avg, setAvg] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: settings } = await supabase
        .from("review_settings")
        .select("reviews_enabled")
        .eq("establishment_id", establishmentId)
        .maybeSingle();
      const isOn = !!settings?.reviews_enabled;
      setEnabled(isOn);
      if (!isOn) {
        setLoading(false);
        return;
      }

      const [{ data: subs }, { count: pendCount }] = await Promise.all([
        supabase
          .from("tab_reviews")
          .select("client_rating")
          .eq("establishment_id", establishmentId)
          .eq("status", "submitted"),
        supabase
          .from("tab_reviews")
          .select("id", { count: "exact", head: true })
          .eq("establishment_id", establishmentId)
          .eq("status", "pending"),
      ]);
      const ratings = (subs ?? []).map((r: any) => r.client_rating).filter((r): r is number => !!r);
      setTotal(ratings.length);
      setAvg(ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null);
      setPending(pendCount ?? 0);
      setLoading(false);
    })();
  }, [establishmentId]);

  if (loading) {
    return <Skeleton className="h-32" />;
  }

  if (!enabled) {
    return (
      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            Avaliações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Ative o sistema de avaliações e descubra o que seus clientes acham do salão.
          </p>
          <Button asChild size="sm" variant="outline" className="gap-1">
            <Link to={`/portal/${slug}/avaliacoes`}>
              Configurar <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Avaliações</CardTitle>
        <Star className="h-4 w-4 text-yellow-500" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{avg !== null ? avg.toFixed(1) : "—"}</span>
          {avg !== null && <span className="text-sm text-muted-foreground">/ 5</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          {total} avaliação(ões) · {pending} pendente(s)
        </p>
        {pending > 0 && (
          <Button asChild variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs gap-1">
            <Link to={`/portal/${slug}/avaliacoes`}>
              <Clock className="h-3 w-3" /> Ver pendentes
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
