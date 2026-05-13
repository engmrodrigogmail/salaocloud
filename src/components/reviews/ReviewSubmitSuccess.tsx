import { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, ExternalLink, Gift, Sparkles, Heart } from "lucide-react";

interface Props {
  rating: number;
  salonName: string;
  slug: string;
  coupon: { code: string; description: string | null } | null;
  googleUrl: string | null;
}

export function ReviewSubmitSuccess({ rating, salonName, slug, coupon, googleUrl }: Props) {
  const { width, height } = useWindowSize();
  const isPerfect = rating === 5;
  const [showConfetti, setShowConfetti] = useState(isPerfect);

  useEffect(() => {
    if (!isPerfect) return;
    const t = setTimeout(() => setShowConfetti(false), 6000);
    return () => clearTimeout(t);
  }, [isPerfect]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          numberOfPieces={250}
          recycle={false}
          gravity={0.18}
          tweenDuration={6000}
        />
      )}
      <Card className={`max-w-md w-full ${isPerfect ? "border-yellow-400/50 shadow-lg shadow-yellow-400/10" : ""}`}>
        <CardContent className="p-6 text-center space-y-4">
          {isPerfect ? (
            <>
              <div className="flex items-center justify-center gap-1 text-4xl">
                🎉 <Sparkles className="h-8 w-8 text-yellow-500 fill-yellow-400 animate-pulse" /> 🎉
              </div>
              <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                Uau! Muito obrigado <Heart className="h-6 w-6 fill-red-500 text-red-500" />
              </h2>
              <p className="text-muted-foreground">
                Ficamos extremamente felizes em saber que você adorou sua experiência no{" "}
                <strong>{salonName}</strong>! Sua avaliação significa muito para toda a equipe.
              </p>
            </>
          ) : (
            <>
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Obrigado!</h2>
              <p className="text-muted-foreground">
                Sua avaliação ajuda muito o {salonName} a melhorar cada vez mais.
              </p>
            </>
          )}

          {coupon && (
            <div className="border-2 border-dashed border-primary rounded-lg p-4 bg-primary/5 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-5 w-5 text-primary" />
                <span className="font-semibold">Sua recompensa</span>
              </div>
              {coupon.description && (
                <p className="text-sm text-muted-foreground mb-2">{coupon.description}</p>
              )}
              <div className="font-mono text-2xl font-bold text-primary tracking-wider text-center py-2 bg-background rounded">
                {coupon.code}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Apresente este código no caixa na próxima visita.
              </p>
            </div>
          )}

          {isPerfect && googleUrl && (
            <div className="space-y-2 bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">
                Que tal compartilhar esse amor avaliando a gente no Google também? ⭐⭐⭐⭐⭐
              </p>
              <Button asChild className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <a href={googleUrl} target="_blank" rel="noopener noreferrer">
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
