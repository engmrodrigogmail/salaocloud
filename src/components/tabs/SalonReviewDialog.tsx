import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  tabId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function SalonReviewDialog({ tabId, open, onOpenChange, onSubmitted }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("");
  const [existingRating, setExistingRating] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: review } = await supabase
        .from("tab_reviews")
        .select("id, salon_rating, salon_comment")
        .eq("tab_id", tabId)
        .maybeSingle();
      const { data: tab } = await supabase
        .from("tabs")
        .select("client_name")
        .eq("id", tabId)
        .maybeSingle();
      setClientName(tab?.client_name ?? "o cliente");
      if (review) {
        setReviewId(review.id);
        setExistingRating(review.salon_rating);
        setRating(review.salon_rating ?? 0);
        setComment(review.salon_comment ?? "");
      }
      setLoading(false);
    })();
  }, [open, tabId]);

  const submit = async () => {
    if (!reviewId) {
      toast.error("Avaliação não disponível para esta comanda", { position: "top-center", duration: 2000 });
      return;
    }
    if (rating < 1) {
      toast.error("Dê uma nota de 1 a 5", { position: "top-center", duration: 2000 });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("tab_reviews")
      .update({
        salon_rating: rating,
        salon_comment: comment.trim() || null,
        salon_submitted_at: new Date().toISOString(),
        salon_submitted_by: user?.id ?? null,
      })
      .eq("id", reviewId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message, { position: "top-center", duration: 2000 });
      return;
    }
    toast.success("Avaliação registrada", { position: "top-center", duration: 2000 });
    onSubmitted?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avaliar cliente</DialogTitle>
          <DialogDescription>
            Registre sua percepção sobre {clientName}. Esta avaliação é interna do salão.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !reviewId ? (
          <p className="text-sm text-muted-foreground py-4">
            Esta comanda não gerou registro de avaliação. Verifique se o sistema está habilitado em
            "Avaliações &gt; Configurações".
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-1 transition-transform hover:scale-110"
                  aria-label={`${n} estrelas`}
                >
                  <Star
                    className={`h-9 w-9 ${
                      n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Comentário interno (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
            />
            {existingRating != null && (
              <p className="text-xs text-muted-foreground">
                Esta comanda já tinha avaliação anterior — ao salvar, ela será substituída.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {reviewId && (
            <Button onClick={submit} disabled={saving || rating < 1}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar avaliação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
