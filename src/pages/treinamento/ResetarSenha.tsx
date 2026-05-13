import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function ResetarSenha() {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) { toast.error("Senha deve ter pelo menos 8 caracteres"); return; }
    if (pwd !== pwd2) { toast.error("Senhas não conferem"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha atualizada");
    navigate("/treinamento/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <GraduationCap className="h-8 w-8 text-primary" />
          <h1 className="font-display text-xl font-bold">Nova Senha</h1>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Nova senha</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required /></div>
          <div><Label>Confirme</Label><Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required /></div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </form>
      </Card>
    </div>
  );
}
