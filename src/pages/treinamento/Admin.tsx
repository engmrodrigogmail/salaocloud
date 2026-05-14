import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, RefreshCw, Award, BarChart3, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TrainingLayout } from "@/components/training/TrainingLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dateUtils";

interface Vendor {
  id: string; user_id: string; full_name: string | null; phone: string | null;
  city: string | null; uf: string | null; must_change_password: boolean;
  last_login_at: string | null; created_at: string;
}
interface ProgressRow { user_id: string; module_id: number; status: string; completed_at: string | null; }
interface ModuleRow { id: number; title: string; profile: string; display_order: number; }
interface CertRow { user_id: string; profile: string; code: string; issued_at: string; }

const PROFILE_LABEL: Record<string, string> = {
  admin: "Dono / Admin",
  professional: "Profissional",
  receptionist: "Recepção",
  client: "Cliente",
  complete: "Completo",
};

export default function TrainingAdmin() {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newV, setNewV] = useState({ email: "", full_name: "", phone: "" });
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: vp }, { data: mods }, { data: prog }, { data: cs }] = await Promise.all([
      supabase.from("training_vendor_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("training_modules").select("id,title,profile,display_order").order("display_order"),
      supabase.from("training_user_progress").select("user_id,module_id,status,completed_at"),
      supabase.from("training_certificates").select("user_id,profile,code,issued_at").order("issued_at", { ascending: false }),
    ]);
    setVendors((vp ?? []) as Vendor[]);
    setModules((mods ?? []) as ModuleRow[]);
    setProgress((prog ?? []) as ProgressRow[]);
    setCerts((cs ?? []) as CertRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const profilesList = useMemo(() => Array.from(new Set(modules.map((m) => m.profile))), [modules]);
  const modulesByProfile = useMemo(() => {
    const map = new Map<string, ModuleRow[]>();
    for (const m of modules) {
      if (!map.has(m.profile)) map.set(m.profile, []);
      map.get(m.profile)!.push(m);
    }
    return map;
  }, [modules]);

  const overall = (uid: string) => {
    const done = progress.filter((p) => p.user_id === uid && p.status === "completed").length;
    return { done, total: modules.length };
  };

  const certsFor = (uid: string) => certs.filter((c) => c.user_id === uid);

  const createVendor = async () => {
    if (!newV.email) { toast.error("Email obrigatório"); return; }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("training-vendor-create", { body: newV });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error!.message);
      return;
    }
    toast.success(`Vendedor criado. Senha temporária: ${(data as any).temp_password}`);
    setOpenNew(false);
    setNewV({ email: "", full_name: "", phone: "" });
    load();
  };

  const removeVendor = async (userId: string) => {
    if (!confirm("Remover acesso deste vendedor?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "sales_trainee");
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  };

  const totals = useMemo(() => {
    const totalVendors = vendors.length;
    const completedCount = vendors.filter((v) => overall(v.user_id).done === modules.length && modules.length > 0).length;
    const totalCerts = certs.length;
    return { totalVendors, completedCount, totalCerts };
  }, [vendors, progress, modules, certs]);

  if (loading) return <TrainingLayout><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></TrainingLayout>;

  return (
    <TrainingLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Gerenciar Treinamento</h1>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Vendedores</p>
            <p className="text-2xl font-bold">{totals.totalVendors}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Concluíram tudo</p>
            <p className="text-2xl font-bold">{totals.completedCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Certificados emitidos</p>
            <p className="text-2xl font-bold flex items-center gap-2"><Award className="h-5 w-5 text-amber-500" />{totals.totalCerts}</p>
          </Card>
        </div>

        <Tabs defaultValue="vendors">
          <TabsList>
            <TabsTrigger value="vendors">Vendedores</TabsTrigger>
            <TabsTrigger value="certificates">Certificados</TabsTrigger>
            <TabsTrigger value="modules">Módulos</TabsTrigger>
          </TabsList>

          <TabsContent value="vendors" className="space-y-3">
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" />Novo vendedor</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Novo vendedor</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Email</Label><Input type="email" value={newV.email} onChange={(e) => setNewV({ ...newV, email: e.target.value })} /></div>
                  <div><Label>Nome</Label><Input value={newV.full_name} onChange={(e) => setNewV({ ...newV, full_name: e.target.value })} /></div>
                  <div><Label>Telefone</Label><Input value={newV.phone} onChange={(e) => setNewV({ ...newV, phone: e.target.value })} /></div>
                  <Button onClick={createVendor} disabled={creating} className="w-full">
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar e mostrar senha temporária
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {vendors.length === 0 && <p className="text-sm text-muted-foreground">Nenhum vendedor cadastrado.</p>}
            {vendors.map((v) => {
              const { done, total } = overall(v.user_id);
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const vCerts = certsFor(v.user_id);
              return (
                <Card key={v.id} className="p-4 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{v.full_name || "(sem nome)"}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.phone ?? "—"} · {v.city ?? "—"}/{v.uf ?? "—"}
                        {v.last_login_at ? ` · último acesso ${formatDateTime(v.last_login_at, "dd/MM HH:mm")}` : " · nunca acessou"}
                      </p>
                    </div>
                    {v.must_change_password && <Badge variant="outline">primeiro acesso</Badge>}
                    <Badge variant="secondary">{done}/{total}</Badge>
                    {vCerts.length > 0 && (
                      <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                        <Award className="h-3 w-3 mr-1" />{vCerts.length}
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setDetailVendor(v)}>
                      <Eye className="h-4 w-4 mr-1" />Detalhes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeVendor(v.user_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Progress value={pct} className="h-2" />
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="certificates" className="space-y-2">
            {certs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum certificado emitido ainda.</p>}
            {certs.map((c) => {
              const v = vendors.find((x) => x.user_id === c.user_id);
              return (
                <Card key={c.code} className="p-3 flex items-center gap-3 flex-wrap">
                  <Award className="h-5 w-5 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{v?.full_name || "(vendedor removido)"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{c.code}</p>
                  </div>
                  <Badge variant="secondary">{PROFILE_LABEL[c.profile] ?? c.profile}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(c.issued_at, "dd/MM/yyyy HH:mm")}</span>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="modules" className="space-y-2">
            <p className="text-sm text-muted-foreground">{modules.length} módulos ativos.</p>
            {modules.map((m) => (
              <Card key={m.id} className="p-3 flex items-center gap-3">
                <Badge variant="outline">{PROFILE_LABEL[m.profile] ?? m.profile}</Badge>
                <span className="text-sm">{m.id}. {m.title}</span>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        <Dialog open={!!detailVendor} onOpenChange={(o) => !o && setDetailVendor(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {detailVendor?.full_name || "Vendedor"}
              </DialogTitle>
            </DialogHeader>
            {detailVendor && (
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground">
                  Cadastrado em {formatDateTime(detailVendor.created_at, "dd/MM/yyyy HH:mm")}
                  {detailVendor.last_login_at
                    ? ` · último acesso em ${formatDateTime(detailVendor.last_login_at, "dd/MM/yyyy HH:mm")}`
                    : " · nunca acessou"}
                </div>

                {profilesList.map((profile) => {
                  const mods = modulesByProfile.get(profile) ?? [];
                  const doneMods = mods.filter((m) =>
                    progress.some((p) => p.user_id === detailVendor.user_id && p.module_id === m.id && p.status === "completed"),
                  );
                  const cert = certs.find((c) => c.user_id === detailVendor.user_id && c.profile === profile);
                  const pct = mods.length > 0 ? Math.round((doneMods.length / mods.length) * 100) : 0;
                  return (
                    <Card key={profile} className="p-3 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{PROFILE_LABEL[profile] ?? profile}</Badge>
                          <span className="text-sm font-medium">{doneMods.length}/{mods.length}</span>
                        </div>
                        {cert ? (
                          <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                            <Award className="h-3 w-3 mr-1" />
                            {formatDateTime(cert.issued_at, "dd/MM/yyyy")}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">sem certificado</span>
                        )}
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <div className="space-y-1">
                        {mods.map((m) => {
                          const p = progress.find((x) => x.user_id === detailVendor.user_id && x.module_id === m.id);
                          const status = p?.status === "completed" ? "✓" : p?.status === "in_progress" ? "…" : "○";
                          return (
                            <div key={m.id} className="text-xs flex items-center justify-between gap-2">
                              <span className="truncate">{status} {m.title}</span>
                              {p?.completed_at && (
                                <span className="text-muted-foreground shrink-0">
                                  {formatDateTime(p.completed_at, "dd/MM HH:mm")}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {cert && (
                        <p className="text-[10px] font-mono text-muted-foreground pt-1 border-t">
                          Código: {cert.code}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TrainingLayout>
  );
}
