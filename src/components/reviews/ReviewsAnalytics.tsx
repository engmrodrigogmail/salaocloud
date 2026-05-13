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
import { Star, Loader2, MessageSquare, TrendingUp, Users, ExternalLink, Scissors, Clock, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

type TabItem = {
  id: string;
  tab_id: string;
  service_id: string | null;
  product_id: string | null;
  professional_id: string | null;
  name: string;
};

type PendingReview = {
  id: string;
  tab_id: string;
  client_id: string | null;
  created_at: string;
  clients?: { id: string; name: string } | null;
};

interface DashboardData {
  reviews: ReviewRow[];
  profRatings: ProfRating[];
  professionals: { id: string; name: string; photo_url: string | null }[];
  services: { id: string; name: string }[];
  items: TabItem[];
  pending: PendingReview[];
  slug: string | null;
}

export function ReviewsDashboard({ establishmentId, settings }: { establishmentId: string; settings: any }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<"7" | "30" | "90" | "all">("30");
  const [profFilter, setProfFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [resending, setResending] = useState<Record<string, boolean>>({});

  const showComments = !!settings?.show_comments_on_dashboard;
  const showProfRatings = !!settings?.show_professional_ratings;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since =
        period === "all" ? null : subDays(new Date(), parseInt(period, 10)).toISOString();

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
      const reviewRows = (reviews ?? []) as any as ReviewRow[];
      const tabIds = reviewRows.map((r) => r.tab_id);
      const reviewIds = reviewRows.map((r) => r.id);

      let pendingQ = supabase
        .from("tab_reviews")
        .select("id, tab_id, client_id, created_at, clients(id, name)")
        .eq("establishment_id", establishmentId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (since) pendingQ = pendingQ.gte("created_at", since);

      const [{ data: profRatings }, { data: professionals }, { data: services }, { data: items }, { data: pending }, { data: est }] = await Promise.all([
        showProfRatings && reviewIds.length
          ? supabase.from("tab_review_professionals").select("*").in("tab_review_id", reviewIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("professionals").select("id, name, photo_url").eq("establishment_id", establishmentId),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId),
        tabIds.length
          ? supabase.from("tab_items").select("id, tab_id, service_id, product_id, professional_id, name").in("tab_id", tabIds)
          : Promise.resolve({ data: [] as any[] }),
        pendingQ,
        supabase.from("establishments").select("slug").eq("id", establishmentId).maybeSingle(),
      ]);

      setData({
        reviews: reviewRows,
        profRatings: (profRatings ?? []) as any,
        professionals: (professionals ?? []) as any,
        services: (services ?? []) as any,
        items: (items ?? []) as any,
        pending: (pending ?? []) as any,
        slug: est?.slug ?? null,
      });
      setLoading(false);
    })();
  }, [establishmentId, period, showComments, showProfRatings]);

  // Apply profissional/serviço filters at the review-set level
  const filteredReviews = useMemo(() => {
    if (!data) return [];
    let revs = data.reviews;
    if (profFilter !== "all") {
      const okIds = new Set(data.profRatings.filter((p) => p.professional_id === profFilter).map((p) => p.tab_review_id));
      revs = revs.filter((r) => okIds.has(r.id));
    }
    if (serviceFilter !== "all") {
      const okTabs = new Set(data.items.filter((i) => i.service_id === serviceFilter).map((i) => i.tab_id));
      revs = revs.filter((r) => okTabs.has(r.tab_id));
    }
    return revs;
  }, [data, profFilter, serviceFilter]);

  const metrics = useMemo(() => {
    if (!data) return null;
    const reviewIds = new Set(filteredReviews.map((r) => r.id));
    const tabIds = new Set(filteredReviews.map((r) => r.tab_id));
    const filteredProfRatings = data.profRatings.filter((p) => reviewIds.has(p.tab_review_id));
    const filteredItems = data.items.filter((i) => tabIds.has(i.tab_id));

    const clientRatings = filteredReviews.map((r) => r.client_rating).filter((r): r is number => !!r);
    const salonRatings = filteredReviews.map((r) => r.salon_rating).filter((r): r is number => !!r);
    const total = clientRatings.length;
    const avgClient = total ? clientRatings.reduce((a, b) => a + b, 0) / total : 0;

    // Nota global consolidada: média simples de TODAS as notas registradas
    // (cliente do salão + cada profissional + cada salão_rating interno)
    const allRatings = [...clientRatings, ...filteredProfRatings.map((p) => p.rating), ...salonRatings];
    const avgGlobal = allRatings.length ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0;

    const dist = [1, 2, 3, 4, 5].map((n) => ({
      n,
      count: clientRatings.filter((r) => r === n).length,
    }));
    const fiveStarPct = total ? (dist[4].count / total) * 100 : 0;

    // Top profissionais
    const byProf = new Map<string, { sum: number; count: number }>();
    for (const pr of filteredProfRatings) {
      const cur = byProf.get(pr.professional_id) ?? { sum: 0, count: 0 };
      cur.sum += pr.rating;
      cur.count += 1;
      byProf.set(pr.professional_id, cur);
    }
    const profStats = Array.from(byProf.entries())
      .map(([pid, v]) => ({
        professional: data.professionals.find((p) => p.id === pid),
        avg: v.count ? v.sum / v.count : 0,
        count: v.count,
      }))
      .filter((p) => p.professional)
      .sort((a, b) => (b.avg - a.avg) || (b.count - a.count));

    // Top serviços: nota média do cliente das comandas que continham o serviço
    const ratingByTab = new Map<string, number>();
    for (const r of filteredReviews) if (r.client_rating) ratingByTab.set(r.tab_id, r.client_rating);
    const bySvc = new Map<string, { sum: number; count: number }>();
    const seen = new Set<string>(); // evita contar o mesmo serviço múltiplas vezes na mesma comanda
    for (const it of filteredItems) {
      if (!it.service_id) continue;
      const key = `${it.tab_id}:${it.service_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const r = ratingByTab.get(it.tab_id);
      if (!r) continue;
      const cur = bySvc.get(it.service_id) ?? { sum: 0, count: 0 };
      cur.sum += r;
      cur.count += 1;
      bySvc.set(it.service_id, cur);
    }
    const svcStats = Array.from(bySvc.entries())
      .map(([sid, v]) => ({
        service: data.services.find((s) => s.id === sid),
        avg: v.count ? v.sum / v.count : 0,
        count: v.count,
      }))
      .filter((s) => s.service)
      .sort((a, b) => (b.avg - a.avg) || (b.count - a.count));

    // Comentários recentes (últimos 5 com texto)
    const recentComments = filteredReviews
      .filter((r) => r.client_comment && r.client_comment.trim().length > 0)
      .slice(0, 5);

    return { total, avgClient, avgGlobal, dist, fiveStarPct, profStats, svcStats, recentComments };
  }, [data, filteredReviews]);

  const resendNotification = async (review: PendingReview) => {
    if (!review.client_id || !data?.slug) return;
    setResending((r) => ({ ...r, [review.id]: true }));
    const rewardSnippet = settings?.reward_enabled && settings?.reward_description
      ? `Preencha nossa avaliação e ganhe ${settings.reward_description}.`
      : "Adoraríamos saber como foi sua experiência. Leva menos de 1 minuto 😉";
    const { error } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: review.client_id,
      sender_type: "establishment",
      sender_id: establishmentId,
      title: "Lembrete: como foi sua experiência?",
      body: rewardSnippet,
      link: `/${data.slug}/avaliar/${review.id}`,
      data: { category: "review_request_resend", tab_review_id: review.id, tab_id: review.tab_id },
    });
    setResending((r) => ({ ...r, [review.id]: false }));
    if (error) {
      toast.error("Erro ao reenviar: " + error.message, { position: "top-center", duration: 2000 });
      return;
    }
    toast.success("Lembrete enviado", { position: "top-center", duration: 2000 });
  };

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
      {/* Filtros */}
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
        <Select value={profFilter} onValueChange={setProfFilter} disabled={!showProfRatings}>
          <SelectTrigger><SelectValue placeholder="Profissional" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos profissionais</SelectItem>
            {data.professionals.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger><SelectValue placeholder="Serviço" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos serviços</SelectItem>
            {data.services.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {metrics.total === 0 && data.pending.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma avaliação no período selecionado.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cards de métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon={<Star className="h-5 w-5" />}
              label="Nota global"
              value={metrics.avgGlobal.toFixed(1)}
              suffix="/ 5"
              hint="Média de todas as notas (salão + profissionais)"
            />
            <MetricCard
              icon={<Star className="h-5 w-5" />}
              label="Nota do salão"
              value={metrics.avgClient.toFixed(1)}
              suffix="/ 5"
            />
            <MetricCard
              icon={<MessageSquare className="h-5 w-5" />}
              label="Avaliações"
              value={String(metrics.total)}
              hint={`${metrics.fiveStarPct.toFixed(0)}% deram 5★`}
            />
            <MetricCard
              icon={<Clock className="h-5 w-5" />}
              label="Pendentes"
              value={String(data.pending.length)}
              hint="Aguardando cliente responder"
            />
          </div>

          {/* Distribuição */}
          {metrics.total > 0 && (
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
          )}

          {/* Top profissionais e serviços lado a lado em desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {showProfRatings && metrics.profStats.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Top 5 profissionais
                  </h3>
                  <div className="space-y-3">
                    {metrics.profStats.slice(0, 5).map((p, idx) => (
                      <div key={p.professional!.id} className="flex items-center gap-3">
                        <div className="w-5 text-center text-xs font-bold text-muted-foreground">{idx + 1}º</div>
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

            {metrics.svcStats.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Scissors className="h-4 w-4" /> Top 5 serviços
                  </h3>
                  <div className="space-y-3">
                    {metrics.svcStats.slice(0, 5).map((s, idx) => (
                      <div key={s.service!.id} className="flex items-center gap-3">
                        <div className="w-5 text-center text-xs font-bold text-muted-foreground">{idx + 1}º</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{s.service!.name}</div>
                          <div className="text-xs text-muted-foreground">{s.count} comanda(s)</div>
                        </div>
                        <div className="flex items-center gap-1 font-semibold">
                          {settings?.show_numeric_rating && <span>{s.avg.toFixed(1)}</span>}
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Comentários recentes */}
          {showComments && metrics.recentComments.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Comentários recentes
                </h3>
                <div className="space-y-3">
                  {metrics.recentComments.map((r) => (
                    <div key={r.id} className="border-l-2 border-primary/40 pl-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{r.clients?.name ?? "Cliente"}</span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className={`h-3 w-3 ${
                                (r.client_rating ?? 0) >= n
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm italic text-muted-foreground">"{r.client_comment}"</p>
                      {r.client_submitted_at && (
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(r.client_submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pendentes */}
          {data.pending.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Avaliações pendentes
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Comandas fechadas cujos clientes ainda não responderam.
                </p>
                <div className="space-y-2">
                  {data.pending.slice(0, 10).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{p.clients?.name ?? "Cliente"}</div>
                        <div className="text-xs text-muted-foreground">
                          Fechada em {format(parseISO(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!p.client_id || resending[p.id]}
                        onClick={() => resendNotification(p)}
                        className="gap-1 shrink-0"
                      >
                        {resending[p.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Reenviar
                      </Button>
                    </div>
                  ))}
                  {data.pending.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{data.pending.length - 10} pendentes
                    </p>
                  )}
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
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
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
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const PAGE_SIZE = 20;

export function ReviewsHistory({ establishmentId, settings }: { establishmentId: string; settings: any }) {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [profRatings, setProfRatings] = useState<ProfRating[]>([]);
  const [professionals, setProfessionals] = useState<{ id: string; name: string; photo_url: string | null }[]>([]);
  const [period, setPeriod] = useState<"7" | "30" | "90" | "all">("30");
  const [profFilter, setProfFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const showComments = !!settings?.show_comments_on_dashboard;
  const showProfRatings = !!settings?.show_professional_ratings;

  // Reset filter if toggle is turned off
  useEffect(() => {
    if (!showProfRatings && profFilter !== "all") setProfFilter("all");
  }, [showProfRatings, profFilter]);

  const selectCols = useMemo(() => [
    "id", "tab_id", "client_id", "status", "client_rating",
    showComments ? "client_comment" : null,
    "client_submitted_at", "salon_rating",
    showComments ? "salon_comment" : null,
    "reward_coupon_id", "created_at", "clients(id, name)",
  ].filter(Boolean).join(", "), [showComments]);

  const fetchPage = async (pageIndex: number, append: boolean, currentReviews: ReviewRow[]) => {
    if (append) setLoadingMore(true); else setLoading(true);
    const since =
      period === "all" ? null : subDays(new Date(), parseInt(period, 10)).toISOString();

    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from("tab_reviews")
      .select(selectCols, append ? undefined : { count: "exact" })
      .eq("establishment_id", establishmentId)
      .eq("status", "submitted")
      .order("client_submitted_at", { ascending: false })
      .range(from, to);
    if (since) q = q.gte("client_submitted_at", since);
    if (ratingFilter !== "all") q = q.eq("client_rating", parseInt(ratingFilter, 10));

    const { data: rev, count } = await q;
    const newRows = (rev ?? []) as any as ReviewRow[];
    const merged = append ? [...currentReviews, ...newRows] : newRows;

    const ids = merged.map((r) => r.id);
    const [{ data: pr }, { data: profs }] = await Promise.all([
      showProfRatings && ids.length
        ? supabase.from("tab_review_professionals").select("*").in("tab_review_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      showProfRatings && (!append || professionals.length === 0)
        ? supabase.from("professionals").select("id, name, photo_url").eq("establishment_id", establishmentId)
        : Promise.resolve({ data: professionals as any[] }),
    ]);

    setReviews(merged);
    setProfRatings((pr ?? []) as any);
    setProfessionals((profs ?? []) as any);
    setHasMore(newRows.length === PAGE_SIZE);
    if (!append && typeof count === "number") setTotalCount(count);
    setLoading(false);
    setLoadingMore(false);
  };

  // Reset and load first page when filters/toggles change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchPage(0, false, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId, period, ratingFilter, showComments, showProfRatings]);

  const loadMore = async () => {
    const next = page + 1;
    setPage(next);
    await fetchPage(next, true, reviews);
  };

  const filtered = useMemo(() => {
    if (profFilter === "all") return reviews;
    const ids = new Set(profRatings.filter((p) => p.professional_id === profFilter).map((p) => p.tab_review_id));
    return reviews.filter((r) => ids.has(r.id));
  }, [reviews, profRatings, profFilter]);

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 ${showProfRatings ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-2`}>
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
        {showProfRatings && (
          <Select value={profFilter} onValueChange={setProfFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos profissionais</SelectItem>
              {professionals.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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

          <div className="flex flex-col items-center gap-2 pt-2">
            {totalCount !== null && (
              <p className="text-xs text-muted-foreground">
                Exibindo {filtered.length} de {totalCount} avaliação(ões)
                {profFilter !== "all" && " (filtrado por profissional)"}
              </p>
            )}
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando...</>
                ) : (
                  "Carregar mais"
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
