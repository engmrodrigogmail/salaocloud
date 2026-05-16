import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/logo-salaocloud-v5.png";
import salonBg from "@/assets/salon-dark-bg.png";

/**
 * Página de redefinição de senha para donos de salão.
 * Acessada pelo link enviado por e-mail pelo Supabase Auth (recovery).
 */
export default function OwnerResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let unsub: { subscription: { unsubscribe: () => void } } | null = null;
    (async () => {
      // O link de recovery do Supabase chega com um access_token no hash;
      // o cliente faz auto-detect e dispara PASSWORD_RECOVERY.
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          setValidSession(true);
          setReady(true);
        }
      });
      unsub = data;
      // Caso a sessão já tenha sido criada pelo SDK antes do listener montar
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        setValidSession(true);
      }
      setReady(true);
    })();
    return () => { unsub?.subscription.unsubscribe(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres"); return; }
    if (pwd !== pwd2) { toast.error("As senhas não conferem"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      password: pwd,
      data: { must_change_password: false },
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha atualizada! Redirecionando...");
    setTimeout(() => navigate("/hub", { replace: true }), 800);
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center salon-photo-bg"
        style={{ ["--salon-bg-image" as any]: `url(${salonBg})` }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center salon-photo-bg p-4"
      style={{ ["--salon-bg-image" as any]: `url(${salonBg})` }}>
      <Card className="w-full max-w-md p-6 sm:p-8">
        <img src={logo} alt="Salão Cloud" className="h-10 w-auto mb-6" />
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold">Definir nova senha</h1>
        </div>

        {!validSession ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Link inválido ou expirado. Solicite um novo na tela de login.
            </p>
            <Button className="w-full" onClick={() => navigate("/auth")}>Voltar ao login</Button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Escolha uma nova senha com pelo menos 6 caracteres.
            </p>
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)} required className="pr-10" />
                <button type="button" onClick={() => setShow((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirme a senha</Label>
              <Input type={show ? "text" : "password"} value={pwd2} onChange={(e) => setPwd2(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar nova senha
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
