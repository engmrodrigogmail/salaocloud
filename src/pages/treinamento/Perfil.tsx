import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TrainingLayout } from "@/components/training/TrainingLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTrainingSandbox } from "@/hooks/useTrainingSandbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function TrainingPerfil() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({ full_name: "", phone: "", cpf: "", city: "", uf: "" });
  const [pwd, setPwd] = useState("");
  const { slug: sandboxSlug, loading: sandboxLoading, reset: resetSandbox } = useTrainingSandbox();
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: p } = await supabase.from("training_vendor_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (p) setData({
        full_name: p.full_name ?? "", phone: p.phone ?? "",
        cpf: p.cpf ?? "", city: p.city ?? "", uf: p.uf ?? "",
      });
      setLoading(false);
    };
    load();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("training_vendor_profiles").update(data).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Salvo");
  };

  const changePwd = async () => {
    if (pwd.length < 8) { toast.error("Mínimo 8 caracteres"); return; }
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) toast.error(error.message);
    else { toast.success("Senha alterada"); setPwd(""); }
  };

  if (loading) return <TrainingLayout><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></TrainingLayout>;

  return (
    <TrainingLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Meu Perfil</h1>
        <Card className="p-5 space-y-4">
          <div><Label>Nome</Label><Input value={data.full_name} onChange={(e) => setData({ ...data, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Telefone</Label><Input value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} /></div>
            <div><Label>CPF</Label><Input value={data.cpf} onChange={(e) => setData({ ...data, cpf: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Cidade</Label><Input value={data.city} onChange={(e) => setData({ ...data, city: e.target.value })} /></div>
            <div><Label>UF</Label><Input maxLength={2} value={data.uf} onChange={(e) => setData({ ...data, uf: e.target.value.toUpperCase() })} /></div>
          </div>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Alterar Senha</h2>
          <div><Label>Nova senha</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
          <Button onClick={changePwd} variant="outline">Alterar senha</Button>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Salão de treino</h2>
          <p className="text-sm text-muted-foreground">
            Cada vendedor pratica em um salão isolado. Suas alterações não afetam outros vendedores.
          </p>
          <p className="text-xs text-muted-foreground">
            Slug: <code className="px-1.5 py-0.5 bg-muted rounded">{sandboxLoading ? "carregando…" : (sandboxSlug ?? "—")}</code>
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={resetting || sandboxLoading}>
                {resetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Resetar meu salão de treino
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Resetar salão de treino?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os dados do seu salão de prática (clientes, agendamentos, comandas etc.)
                  serão apagados e recriados a partir do template original.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setResetting(true);
                    const ok = await resetSandbox();
                    setResetting(false);
                    if (ok) toast.success("Salão de treino resetado!");
                    else toast.error("Falha ao resetar.");
                  }}
                >
                  Resetar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </div>
    </TrainingLayout>
  );
}
