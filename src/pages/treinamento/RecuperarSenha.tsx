import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/treinamento/resetar-senha`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <GraduationCap className="h-8 w-8 text-primary" />
          <h1 className="font-display text-xl font-bold">Recuperar Senha</h1>
        </div>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Se o email estiver cadastrado, você receberá um link para redefinir sua senha.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enviar link
            </Button>
          </form>
        )}
        <div className="text-center text-sm mt-4">
          <Link to="/treinamento" className="text-primary hover:underline">Voltar ao login</Link>
        </div>
      </Card>
    </div>
  );
}
