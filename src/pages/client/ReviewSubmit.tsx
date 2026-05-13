import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Loader2, Check, Gift } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { readClientSession } from "@/lib/clientSession";
import { ReviewSubmitSuccess } from "@/components/reviews/ReviewSubmitSuccess";

type Professional = {
  id: string;
  professional_id: string;
  rating: number | null;
  comment: string | null;
  professional: { id: string; name: string; photo_url: string | null } | null;
};

export default function ClientReviewSubmit() {
  const { slug, reviewId } = useParams<{ slug: string; reviewId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [establishment, setEstablishment] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [salonRating, setSalonRating] = useState(0);
  const [salonComment, setSalonComment] = useState("");
  const [profRatings, setProfRatings] = useState<Record<string, { rating: number; comment: string }>>({});
  const [done, setDone] = useState<{ coupon: any; google_url: string | null; rating: number } | null>(null);

  const session = useMemo(() => (slug ? readClientSession(slug) : null), [slug]);

  useEffect(() => {
    (async () => {
      if (!reviewId || !slug) return;
      if (!session?.sessionToken) {
        navigate(`/cliente?redirect=${encodeURIComponent(`/${slug}/avaliar/${reviewId}`)}`);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("client-review-get", {
        body: { review_id: reviewId },
        headers: { "x-client-session": session.sessionToken },
      });
      if (error || data?.error) {
        setError(data?.error || error?.message || "Erro ao carregar avaliação");
        setLoading(false);
        return;
      }
      setEstablishment(data.establishment);
      setSettings(data.settings);
      setProfessionals(data.professionals || []);
      if (data.review.status === "submitted") {
        setAlreadySubmitted(true);
      }
      setLoading(false);
    })();
  }, [reviewId, slug, session?.sessionToken, navigate]);

  const submit = async () => {
    if (salonRating < 1) {
      toast.error("Dê uma nota geral de 1 a 5", { position: "top-center", duration: 2000 });
      return;
    }
    if (!session?.sessionToken) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("client-review-submit", {
      body: {
        review_id: reviewId,
        rating: salonRating,
        comment: salonComment.trim() || undefined,
        professionals: professionals.map((p) => ({
          professional_id: p.professional_id,
          rating: profRatings[p.professional_id]?.rating || 0,
          comment: profRatings[p.professional_id]?.comment?.trim() || undefined,
        })).filter((p) => p.rating > 0),
      },
      headers: { "x-client-session": session.sessionToken },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Erro ao enviar", { position: "top-center", duration: 2000 });
      return;
    }
    setDone({ coupon: data.coupon, google_url: data.google_url });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-muted-foreground">{error}</p>
            <Button asChild variant="outline">
              <Link to={`/${slug}`}>Voltar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadySubmitted && !done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <Check className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Avaliação já enviada</h2>
            <p className="text-muted-foreground text-sm">Obrigado pelo seu feedback!</p>
            <Button asChild>
              <Link to={`/${slug}`}>Voltar para o salão</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Obrigado!</h2>
            <p className="text-muted-foreground">Sua avaliação ajuda muito o {establishment?.name}.</p>

            {done.coupon && (
              <div className="border-2 border-dashed border-primary rounded-lg p-4 bg-primary/5 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Sua recompensa</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {done.coupon.description}
                </p>
                <div className="font-mono text-2xl font-bold text-primary tracking-wider text-center py-2 bg-background rounded">
                  {done.coupon.code}
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Apresente este código no caixa na próxima visita.
                </p>
              </div>
            )}

            {done.google_url && (
              <div className="space-y-2">
                <p className="text-sm">Que tal compartilhar essa experiência no Google? ⭐⭐⭐⭐⭐</p>
                <Button asChild className="w-full gap-2">
                  <a href={done.google_url} target="_blank" rel="noopener noreferrer">
                    Avaliar no Google <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            )}

            <Button variant="outline" asChild className="w-full">
              <Link to={`/${slug}`}>Voltar para o salão</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl p-4 md:p-6 space-y-4">
        <div className="text-center space-y-2 py-4">
          {establishment?.logo_url && (
            <img src={establishment.logo_url} alt={establishment.name} className="h-16 mx-auto rounded-lg object-cover" />
          )}
          <h1 className="text-2xl md:text-3xl font-bold">Como foi sua experiência?</h1>
          <p className="text-muted-foreground text-sm">
            Sua opinião ajuda o {establishment?.name} a melhorar cada vez mais.
          </p>
          {settings?.reward_enabled && settings?.reward_description && (
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm px-3 py-1.5 rounded-full">
              <Gift className="h-4 w-4" />
              <span>Ganhe {settings.reward_description} ao avaliar</span>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Avaliação geral do salão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StarRow value={salonRating} onChange={setSalonRating} size="lg" />
            <Textarea
              placeholder="Conte como foi sua experiência (opcional)"
              value={salonComment}
              onChange={(e) => setSalonComment(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </CardContent>
        </Card>

        {professionals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Avalie os profissionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {professionals.map((p) => (
                <div key={p.professional_id} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={p.professional?.photo_url ?? undefined} />
                      <AvatarFallback>{p.professional?.name?.charAt(0) ?? "?"}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{p.professional?.name ?? "Profissional"}</div>
                  </div>
                  <StarRow
                    value={profRatings[p.professional_id]?.rating ?? 0}
                    onChange={(r) =>
                      setProfRatings((prev) => ({
                        ...prev,
                        [p.professional_id]: { rating: r, comment: prev[p.professional_id]?.comment ?? "" },
                      }))
                    }
                  />
                  <Textarea
                    placeholder="Comentário (opcional)"
                    value={profRatings[p.professional_id]?.comment ?? ""}
                    onChange={(e) =>
                      setProfRatings((prev) => ({
                        ...prev,
                        [p.professional_id]: {
                          rating: prev[p.professional_id]?.rating ?? 0,
                          comment: e.target.value,
                        },
                      }))
                    }
                    maxLength={300}
                    rows={2}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Button onClick={submit} disabled={submitting || salonRating < 1} className="w-full" size="lg">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Enviar avaliação
        </Button>
      </div>
    </div>
  );
}

function StarRow({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "md" | "lg";
}) {
  const cls = size === "lg" ? "h-10 w-10" : "h-7 w-7";
  return (
    <div className="flex items-center gap-1 justify-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-1 transition-transform hover:scale-110"
          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
        >
          <Star
            className={`${cls} ${
              n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
