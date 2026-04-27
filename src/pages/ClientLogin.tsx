import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MapPin, Store, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo-salaocloud-v5.png";

interface EstablishmentOption {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  city: string | null;
  state: string | null;
}

type Step = "email" | "select" | "password" | "create_password" | "no_match";

export default function ClientLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<EstablishmentOption | null>(null);
  const [forgotInfoEmail, setForgotInfoEmail] = useState<string | null>(null);

  const persistSession = (slug: string, clientId: string, emailUsed: string) => {
    const key = `client_portal_session:${slug}`;
    localStorage.setItem(key, JSON.stringify({ clientId, email: emailUsed, phone: null }));
  };

  const handleSubmitEmail = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      toast.error("Informe um e-mail válido", { position: "top-center", duration: 2000 });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-client-establishments", {
        body: { email: normalized },
      });
      if (error) throw error;

      const list = (data?.establishments ?? []) as EstablishmentOption[];
      setEstablishments(list);

      if (list.length === 0) {
        setStep("no_match");
      } else if (list.length === 1) {
        setSelectedEstablishment(list[0]);
        setStep("password");
      } else {
        setStep("select");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao verificar cadastro. Tente novamente.", { position: "top-center", duration: 2500 });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEstablishment = (est: EstablishmentOption) => {
    setSelectedEstablishment(est);
    setStep("password");
  };

  const handleSubmitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error("Digite sua senha", { position: "top-center", duration: 2000 });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("client-auth-login", {
        body: {
          email: email.trim().toLowerCase(),
          password,
          establishment_id: selectedEstablishment?.id,
        },
      });
      if (error) {
        // FunctionsHttpError carries the response body in error.context
        const ctx: any = (error as any).context;
        const status = ctx?.status;
        if (status === 401) {
          toast.error("E-mail ou senha incorretos", { position: "top-center", duration: 2500 });
          return;
        }
        throw error;
      }

      if (data?.status === "password_not_set") {
        // Migração suave: cliente existe mas ainda não criou senha
        toast.info("Primeiro acesso: crie sua senha agora.", { position: "top-center", duration: 2500 });
        setStep("create_password");
        return;
      }

      if (data?.status === "ok" && data?.client && selectedEstablishment) {
        persistSession(selectedEstablishment.slug, data.client.id, email.trim().toLowerCase());
        toast.success("Bem-vindo!", { position: "top-center", duration: 1500 });
        navigate(`/${selectedEstablishment.slug}`);
        return;
      }

      toast.error("Não foi possível entrar. Tente novamente.", { position: "top-center", duration: 2500 });
    } catch (err) {
      console.error(err);
      toast.error("Falha ao entrar. Tente novamente.", { position: "top-center", duration: 2500 });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres", { position: "top-center", duration: 2500 });
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem", { position: "top-center", duration: 2500 });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("client-auth-set-password", {
        body: {
          email: email.trim().toLowerCase(),
          password,
          mode: "first_time",
        },
      });
      if (error) {
        const ctx: any = (error as any).context;
        if (ctx?.status === 409) {
          toast.error("Senha já cadastrada. Use 'Esqueci minha senha' se precisar redefinir.", {
            position: "top-center",
            duration: 3500,
          });
          setStep("password");
          return;
        }
        throw error;
      }

      // Now log them in
      const { data: loginData, error: loginErr } = await supabase.functions.invoke("client-auth-login", {
        body: {
          email: email.trim().toLowerCase(),
          password,
          establishment_id: selectedEstablishment?.id,
        },
      });
      if (loginErr) throw loginErr;

      if (loginData?.status === "ok" && loginData?.client && selectedEstablishment) {
        persistSession(selectedEstablishment.slug, loginData.client.id, email.trim().toLowerCase());
        toast.success("Senha criada com sucesso!", { position: "top-center", duration: 2000 });
        navigate(`/${selectedEstablishment.slug}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar senha. Tente novamente.", { position: "top-center", duration: 2500 });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      toast.error("Informe seu e-mail primeiro", { position: "top-center", duration: 2500 });
      return;
    }
    setLoading(true);
    try {
      await supabase.functions.invoke("client-auth-request-reset", {
        body: { email: targetEmail },
      });
      setForgotInfoEmail(targetEmail);
    } catch (err) {
      console.error(err);
      // Even on error, show generic message to avoid leaking
      setForgotInfoEmail(targetEmail);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("email");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setEstablishments([]);
    setSelectedEstablishment(null);
    setForgotInfoEmail(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Voltar
          </Link>
          <img src={logo} alt="Salão Cloud" className="h-8" />
          <div className="w-16" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* STEP: email */}
          {step === "email" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Acesso do Cliente</h1>
                <p className="text-sm text-muted-foreground">
                  Informe seu e-mail para acessar os salões em que você tem cadastro.
                </p>
              </div>

              <form onSubmit={handleSubmitEmail} className="space-y-4 bg-card border border-border rounded-lg p-6 shadow-sm">
                <div className="space-y-2">
                  <Label htmlFor="email">Seu e-mail</Label>
                  <Input id="email" type="email" inputMode="email" placeholder="voce@exemplo.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</> : "Continuar"}
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground">
                Você só conseguirá acessar se já tiver cadastro em algum salão usando o link enviado pelo estabelecimento.
              </p>
            </div>
          )}

          {/* STEP: select establishment */}
          {step === "select" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Selecione o salão</h1>
                <p className="text-sm text-muted-foreground">
                  Encontramos {establishments.length} salões com seu cadastro.
                </p>
              </div>

              <div className="space-y-3">
                {establishments.map((est) => (
                  <button key={est.id} onClick={() => handleSelectEstablishment(est)}
                    className="w-full bg-card border border-border rounded-lg p-4 hover:border-primary hover:shadow-md transition-all text-left flex items-center gap-4">
                    <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {est.logo_url ? <img src={est.logo_url} alt={est.name} className="h-full w-full object-cover" /> : <Store size={20} className="text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{est.name}</p>
                      {(est.city || est.state) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin size={12} /> {[est.city, est.state].filter(Boolean).join(" - ")}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <Button variant="ghost" onClick={reset} className="w-full">Usar outro e-mail</Button>
            </div>
          )}

          {/* STEP: password (login) */}
          {step === "password" && selectedEstablishment && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">{selectedEstablishment.name}</h1>
                <p className="text-sm text-muted-foreground">Digite sua senha para acessar.</p>
              </div>

              <form onSubmit={handleSubmitPassword} className="space-y-4 bg-card border border-border rounded-lg p-6 shadow-sm">
                <div className="space-y-2">
                  <Label htmlFor="email-ro">E-mail</Label>
                  <Input id="email-ro" value={email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwd">Senha</Label>
                  <div className="relative">
                    <Input id="pwd" type={showPwd ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)} autoFocus required minLength={6} />
                    <button type="button" onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</> : "Entrar"}
                </Button>
                <button type="button" onClick={handleForgotPassword} disabled={loading}
                  className="w-full text-sm text-primary hover:underline">
                  Esqueci minha senha
                </button>
              </form>

              {forgotInfoEmail && (
                <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm space-y-2">
                  <p>
                    Se houver um cadastro para <strong>{forgotInfoEmail}</strong>, enviamos um link de redefinição
                    <strong> exclusivamente para o e-mail cadastrado</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Verifique sua caixa de entrada (e o spam). O link expira em 30 minutos.
                  </p>
                </div>
              )}

              {establishments.length > 1 && (
                <Button variant="ghost" onClick={() => setStep("select")} className="w-full">
                  Trocar de salão
                </Button>
              )}
            </div>
          )}

          {/* STEP: create_password (1st access) */}
          {step === "create_password" && selectedEstablishment && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Crie sua senha</h1>
                <p className="text-sm text-muted-foreground">
                  Identificamos seu cadastro em <strong>{selectedEstablishment.name}</strong>. Defina uma senha para os próximos acessos.
                </p>
              </div>

              <form onSubmit={handleCreatePassword} className="space-y-4 bg-card border border-border rounded-lg p-6 shadow-sm">
                <div className="space-y-2">
                  <Label htmlFor="new-pwd">Nova senha (mín. 6 caracteres)</Label>
                  <Input id="new-pwd" type={showPwd ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} autoFocus required minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pwd">Confirme a senha</Label>
                  <Input id="confirm-pwd" type={showPwd ? "text" : "password"} value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={showPwd} onChange={(e) => setShowPwd(e.target.checked)} />
                  Mostrar senhas
                </label>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Criar senha e entrar"}
                </Button>
              </form>
            </div>
          )}

          {/* STEP: no match */}
          {step === "no_match" && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Cadastro não encontrado</h1>
                <p className="text-sm text-muted-foreground">
                  Não localizamos cadastro para <strong>{email}</strong>.
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6 text-left space-y-3">
                <p className="text-sm">
                  Para usar o Salão Cloud como cliente, você precisa receber um <strong>link de acesso</strong> diretamente do salão onde costuma se atender.
                </p>
                <p className="text-sm text-muted-foreground">
                  Peça ao seu salão o link exclusivo dele (algo como <code className="text-xs bg-muted px-1 py-0.5 rounded">salaocloud.com.br/nome-do-salao</code>) e faça seu cadastro por lá.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={reset}>Tentar com outro e-mail</Button>
                <Button variant="ghost" asChild><Link to="/">Voltar à página inicial</Link></Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
