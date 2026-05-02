import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Upload, CheckCircle2, Pencil, Loader2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEduAccess } from "@/hooks/useEduAccess";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: string;
  name: string;
}
interface Profile {
  id: string;
  client_id: string;
  hair_type: string | null;
  porosity_level: string | null;
  damage_level: string | null;
  identified_issues: any;
  technical_explanation: string | null;
  confidence_score: number | null;
  is_validated: boolean;
  professional_correction: string | null;
  photo_urls: any;
  photos_purged: boolean;
  created_at: string;
  validated_at: string | null;
  client?: { name: string } | null;
}

const PHOTO_LABELS = ["Comprimento", "Pontas", "Raiz"];

export default function PortalEdu() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [estId, setEstId] = useState<string | null>(null);
  const { isActive, loading: accessLoading } = useEduAccess(estId);

  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null]);
  const [analyzing, setAnalyzing] = useState(false);

  const [reviewProfile, setReviewProfile] = useState<Profile | null>(null);
  const [correction, setCorrection] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const { data } = await supabase.from("establishments").select("id").eq("slug", slug).maybeSingle();
      setEstId(data?.id ?? null);
    })();
  }, [slug]);

  useEffect(() => {
    if (!estId || !isActive) return;
    loadData();
  }, [estId, isActive]);

  const loadData = async () => {
    if (!estId) return;
    setLoading(true);
    const [{ data: cl }, { data: pr }] = await Promise.all([
      supabase.from("clients").select("id, name").eq("establishment_id", estId).order("name"),
      supabase
        .from("client_hair_profiles")
        .select("*, client:clients(name)")
        .eq("establishment_id", estId)
        .order("created_at", { ascending: false }),
    ]);
    setClients(cl ?? []);
    setProfiles((pr as any) ?? []);
    setLoading(false);
  };

  const pending = useMemo(() => profiles.filter((p) => !p.is_validated), [profiles]);
  const history = useMemo(() => profiles.filter((p) => p.is_validated), [profiles]);

  const handlePhoto = (idx: number, file: File | null) => {
    const next = [...photos];
    next[idx] = file;
    setPhotos(next);
  };

  const submitAnalysis = async () => {
    if (!estId || !selectedClientId) {
      toast.error("Selecione um cliente");
      return;
    }
    const valid = photos.filter(Boolean) as File[];
    if (valid.length === 0) {
      toast.error("Envie ao menos 1 foto");
      return;
    }
    setAnalyzing(true);
    try {
      const photoPaths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const f = photos[i];
        if (!f) continue;
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${estId}/${selectedClientId}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("temp-analysis").upload(path, f, {
          contentType: f.type || "image/jpeg",
        });
        if (upErr) throw upErr;
        photoPaths.push(path);
      }

      const { data, error } = await supabase.functions.invoke("analyze-hair-profile", {
        body: { client_id: selectedClientId, establishment_id: estId, photo_paths: photoPaths },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success("Análise concluída! Revise e valide o diagnóstico.");
      setDialogOpen(false);
      setSelectedClientId("");
      setPhotos([null, null, null]);
      loadData();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao analisar: " + (e.message || "desconhecido"));
    } finally {
      setAnalyzing(false);
    }
  };

  const approve = async (p: Profile) => {
    setSavingReview(true);
    const { error } = await supabase
      .from("client_hair_profiles")
      .update({
        is_validated: true,
        validated_by: user?.id ?? null,
        validated_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    setSavingReview(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Diagnóstico aprovado");
    setReviewProfile(null);
    loadData();
  };

  const correct = async () => {
    if (!reviewProfile) return;
    if (!correction.trim()) {
      toast.error("Digite a correção");
      return;
    }
    setSavingReview(true);
    const { error } = await supabase
      .from("client_hair_profiles")
      .update({
        is_validated: true,
        professional_correction: correction.trim(),
        validated_by: user?.id ?? null,
        validated_at: new Date().toISOString(),
      })
      .eq("id", reviewProfile.id);
    setSavingReview(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Correção registrada — alimentando o aprendizado.");
    setReviewProfile(null);
    setCorrection("");
    loadData();
  };

  if (accessLoading) {
    return (
      <PortalLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PortalLayout>
    );
  }

  if (!isActive) {
    return (
      <PortalLayout>
        <Card>
          <CardHeader>
            <CardTitle>Consultor Edu indisponível</CardTitle>
            <CardDescription>
              O acesso ao Consultor Edu não está liberado para este salão. Entre em contato com o suporte.
            </CardDescription>
          </CardHeader>
        </Card>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Consultor Edu</h1>
              <p className="text-muted-foreground text-sm">Análise capilar por IA com validação profissional.</p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Camera className="h-4 w-4" />
            Nova análise
          </Button>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Validação ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="history">Histórico ({history.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 mt-4">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            ) : pending.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhuma análise pendente.</p>
            ) : (
              pending.map((p) => (
                <Card key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setReviewProfile(p)}>
                  <CardContent className="pt-6 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold">{p.client?.name || "Cliente"}</div>
                      <div className="text-sm text-muted-foreground">
                        {p.hair_type} • {p.porosity_level} • {p.damage_level}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    <Badge variant="outline">Confiança {p.confidence_score ?? "-"}%</Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {history.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Sem histórico ainda.</p>
            ) : (
              history.map((p) => (
                <Card key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setReviewProfile(p)}>
                  <CardContent className="pt-6 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold">{p.client?.name || "Cliente"}</div>
                      <div className="text-sm text-muted-foreground">
                        {p.hair_type} • {p.porosity_level} • {p.damage_level}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Validado em {p.validated_at ? format(new Date(p.validated_at), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                      </div>
                    </div>
                    {p.professional_correction ? (
                      <Badge variant="secondary">Corrigido</Badge>
                    ) : (
                      <Badge className="bg-green-600">Aprovado</Badge>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal: Nova análise */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova análise capilar</DialogTitle>
            <DialogDescription>Selecione a cliente e envie até 3 fotos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <select
                className="w-full mt-1 border rounded-md p-2 bg-background"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3">
              {PHOTO_LABELS.map((label, i) => (
                <div key={i}>
                  <Label>{label}</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhoto(i, e.target.files?.[0] ?? null)}
                    className="mt-1"
                  />
                  {photos[i] && <p className="text-xs text-muted-foreground mt-1">✓ {photos[i]!.name}</p>}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              As fotos são apagadas após validação ou em até 48h (LGPD). Apenas o diagnóstico em texto é mantido.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={analyzing}>
              Cancelar
            </Button>
            <Button onClick={submitAnalysis} disabled={analyzing} className="gap-2">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {analyzing ? "Analisando..." : "Analisar com Edu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Revisão */}
      <Dialog open={!!reviewProfile} onOpenChange={(o) => !o && setReviewProfile(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>Diagnóstico — {reviewProfile?.client?.name}</DialogTitle>
            <DialogDescription>
              {reviewProfile && format(new Date(reviewProfile.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          {reviewProfile && (
            <div className="space-y-4">
              {!reviewProfile.photos_purged && Array.isArray(reviewProfile.photo_urls) && reviewProfile.photo_urls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {(reviewProfile.photo_urls as string[]).map((u, i) => (
                    <img key={i} src={u} alt={PHOTO_LABELS[i] || "foto"} className="rounded-md object-cover aspect-square" />
                  ))}
                </div>
              )}
              {reviewProfile.photos_purged && (
                <p className="text-xs text-muted-foreground">Fotos já foram removidas (LGPD).</p>
              )}
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="border rounded-md p-2">
                  <div className="text-xs text-muted-foreground">Tipo</div>
                  <div className="font-semibold">{reviewProfile.hair_type || "-"}</div>
                </div>
                <div className="border rounded-md p-2">
                  <div className="text-xs text-muted-foreground">Porosidade</div>
                  <div className="font-semibold">{reviewProfile.porosity_level || "-"}</div>
                </div>
                <div className="border rounded-md p-2">
                  <div className="text-xs text-muted-foreground">Dano</div>
                  <div className="font-semibold">{reviewProfile.damage_level || "-"}</div>
                </div>
              </div>
              {Array.isArray(reviewProfile.identified_issues) && reviewProfile.identified_issues.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-1">Problemas identificados</div>
                  <div className="flex flex-wrap gap-1">
                    {(reviewProfile.identified_issues as string[]).map((it, i) => (
                      <Badge key={i} variant="secondary">{it}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {reviewProfile.technical_explanation && (
                <div>
                  <div className="text-sm font-semibold mb-1">Explicação técnica</div>
                  <p className="text-sm text-muted-foreground">{reviewProfile.technical_explanation}</p>
                </div>
              )}
              {reviewProfile.professional_correction && (
                <div>
                  <div className="text-sm font-semibold mb-1">Correção do profissional</div>
                  <p className="text-sm">{reviewProfile.professional_correction}</p>
                </div>
              )}
              {!reviewProfile.is_validated && (
                <div>
                  <Label>Correção (opcional)</Label>
                  <Textarea
                    placeholder="Descreva a correção. Isso alimenta o aprendizado da IA."
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}
          {reviewProfile && !reviewProfile.is_validated && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={correct} disabled={savingReview} className="gap-2">
                <Pencil className="h-4 w-4" /> Corrigir
              </Button>
              <Button onClick={() => approve(reviewProfile)} disabled={savingReview} className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Aprovar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
