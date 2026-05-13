import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Lock, PlayCircle, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TrainingLayout } from "@/components/training/TrainingLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Module { id: number; title: string; profile: string; view: string; display_order: number; }
interface Progress { module_id: number; status: string; }
interface Cert { profile: string; issued_at: string; }

const PROFILE_LABEL: Record<string, string> = {
  admin: "Dono / Admin",
  professional: "Profissional",
  receptionist: "Recepcionista",
  client: "Cliente",
};

export default function TrainingDashboard() {
  const { user } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Record<number, string>>({});
  const [certs, setCerts] = useState<Cert[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: mods }, { data: prog }, { data: c }] = await Promise.all([
        supabase.from("training_modules").select("id,title,profile,view,display_order").eq("is_active", true).order("display_order"),
        supabase.from("training_user_progress").select("module_id,status").eq("user_id", user!.id),
        supabase.from("training_certificates").select("profile,issued_at").eq("user_id", user!.id),
      ]);
      setModules((mods ?? []) as Module[]);
      const map: Record<number, string> = {};
      (prog ?? []).forEach((p: any) => { map[p.module_id] = p.status; });
      setProgress(map);
      setCerts((c ?? []) as Cert[]);
    };
    if (user) load();
  }, [user]);

  const profiles = ["admin", "professional", "receptionist", "client"];

  return (
    <TrainingLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Meu Treinamento</h1>
          <p className="text-muted-foreground text-sm">Conclua os módulos por perfil para emitir seu certificado.</p>
        </div>

        {certs.length > 0 && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-3">
              <Award className="h-6 w-6 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Certificados conquistados</p>
                <ul className="text-sm text-muted-foreground mt-1 space-y-0.5">
                  {certs.map((c) => (
                    <li key={c.profile}>{PROFILE_LABEL[c.profile]} — {new Date(c.issued_at).toLocaleDateString("pt-BR")}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        <Tabs defaultValue="admin">
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
            {profiles.map((p) => (
              <TabsTrigger key={p} value={p}>{PROFILE_LABEL[p]}</TabsTrigger>
            ))}
          </TabsList>
          {profiles.map((p) => {
            const list = modules.filter((m) => m.profile === p);
            const done = list.filter((m) => progress[m.id] === "completed").length;
            return (
              <TabsContent key={p} value={p} className="space-y-2">
                <div className="text-sm text-muted-foreground py-2">
                  {done}/{list.length} concluídos
                </div>
                {list.map((m, idx) => {
                  const status = progress[m.id] ?? "not_started";
                  const prevDone = idx === 0 || progress[list[idx - 1].id] === "completed";
                  const locked = !prevDone;
                  return (
                    <Link
                      key={m.id}
                      to={locked ? "#" : `/treinamento/modulo/${m.id}`}
                      className={locked ? "pointer-events-none opacity-60" : ""}
                    >
                      <Card className="p-4 flex items-center gap-3 hover:border-primary transition-colors">
                        {status === "completed" ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                          : status === "in_progress" ? <PlayCircle className="h-5 w-5 text-primary" />
                          : locked ? <Lock className="h-5 w-5 text-muted-foreground" />
                          : <Circle className="h-5 w-5 text-muted-foreground" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{m.id}. {m.title}</p>
                          <p className="text-xs text-muted-foreground">Tela: {m.view}</p>
                        </div>
                        {status === "completed" && <Badge variant="secondary">Concluído</Badge>}
                      </Card>
                    </Link>
                  );
                })}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </TrainingLayout>
  );
}
