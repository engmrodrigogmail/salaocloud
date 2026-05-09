import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Loader2, MessageSquare, TrendingUp, Users, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ReviewRow = {
  id: string;
  tab_id: string;
  client_id: string;
  status: string;
  client_rating: number | null;
  client_comment: string | null;
  client_submitted_at: string | null;
  salon_rating: number | null;
  salon_comment: string | null;
  reward_coupon_id: string | null;
  created_at: string;
  clients?: { id: string; name: string } | null;
};

type ProfRating = {
  id: string;
  tab_review_id: string;
  professional_id: string;
  rating: number;
  comment: string | null;
};

interface DashboardData {
  reviews: ReviewRow[];
  profRatings: ProfRating[];
  professionals: { id: string; name: string; photo_url: string | null }[];
}

export function ReviewsDashboard({ establishmentId, settings }: { establishmentId: string; settings: any }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<"7" | "30" | "90" | "all">("30");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since =
        period === "all" ? null : subDays(new Date(), parseInt(period, 10)).toISOString();
      // Respect visibility toggles at the query level — don't fetch what won't be shown
      const showComments = !!settings?.show_comments_on_dashboard;
      const showProfRatings = !!settings?.show_professional_ratings;
      const selectCols = [
        "id", "tab_id", "client_id", "status", "client_rating",
        showComments ? "client_comment" : null,
        "client_submitted_at", "salon_rating",
        showComments ? "salon_comment" : null,
        "reward_coupon_id", "created_at", "clients(id, name)",
      ].filter(Boolean).join(", ");

      let q = supabase
        .from("tab_reviews")
        .select(selectCols)
        .eq("establishment_id", establishmentId)
        .eq("status", "submitted")
        .order("client_submitted_at", { ascending: false });
      if (since) q = q.gte("client_submitted_at", since);
      const { data: reviews } = await q;
      const ids = (reviews ?? []).map((r: any) => r.id);
      const [{ data: profRatings }, { data: professionals }] = await Promise.all([
        showProfRatings && ids.length
          ? supabase.from("tab_review_professionals").select("*").in("tab_review_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        showProfRatings
          ? supabase.from("professionals").select("id, name, photo_url").eq("establishment_id", establishmentId)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      setData({
        reviews: (reviews ?? []) as any,
        profRatings: (profRatings ?? []) as any,
        professionals: (professionals ?? []) as any,
      });
      setLoading(false);
    })();
  }, [establishmentId, period, settings?.show_comments_on_dashboard, settings?.show_professional_ratings]);

  const metrics = useMemo(() => {
    if (!data) return null;
    const ratings = data.reviews.map((r) => r.client_rating).filter((r): r is number => !!r);
    const total = ratings.length;
    const avg = total ? ratings.reduce((a, b) => a + b, 0) / total : 0;
    const dist = [1, 2, 3, 4, 5].map((n) => ({
      n,
      count: ratings.filter((r) => r === n).length,
    }));
    const fiveStarPct = total ? (dist[4].count / total) * 100 : 0;

    // Per professional
    const byProf = new Map<string, { sum: number; count: number; comments: number }>();
    for (const pr of data.profRatings) {
      const cur = byProf.get(pr.professional_id) ?? { sum: 0, count: 0, comments: 0 };
      cur.sum += pr.rating;
      cur.count += 1;
      if (pr.comment) cur.comments += 1;
      byProf.set(pr.professional_id, cur);
    }
    const profStats = Array.from(byProf.entries())
      .map(([pid, v]) => ({
        professional: data.professionals.find((p) => p.id === pid),
        avg: v.count ? v.sum / v.count : 0,
        count: v.count,
      }))
      .filter((p) => p.professional)
      .sort((a, b) => b.avg - a.avg);

    return { total, avg, dist, fiveStarPct, profStats };
  }, [data]);

  if (loading || !metrics || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {metrics.total === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma avaliação no período selecionado.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricCard
              icon={<Star className="h-5 w-5" />}
              label="Nota média"
              value={metrics.avg.toFixed(1)}
              suffix="/ 5"
            />
            <MetricCard
              icon={<MessageSquare className="h-5 w-5" />}
              label="Avaliações"
              value={String(metrics.total)}
            />
            <MetricCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="5 estrelas"
              value={`${metrics.fiveStarPct.toFixed(0)}%`}
            />
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold mb-2">Distribuição de notas</h3>
              {metrics.dist.slice().reverse().map(({ n, count }) => {
                const pct = metrics.total ? (count / metrics.total) * 100 : 0;
                return (
                  <div key={n} className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1 w-12">
                      <span>{n}</span>
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {settings?.show_professional_ratings && metrics.profStats.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Profissionais
                </h3>
                <div className="space-y-3">
                  {metrics.profStats.map((p) => (
                    <div key={p.professional!.id} className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={p.professional!.photo_url ?? undefined} />
                        <AvatarFallback>{p.professional!.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.professional!.name}</div>
                        <div className="text-xs text-muted-foreground">{p.count} avaliação(ões)</div>
                      </div>
                      <div className="flex items-center gap-1 font-semibold">
                        {settings?.show_numeric_rating && <span>{p.avg.toFixed(1)}</span>}
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          {icon} {label}
        </div>
        <div className="text-2xl font-bold">
          {value}
          {suffix && <span className="text-base text-muted-foreground font-normal ml-1">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReviewsHistory({ establishmentId, settings }: { establishmentId: string; settings: any }) {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [profRatings, setProfRatings] = useState<ProfRating[]>([]);
  const [professionals, setProfessionals] = useState<{ id: string; name: string; photo_url: string | null }[]>([]);
  const [period, setPeriod] = useState<"7" | "30" | "90" | "all">("30");
  const [profFilter, setProfFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since =
        period === "all" ? null : subDays(new Date(), parseInt(period, 10)).toISOString();
      let q = supabase
        .from("tab_reviews")
        .select("id, tab_id, client_id, status, client_rating, client_comment, client_submitted_at, salon_rating, salon_comment, reward_coupon_id, created_at, clients(id, name)")
        .eq("establishment_id", establishmentId)
        .eq("status", "submitted")
        .order("client_submitted_at", { ascending: false })
        .limit(200);
      if (since) q = q.gte("client_submitted_at", since);
      if (ratingFilter !== "all") q = q.eq("client_rating", parseInt(ratingFilter, 10));
      const { data: rev } = await q;
      const ids = (rev ?? []).map((r) => r.id);
      const [{ data: pr }, { data: profs }] = await Promise.all([
        ids.length
          ? supabase.from("tab_review_professionals").select("*").in("tab_review_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("professionals").select("id, name, photo_url").eq("establishment_id", establishmentId),
      ]);
      setReviews((rev ?? []) as any);
      setProfRatings((pr ?? []) as any);
      setProfessionals((profs ?? []) as any);
      setLoading(false);
    })();
  }, [establishmentId, period, ratingFilter]);

  const filtered = useMemo(() => {
    if (profFilter === "all") return reviews;
    const ids = new Set(profRatings.filter((p) => p.professional_id === profFilter).map((p) => p.tab_review_id));
    return reviews.filter((r) => ids.has(r.id));
  }, [reviews, profRatings, profFilter]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
        <Select value={profFilter} onValueChange={setProfFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos profissionais</SelectItem>
            {professionals.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as notas</SelectItem>
            {[5, 4, 3, 2, 1].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} estrela{n > 1 ? "s" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhuma avaliação encontrada com esses filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const profs = profRatings.filter((p) => p.tab_review_id === r.id);
            return (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{r.clients?.name ?? "Cliente"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.client_submitted_at &&
                          format(parseISO(r.client_submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`h-4 w-4 ${
                            (r.client_rating ?? 0) >= n
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {settings?.show_comments_on_dashboard && r.client_comment && (
                    <p className="text-sm bg-muted/40 rounded p-2 italic">"{r.client_comment}"</p>
                  )}
                  {profs.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {profs.map((pr) => {
                        const prof = professionals.find((p) => p.id === pr.professional_id);
                        return (
                          <Badge key={pr.id} variant="outline" className="gap-1">
                            {prof?.name ?? "Profissional"}: {pr.rating}
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  {r.salon_rating && (
                    <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                      Avaliação interna do salão: {r.salon_rating}/5
                      {r.salon_comment && <span className="italic"> — "{r.salon_comment}"</span>}
                    </div>
                  )}
                  {r.reward_coupon_id && (
                    <Badge variant="secondary" className="gap-1">
                      <ExternalLink className="h-3 w-3" /> Cupom recompensa gerado
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
