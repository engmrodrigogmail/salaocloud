import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TrainingLayout } from "@/components/training/TrainingLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Vendor {
  id: string; user_id: string; full_name: string | null; phone: string | null;
  city: string | null; uf: string | null; must_change_password: boolean;
  last_login_at: string | null;
}

interface ProgressRow { user_id: string; module_id: number; status: string; }
interface ModuleRow { id: number; title: string; profile: string; }

export default function TrainingAdmin() {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<(Vendor & { email: string | null })[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newV, setNewV] = useState({ email: "", full_name: "", phone: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: vp }, { data: mods }, { data: prog }] = await Promise.all([
      supabase.from("training_vendor_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("training_modules").select("id,title,profile").order("display_order"),
      supabase.from("training_user_progress").select("user_id,module_id,status"),
    ]);
    // Fetch emails via edge function would be better — fallback: not shown
    setVendors((vp ?? []).map((v: any) => ({ ...v, email: null })));
    setModules((mods ?? []) as ModuleRow[]);
    setProgress((prog ?? []) as ProgressRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

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
    // Only remove the role; Supabase auth user kept (admin can purge separately)
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "sales_trainee");
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  };

  const progressByVendor = (uid: string) => {
    const done = progress.filter((p) => p.user_id === uid && p.status === "completed").length;
    const total = modules.length;
    return { done, total };
  };

  if (loading) return <TrainingLayout><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></TrainingLayout>;

  return (
    <TrainingLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Gerenciar Treinamento</h1>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </div>

        <Tabs defaultValue="vendors">
          <TabsList>
            <TabsTrigger value="vendors">Vendedores</TabsTrigger>
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
              const { done, total } = progressByVendor(v.user_id);
              return (
                <Card key={v.id} className="p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{v.full_name || "(sem nome)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.phone ?? "—"} · {v.city ?? "—"}/{v.uf ?? "—"}
                    </p>
                  </div>
                  <Badge variant="secondary">{done}/{total} módulos</Badge>
                  {v.must_change_password && <Badge variant="outline">primeiro acesso</Badge>}
                  <Button size="sm" variant="ghost" onClick={() => removeVendor(v.user_id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="modules" className="space-y-2">
            <p className="text-sm text-muted-foreground">29 módulos ativos. Edição completa de conteúdo via banco (próxima iteração).</p>
            {modules.map((m) => (
              <Card key={m.id} className="p-3 flex items-center gap-3">
                <Badge variant="outline">{m.profile}</Badge>
                <span className="text-sm">{m.id}. {m.title}</span>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </TrainingLayout>
  );
}
