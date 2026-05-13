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

interface ModuleContent {
  technical?: string;
  commercial?: string;
  arguments?: { small?: string[]; medium?: string[]; large?: string[] };
  differentials?: string[];
  use_cases?: string[];
  checklist?: string[];
  quiz?: QuizQuestion[];
}

interface Module {
  id: number; title: string; profile: string; view: string;
  iframe_path: string | null; screenshot_url: string | null; content: ModuleContent;
}

export default function ModuloPage() {
  const { id } = useParams();
  const moduleId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [module, setModule] = useState<Module | null>(null);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [checklist, setChecklist] = useState<boolean[]>([]);
  const [quizPassed, setQuizPassed] = useState(false);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: mods } = await supabase.from("training_modules")
        .select("*").eq("is_active", true).order("display_order");
      const list = (mods ?? []) as Module[];
      setAllModules(list);
      const m = list.find((x) => x.id === moduleId);
      setModule(m ?? null);

      if (m && user) {
        const { data: p } = await supabase.from("training_user_progress")
          .select("*").eq("user_id", user.id).eq("module_id", m.id).maybeSingle();
        const cl = (m.content?.checklist ?? []) as string[];
        if (p) {
          setProgressId(p.id);
          setCompleted(p.status === "completed");
          const state = (p.checklist_state ?? {}) as Record<string, boolean>;
          setChecklist(cl.map((_, i) => !!state[i]));
          if (p.status === "completed") setQuizPassed(true);
        } else {
          // create in_progress
          const { data: created } = await supabase.from("training_user_progress").insert({
            user_id: user.id, module_id: m.id, status: "in_progress",
            started_at: new Date().toISOString(),
          }).select().single();
          if (created) setProgressId(created.id);
          setChecklist(cl.map(() => false));
        }
      }
      setLoading(false);
    };
    if (user && moduleId) load();
  }, [user, moduleId]);

  const persistChecklist = async (next: boolean[]) => {
    if (!progressId) return;
    const state: Record<string, boolean> = {};
    next.forEach((v, i) => { state[i] = v; });
    await supabase.from("training_user_progress").update({ checklist_state: state }).eq("id", progressId);
  };

  const allChecked = checklist.length === 0 || checklist.every(Boolean);
  const canComplete = allChecked && quizPassed && !completed;

  const complete = async () => {
    if (!progressId) return;
    setSaving(true);
    const { error } = await supabase.from("training_user_progress").update({
      status: "completed", completed_at: new Date().toISOString(), score: 100,
    }).eq("id", progressId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setCompleted(true);
    toast.success("Módulo concluído!");
  };

  if (loading) return <TrainingLayout><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></TrainingLayout>;
  if (!module) return <TrainingLayout><p>Módulo não encontrado.</p></TrainingLayout>;

  const c = module.content;
  const idx = allModules.findIndex((m) => m.id === module.id);
  const prev = idx > 0 ? allModules[idx - 1] : null;
  const next = idx < allModules.length - 1 ? allModules[idx + 1] : null;

  // Build live URL — opens in new tab; iframe of the same site is blocked
  const liveUrl = module.iframe_path ? `${window.location.origin}${module.iframe_path}` : null;

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
              {c.differentials.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </Card>
        )}
        {c.use_cases && c.use_cases.length > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold mb-2">Casos de uso</h2>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {c.use_cases.map((u, i) => <li key={i}>{u}</li>)}
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
                    user_id: user.id, module_id: module.id, score, passed: true, answers: {},
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
