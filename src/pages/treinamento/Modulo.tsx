import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TrainingLayout } from "@/components/training/TrainingLayout";
import { QuizComponent, QuizQuestion } from "@/components/training/QuizComponent";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTrainingSandbox, resolveSandboxPath } from "@/hooks/useTrainingSandbox";

type Differential = string | { salaocloud?: string; competitor_a?: string; competitor_b?: string; [k: string]: any };
type UseCase = string | { salon?: string; before?: string; after?: string; result?: string; roi?: string; [k: string]: any };

interface ModuleContent {
  technical?: string;
  commercial?: string;
  arguments?: { small?: string[]; medium?: string[]; large?: string[] };
  differentials?: Differential[];
  use_cases?: UseCase[];
  checklist?: string[];
  quiz?: QuizQuestion[];
}

interface Module {
  id: number; title: string; profile: string; view: string;
  iframe_path: string | null; screenshot_url: string | null; content: ModuleContent;
}

const REQUEST_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: PromiseLike<T>, message: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), REQUEST_TIMEOUT_MS);
    }),
  ]);
}

export default function ModuloPage() {
  const { id } = useParams();
  const moduleId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { slug: sandboxSlug } = useTrainingSandbox();
  const [module, setModule] = useState<Module | null>(null);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [checklist, setChecklist] = useState<boolean[]>([]);
  const [quizPassed, setQuizPassed] = useState(false);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      setProgressId(null);
      setCompleted(false);
      setQuizPassed(false);

      if (!Number.isFinite(moduleId)) {
        setModule(null);
        setLoading(false);
        return;
      }

      try {
        const { data: mods, error } = await withTimeout(
          supabase.from("training_modules").select("*").eq("is_active", true).order("display_order"),
          "Tempo esgotado ao carregar o módulo."
        );

        if (cancelled) return;
        if (error) throw error;

        const list = ((mods ?? []) as Module[]).map((item) => ({
          ...item,
          content: (item.content ?? {}) as ModuleContent,
        }));
        const selectedModule = list.find((x) => x.id === moduleId) ?? null;
        const checklistItems = (selectedModule?.content?.checklist ?? []) as string[];

        setAllModules(list);
        setModule(selectedModule);
        setChecklist(checklistItems.map(() => false));
        setLoading(false);

        if (!selectedModule || !user) return;

        try {
          const { data: p, error: progressError } = await withTimeout(
            supabase.from("training_user_progress")
              .select("*")
              .eq("user_id", user.id)
              .eq("module_id", selectedModule.id)
              .maybeSingle(),
            "Tempo esgotado ao carregar o progresso."
          );

          if (cancelled) return;
          if (progressError) throw progressError;

          if (p) {
            setProgressId(p.id);
            setCompleted(p.status === "completed");
            const state = (p.checklist_state ?? {}) as Record<string, boolean>;
            setChecklist(checklistItems.map((_, i) => !!state[i]));
            setQuizPassed(p.status === "completed");
            return;
          }

          const { data: created, error: createError } = await withTimeout(
            supabase.from("training_user_progress").insert({
              user_id: user.id,
              module_id: selectedModule.id,
              status: "in_progress",
              started_at: new Date().toISOString(),
            }).select().single(),
            "Tempo esgotado ao iniciar o progresso."
          );

          if (cancelled) return;
          if (createError) throw createError;
          if (created) setProgressId(created.id);
        } catch (progressErr) {
          console.error("Erro ao sincronizar progresso do treinamento", progressErr);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Erro ao carregar módulo de treinamento", err);
        setModule(null);
        setLoadError(err instanceof Error ? err.message : "Não foi possível carregar este módulo.");
        setLoading(false);
      }
    };
    if (user) load();
    return () => { cancelled = true; };
  }, [user, moduleId]);

  const persistChecklist = async (next: boolean[]) => {
    if (!progressId) return;
    const state: Record<string, boolean> = {};
    next.forEach((v, i) => { state[i] = v; });
    await supabase.from("training_user_progress").update({ checklist_state: state }).eq("id", progressId);
  };

  const allChecked = checklist.length === 0 || checklist.every(Boolean);
  const canComplete = !!progressId && allChecked && quizPassed && !completed;

  const PROFILE_LABEL: Record<string, string> = {
    admin: "Dono / Admin",
    professional: "Profissional",
    receptionist: "Recepcionista",
    client: "Cliente",
  };

  const complete = async () => {
    if (!progressId) return;
    setSaving(true);
    const { error } = await supabase.from("training_user_progress").update({
      status: "completed", completed_at: new Date().toISOString(), score: 100,
    }).eq("id", progressId);
    if (error) { setSaving(false); toast.error(error.message); return; }
    setCompleted(true);
    toast.success("Módulo concluído!");

    // Trigger certificate evaluation as a safety net (DB trigger also handles it)
    try {
      const { data } = await supabase.functions.invoke("training-issue-certificate");
      const newly: string[] = (data as any)?.newly_issued ?? [];
      newly.forEach((profile) => {
        toast.success(`🎉 Certificado emitido: ${PROFILE_LABEL[profile] ?? profile}`, {
          description: "Acesse seu painel para visualizar.",
          duration: 6000,
        });
      });
    } catch { /* no-op — trigger already covers it */ }
    setSaving(false);
  };

  if (loading) return <TrainingLayout><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></TrainingLayout>;
  if (loadError) return <TrainingLayout><Card className="p-4"><p className="text-sm text-destructive">{loadError}</p></Card></TrainingLayout>;
  if (!module) return <TrainingLayout><p>Módulo não encontrado.</p></TrainingLayout>;

  const c = module.content;
  const idx = allModules.findIndex((m) => m.id === module.id);
  const prev = idx > 0 ? allModules[idx - 1] : null;
  const next = idx < allModules.length - 1 ? allModules[idx + 1] : null;

  // Build live URL pointing to the vendor's sandbox; opens in new tab
  const resolvedPath = resolveSandboxPath(module.iframe_path, module.view, sandboxSlug);
  const liveUrl = resolvedPath ? `${window.location.origin}${resolvedPath}` : null;

  return (
    <TrainingLayout>
      <div className="space-y-4">
        <Link to="/treinamento/dashboard" className="text-sm text-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="outline" className="mb-1">{module.profile}</Badge>
            <h1 className="font-display text-2xl font-bold">{module.id}. {module.title}</h1>
          </div>
          {completed && <Badge className="bg-green-600 gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Concluído</Badge>}
        </div>

        {c.technical && (
          <Card className="p-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-1">Técnico</h2>
            <p className="text-sm">{c.technical}</p>
          </Card>
        )}
        {c.commercial && (
          <Card className="p-4 bg-primary/5">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-primary mb-1">Pitch Comercial</h2>
            <p className="text-sm">{c.commercial}</p>
          </Card>
        )}
        {c.arguments && (
          <Card className="p-4">
            <h2 className="font-semibold mb-2">Argumentos por porte de salão</h2>
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              {(["small", "medium", "large"] as const).map((sz) => (
                <div key={sz}>
                  <p className="font-medium capitalize mb-1">{sz === "small" ? "Pequeno" : sz === "medium" ? "Médio" : "Grande"}</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {(c.arguments?.[sz] ?? []).map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}
        {c.differentials && c.differentials.length > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold mb-2">Diferenciais</h2>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {c.differentials.map((d, i) => (
                <li key={i}>
                  {typeof d === "string" ? d : (
                    <div className="space-y-0.5">
                      {d.salaocloud && <div><strong>SalãoCloud:</strong> {d.salaocloud}</div>}
                      {d.competitor_a && <div className="text-muted-foreground">Concorrente A: {d.competitor_a}</div>}
                      {d.competitor_b && <div className="text-muted-foreground">Concorrente B: {d.competitor_b}</div>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {c.use_cases && c.use_cases.length > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold mb-2">Casos de uso</h2>
            <ul className="space-y-2 text-sm">
              {c.use_cases.map((u, i) => (
                <li key={i} className="border-l-2 border-primary/40 pl-3">
                  {typeof u === "string" ? u : (
                    <div className="space-y-0.5">
                      {u.salon && <div className="font-medium">{u.salon}</div>}
                      {u.before && <div><span className="text-muted-foreground">Antes:</span> {u.before}</div>}
                      {u.after && <div><span className="text-muted-foreground">Depois:</span> {u.after}</div>}
                      {u.result && <div><span className="text-muted-foreground">Resultado:</span> {u.result}</div>}
                      {u.roi && <div className="text-primary font-medium">ROI: {u.roi}</div>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {liveUrl && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Tela ao vivo</h2>
              <Button asChild size="sm" variant="outline">
                <a href={liveUrl} target="_blank" rel="noreferrer">
                  Abrir <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </a>
              </Button>
            </div>
            {module.screenshot_url ? (
              <img src={module.screenshot_url} alt={module.title} className="w-full rounded-md border" />
            ) : (
              <p className="text-xs text-muted-foreground">Acesse a tela em uma nova aba para praticar.</p>
            )}
          </Card>
        )}

        {checklist.length > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Checklist de prática</h2>
            <div className="space-y-2">
              {(c.checklist ?? []).map((item, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={checklist[i]}
                    onCheckedChange={(v) => {
                      const next = [...checklist]; next[i] = !!v; setChecklist(next); persistChecklist(next);
                    }}
                    disabled={completed}
                  />
                  <span className="text-sm">{item}</span>
                </label>
              ))}
            </div>
          </Card>
        )}

        {c.quiz && c.quiz.length > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Quiz</h2>
            <QuizComponent
              questions={c.quiz}
              onPass={async (score) => {
                setQuizPassed(true);
                if (user && module) {
                  await supabase.from("training_quiz_attempts").insert({
                    user_id: user.id, module_id: module.id, score,
                    total: (module.content.quiz ?? []).length,
                    passed: true, answers: {},
                  });
                }
              }}
            />
          </Card>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="outline" disabled={!prev} onClick={() => prev && navigate(`/treinamento/modulo/${prev.id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />Anterior
          </Button>
          {!completed ? (
            <Button onClick={complete} disabled={!canComplete || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Concluir módulo
            </Button>
          ) : (
            <Button onClick={() => next && navigate(`/treinamento/modulo/${next.id}`)} disabled={!next}>
              Próximo<ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </TrainingLayout>
  );
}
