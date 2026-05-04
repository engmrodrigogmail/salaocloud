import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Upload, CheckCircle2, Pencil, Loader2, Camera, Image as ImageIcon, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEduAccess } from "@/hooks/useEduAccess";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NewClientDialog } from "@/components/clients/NewClientDialog";
import eduSignature from "@/assets/edu-signature.png";

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
  client_self_assessment: string | null;
  client_expected_result: string | null;
  edu_personal_response: string | null;
  client?: { name: string } | null;
}

const PHOTO_LABELS = ["Comprimento", "Pontas", "Raiz"];
const MAX_CHARS = 2000;

export default function PortalEdu() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [estId, setEstId] = useState<string | null>(null);
  const { isActive, loading: accessLoading } = useEduAccess(estId);

  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientList, setShowClientList] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);

  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null]);
  const [selfAssessment, setSelfAssessment] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [statusStep, setStatusStep] = useState<"idle" | "uploading" | "processing" | "done">("idle");
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const galleryRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cameraRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [clients, clientSearch]);

  const pending = useMemo(() => profiles.filter((p) => !p.is_validated), [profiles]);
  const history = useMemo(() => profiles.filter((p) => p.is_validated), [profiles]);

  const handlePhoto = (idx: number, file: File | null) => {
    const next = [...photos];
    next[idx] = file;
    setPhotos(next);
  };

  const resetForm = () => {
    setSelectedClient(null);
    setClientSearch("");
    setPhotos([null, null, null]);
    setSelfAssessment("");
    setExpectedResult("");
    setStatusStep("idle");
    setUploadProgress({ current: 0, total: 0 });
    setErrorMsg(null);
  };

  const submitAnalysis = async () => {
    setErrorMsg(null);
    if (!estId || !selectedClient) {
      const m = "Selecione uma cliente antes de continuar.";
      setErrorMsg(m);
      toast.error(m, { position: "top-center", duration: 2500 });
      return;
    }
    const valid = photos.filter(Boolean) as File[];
    if (valid.length === 0) {
      const m = "Envie ao menos 1 foto para análise.";
      setErrorMsg(m);
      toast.error(m, { position: "top-center", duration: 2500 });
      return;
    }
    setAnalyzing(true);
    setStatusStep("uploading");
    setUploadProgress({ current: 0, total: valid.length });
    const uploadToastId = toast.loading(`Enviando fotos (0/${valid.length})...`, { position: "top-center" });
    try {
      const photoPaths: string[] = [];
      let uploaded = 0;
      for (let i = 0; i < photos.length; i++) {
        const f = photos[i];
        if (!f) continue;
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${estId}/${selectedClient.id}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("temp-analysis").upload(path, f, {
          contentType: f.type || "image/jpeg",
        });
        if (upErr) {
          throw new Error(`Falha no upload da foto ${i + 1}: ${upErr.message}`);
        }
        photoPaths.push(path);
        uploaded += 1;
        setUploadProgress({ current: uploaded, total: valid.length });
        toast.loading(`Enviando fotos (${uploaded}/${valid.length})...`, { id: uploadToastId, position: "top-center" });
      }

      setStatusStep("processing");
      toast.loading("Edu está analisando as fotos... isso pode levar alguns segundos.", {
        id: uploadToastId,
        position: "top-center",
      });

      const { data, error } = await supabase.functions.invoke("analyze-hair-profile", {
        body: {
          client_id: selectedClient.id,
          establishment_id: estId,
          photo_paths: photoPaths,
          client_self_assessment: selfAssessment.slice(0, MAX_CHARS),
          client_expected_result: expectedResult.slice(0, MAX_CHARS),
        },
      });
      if (error) throw new Error(error.message || "Falha ao chamar o serviço de análise.");
      const d: any = data;
      if (d?.error) {
        const map: Record<string, string> = {
          unauthorized: "Sessão expirada. Faça login novamente.",
          invalid_token: "Sessão inválida. Faça login novamente.",
          forbidden: "Você não tem permissão para analisar neste salão.",
          edu_not_active: "O Consultor Edu não está ativo neste salão.",
          invalid_payload: "Dados inválidos enviados para análise.",
          photo_download_failed: "Não foi possível ler uma das fotos enviadas.",
          claude_error: "O serviço de IA está instável agora. Tente novamente em instantes.",
          ai_parse_failed: "A IA retornou um formato inesperado. Tente novamente.",
          insert_failed: "Não foi possível salvar o diagnóstico no banco de dados.",
        };
        throw new Error(map[d.error] || d.detail || d.error);
      }

      setStatusStep("done");
      toast.success("Análise concluída! Revise e valide o diagnóstico.", {
        id: uploadToastId,
        position: "top-center",
        duration: 2500,
      });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (e: any) {
      console.error("[Edu] submitAnalysis error", e);
      const msg = e?.message || "Erro desconhecido durante a análise.";
      setErrorMsg(msg);
      setStatusStep("idle");
      toast.error(msg, { id: uploadToastId, position: "top-center", duration: 4000 });
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
    toast.success("Diagnóstico aprovado", { position: "top-center", duration: 2000 });
    setReviewProfile(null);
    loadData();
  };

  const correct = async () => {
    if (!reviewProfile) return;
    if (!correction.trim()) {
      toast.error("Digite a correção", { position: "top-center", duration: 2000 });
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
    toast.success("Correção registrada — alimentando o aprendizado.", { position: "top-center", duration: 2000 });
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
            <TabsTrigger value="pending">Validação ({pending.length})</TabsTrigger>
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
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!analyzing) {
            setDialogOpen(o);
            if (!o) resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova análise capilar</DialogTitle>
            <DialogDescription>
              Busque a cliente, envie até 3 fotos e capture a percepção dela.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Busca de cliente com autocomplete */}
            <div className="relative">
              <div className="flex items-center justify-between">
                <Label>Cliente</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => setNewClientOpen(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Cadastrar balcão
                </Button>
              </div>
              {selectedClient ? (
                <div className="flex items-center justify-between mt-1 border rounded-md px-3 py-2 bg-muted/40">
                  <span className="font-medium text-sm">{selectedClient.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setSelectedClient(null);
                      setClientSearch("");
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientList(true);
                    }}
                    onFocus={() => setShowClientList(true)}
                    onBlur={() => setTimeout(() => setShowClientList(false), 150)}
                    placeholder="Digite para buscar..."
                    className="mt-1"
                  />
                  {showClientList && filteredClients.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-56 overflow-y-auto">
                      {filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedClient(c);
                            setClientSearch(c.name);
                            setShowClientList(false);
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {showClientList && clientSearch && filteredClients.length === 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground">
                      Nenhuma cliente encontrada. Use "Cadastrar balcão" acima.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Fotos: galeria ou câmera */}
            <div className="grid gap-3">
              {PHOTO_LABELS.map((label, i) => (
                <div key={i} className="space-y-1">
                  <Label>{label}</Label>
                  <input
                    ref={(el) => (galleryRefs.current[i] = el)}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhoto(i, e.target.files?.[0] ?? null)}
                  />
                  <input
                    ref={(el) => (cameraRefs.current[i] = el)}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handlePhoto(i, e.target.files?.[0] ?? null)}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => galleryRefs.current[i]?.click()}
                    >
                      <ImageIcon className="h-4 w-4" /> Galeria
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => cameraRefs.current[i]?.click()}
                    >
                      <Camera className="h-4 w-4" /> Câmera
                    </Button>
                  </div>
                  {photos[i] && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate">✓ {photos[i]!.name}</span>
                      <button
                        type="button"
                        className="text-destructive hover:underline"
                        onClick={() => handlePhoto(i, null)}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Auto-percepção da cliente */}
            <div className="space-y-1">
              <Label htmlFor="self-assess">Comente rapidamente sobre o estado atual do seu cabelo</Label>
              <Textarea
                id="self-assess"
                value={selfAssessment}
                onChange={(e) => setSelfAssessment(e.target.value.slice(0, MAX_CHARS))}
                rows={3}
                placeholder="Ex.: Cabelo ressecado nas pontas, com frizz após a química..."
              />
              <div className="text-right text-xs text-muted-foreground">
                {selfAssessment.length} de {MAX_CHARS}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="expected-result">Qual o principal resultado esperado para seu cabelo?</Label>
              <Textarea
                id="expected-result"
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value.slice(0, MAX_CHARS))}
                rows={3}
                placeholder="Ex.: Recuperar o brilho e reduzir o volume, mantendo cachos definidos..."
              />
              <div className="text-right text-xs text-muted-foreground">
                {expectedResult.length} de {MAX_CHARS}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              As fotos são apagadas após validação ou em até 48h (LGPD). Apenas o diagnóstico em texto é mantido.
            </p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {statusStep !== "idle" && analyzing && (
              <div className="w-full text-xs text-muted-foreground flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {statusStep === "uploading" &&
                  `Enviando fotos (${uploadProgress.current}/${uploadProgress.total})...`}
                {statusStep === "processing" && "Edu está analisando... aguarde."}
              </div>
            )}
            {errorMsg && !analyzing && (
              <div className="w-full text-xs text-destructive border border-destructive/40 rounded-md px-3 py-2 bg-destructive/10">
                {errorMsg}
              </div>
            )}
            <div className="flex gap-2 w-full justify-end">
              <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={analyzing}>
                Cancelar
              </Button>
              <Button onClick={submitAnalysis} disabled={analyzing} className="gap-2">
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {statusStep === "uploading"
                  ? "Enviando fotos..."
                  : statusStep === "processing"
                  ? "Analisando..."
                  : "Analisar com Edu"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cadastro rápido de cliente balcão */}
      {estId && (
        <NewClientDialog
          open={newClientOpen}
          onOpenChange={setNewClientOpen}
          establishmentId={estId}
          onCreated={(c) => {
            if (c) {
              const created: Client = { id: c.id, name: c.name };
              setClients((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
              setSelectedClient(created);
              setClientSearch(created.name);
            }
          }}
        />
      )}

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
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{reviewProfile.technical_explanation}</p>
                </div>
              )}

              {(reviewProfile.client_self_assessment || reviewProfile.client_expected_result) && (
                <div className="border rounded-md p-3 bg-muted/30 space-y-2">
                  <div className="text-sm font-semibold">Relato da cliente</div>
                  {reviewProfile.client_self_assessment && (
                    <div>
                      <div className="text-xs text-muted-foreground">Estado atual</div>
                      <p className="text-sm whitespace-pre-line">{reviewProfile.client_self_assessment}</p>
                    </div>
                  )}
                  {reviewProfile.client_expected_result && (
                    <div>
                      <div className="text-xs text-muted-foreground">Resultado esperado</div>
                      <p className="text-sm whitespace-pre-line">{reviewProfile.client_expected_result}</p>
                    </div>
                  )}
                </div>
              )}

              {reviewProfile.edu_personal_response && (
                <div className="border rounded-md p-4 bg-primary/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Edu e você</span>
                  </div>
                  <p className="text-sm whitespace-pre-line">{reviewProfile.edu_personal_response}</p>
                  <div className="pt-2 flex justify-end">
                    <img
                      src={eduSignature}
                      alt="Assinatura de Edu Valentim"
                      className="h-12 object-contain opacity-90 dark:invert dark:opacity-80"
                    />
                  </div>
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
