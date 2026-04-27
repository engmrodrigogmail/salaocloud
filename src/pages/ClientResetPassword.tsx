import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo-salaocloud-v5.png";

type State = "validating" | "valid" | "invalid" | "submitting" | "success";

export default function ClientResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const [state, setState] = useState<State>("validating");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      setErrorMsg("Link inválido. Solicite uma nova redefinição.");
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("client-auth-reset-password", {
          body: { token, action: "validate" },
        });
        if (error) {
          const ctx: any = (error as any).context;
          const body = ctx?.body ? JSON.parse(ctx.body) : {};
          mapError(body?.error);
          return;
        }
        if (data?.status === "valid") {
          setEmail(data.email ?? null);
          setState("valid");
        } else {
          mapError(data?.error);
        }
      } catch (err) {
        console.error(err);
        mapError("invalid_token");
      }
    })();
  }, [token]);

  const mapError = (code?: string) => {
    setState("invalid");
    if (code === "token_expired") setErrorMsg("Este link expirou. Solicite uma nova redefinição.");
    else if (code === "token_already_used") setErrorMsg("Este link já foi utilizado. Solicite uma nova redefinição se necessário.");
    else setErrorMsg("Link inválido. Solicite uma nova redefinição.");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres", { position: "top-center", duration: 2500 });
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem", { position: "top-center", duration: 2500 });
      return;
    }

    setState("submitting");
    try {
      const { data, error } = await supabase.functions.invoke("client-auth-reset-password", {
        body: { token, new_password: password },
      });
      if (error) {
        const ctx: any = (error as any).context;
        const body = ctx?.body ? JSON.parse(ctx.body) : {};
        mapError(body?.error);
        return;
      }
      if (data?.status === "ok") {
        setState("success");
        toast.success("Senha redefinida!", { position: "top-center", duration: 2000 });
      } else {
        mapError(data?.error);
      }
    } catch (err) {
      console.error(err);
      mapError("invalid_token");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/cliente" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Voltar ao acesso
          </Link>
          <img src={logo} alt="Salão Cloud" className="h-8" />
          <div className="w-16" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {state === "validating" && (
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Validando link...</p>
            </div>
          )}

          {state === "invalid" && (
            <div className="text-center space-y-6">
              <XCircle className="h-12 w-12 mx-auto text-destructive" />
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Não foi possível redefinir</h1>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
              </div>
              <Button onClick={() => navigate("/cliente")} className="w-full">Voltar ao acesso</Button>
            </div>
          )}

          {(state === "valid" || state === "submitting") && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Redefinir senha</h1>
                {email && (
                  <p className="text-sm text-muted-foreground">
                    Conta: <strong>{email}</strong>
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-lg p-6 shadow-sm">
                <div className="space-y-2">
                  <Label htmlFor="new-pwd">Nova senha (mín. 6 caracteres)</Label>
                  <div className="relative">
                    <Input id="new-pwd" type={showPwd ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)} autoFocus required minLength={6} />
                    <button type="button" onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pwd">Confirme a nova senha</Label>
                  <Input id="confirm-pwd" type={showPwd ? "text" : "password"} value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={state === "submitting"}>
                  {state === "submitting" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Redefinir senha"}
                </Button>
              </form>
            </div>
          )}

          {state === "success" && (
            <div className="text-center space-y-6">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Senha redefinida!</h1>
                <p className="text-sm text-muted-foreground">
                  Sua nova senha já está ativa. Use-a para acessar seu portal.
                </p>
              </div>
              <Button onClick={() => navigate("/cliente")} className="w-full">Ir para o acesso</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
