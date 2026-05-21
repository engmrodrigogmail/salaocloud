import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MapPin, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

type Step = "login" | "select" | "create_password" | "no_match";
type IdentifierType = "email" | "phone";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}
function formatCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
function isValidCPF(cpf: string) {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(d[10]);
}

function persistSession(
  slug: string,
  clientId: string,
  emailUsed: string,
  sessionToken?: string | null,
  sessionExpiresAt?: string | null,
) {
  const key = `client_portal_session:${slug}`;
  localStorage.setItem(
    key,
    JSON.stringify({
      clientId,
      email: emailUsed,
      phone: null,
      sessionToken: sessionToken ?? null,
      sessionExpiresAt: sessionExpiresAt ?? null,
      savedAt: new Date().toISOString(),
    }),
  );
}

export default function ClientLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("login");
  const [loading, setLoading] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [identifierType, setIdentifierType] = useState<IdentifierType>("email");
  const [password, setPassword] = useState("");

  const [resolvedEmail, setResolvedEmail] = useState("");
  const [resolvedPhone, setResolvedPhone] = useState("");

  // First-access fields
  const [confirmPassword, setConfirmPassword] = useState("");
  const [extraEmail, setExtraEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<EstablishmentOption | null>(null);
  const [forgotInfoEmail, setForgotInfoEmail] = useState<string | null>(null);

  /**
   * Logs the client into every salon where the email is registered,
   * persisting one session per slug, then sends user to /hub which
   * already combines client sessions with Supabase auth (owner / super_admin).
   */
  const loginIntoAllSalons = async (email: string, pwd: string): Promise<boolean> => {
    const { data: listData, error: listErr } = await supabase.functions.invoke(
      "list-client-establishments",
      { body: { email } },
    );
    if (listErr) throw listErr;
    const list = (listData?.establishments ?? []) as EstablishmentOption[];
    if (list.length === 0) return false;

    let anyOk = false;
    for (const est of list) {
      const { data, error } = await supabase.functions.invoke("client-auth-login", {
        body: { email, password: pwd, establishment_id: est.id },
      });
      if (error || data?.status !== "ok" || !data?.client) continue;
      persistSession(est.slug, data.client.id, email, data.session_token, data.session_expires_at);
      anyOk = true;
    }
    return anyOk;
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const raw = identifier.trim();
    const digits = onlyDigits(raw);
    const looksLikePhone = !raw.includes("@") && digits.length >= 10;

    if (!isEmail(raw.toLowerCase()) && !looksLikePhone) {
      toast.error("Informe um e-mail ou telefone válido", { position: "top-center", duration: 2000 });
      return;
    }
    if (!password || password.length < 6) {
      toast.error("Digite sua senha (mín. 6 caracteres)", { position: "top-center", duration: 2000 });
      return;
    }

    setLoading(true);
    try {
      let emailToUse = "";
      if (looksLikePhone) {
        setIdentifierType("phone");
        setResolvedPhone(digits);

        const { data, error } = await supabase.functions.invoke("list-client-establishments-by-phone", {
          body: { phone: digits },
        });
        if (error) throw error;

        const list = (data?.establishments ?? []) as EstablishmentOption[];
        const suggested = (data?.suggested_email ?? null) as string | null;
        setEstablishments(list);

        if (list.length === 0) {
          setStep("no_match");
          return;
        }

        if (!suggested) {
          // Phone-only: needs first-access flow
          setResolvedEmail("");
          if (list.length === 1) {
            setSelectedEstablishment(list[0]);
            setStep("create_password");
          } else {
            setStep("select");
          }
          return;
        }

        emailToUse = String(suggested).toLowerCase();
        setResolvedEmail(emailToUse);
      } else {
        setIdentifierType("email");
        emailToUse = raw.toLowerCase();
        setResolvedEmail(emailToUse);
      }

      // Authenticate (global by email, sem establishment_id)
      const { data: authData, error: authErr } = await supabase.functions.invoke("client-auth-login", {
        body: { email: emailToUse, password },
      });
      if (authErr) {
        const ctx: any = (authErr as any).context;
        if (ctx?.status === 401) {
          toast.error("E-mail/telefone ou senha incorretos", { position: "top-center", duration: 2500 });
          return;
        }
        if (ctx?.status === 404) {
          setStep("no_match");
          return;
        }
        throw authErr;
      }

      if (authData?.status === "password_not_set") {
        // First-access path: pick salon (if many) then create password
        const { data: listData } = await supabase.functions.invoke("list-client-establishments", {
          body: { email: emailToUse },
        });
        const list = (listData?.establishments ?? []) as EstablishmentOption[];
        setEstablishments(list);
        toast.info("Primeiro acesso: complete seu cadastro.", { position: "top-center", duration: 2500 });
        if (list.length <= 1) {
          setSelectedEstablishment(list[0] ?? null);
          setStep("create_password");
        } else {
          setStep("select");
        }
        return;
      }

      if (authData?.status === "ok") {
        const anyOk = await loginIntoAllSalons(emailToUse, password);
        if (!anyOk) {
          toast.error("Não foi possível abrir nenhum salão. Tente novamente.", { position: "top-center", duration: 2500 });
          return;
        }
        toast.success("Bem-vindo!", { position: "top-center", duration: 1500 });
        navigate("/hub");
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

  const handleSelectEstablishment = (est: EstablishmentOption) => {
    setSelectedEstablishment(est);
    setStep("create_password");
  };

  const handleCreatePassword = async (e: FormEvent) => {
    e.preventDefault();

    const finalEmail = (resolvedEmail || extraEmail.trim().toLowerCase()).trim();
    if (!isEmail(finalEmail)) {
      toast.error("Informe um e-mail válido", { position: "top-center", duration: 2500 });
      return;
    }
    if (!isValidCPF(cpf)) {
      toast.error("Informe um CPF válido", { position: "top-center", duration: 2500 });
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres", { position: "top-center", duration: 2500 });
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem", { position: "top-center", duration: 2500 });
      return;
    }
    if (!acceptTerms) {
      toast.error("É necessário aceitar os termos para continuar", { position: "top-center", duration: 2500 });
      return;
    }

    setLoading(true);
    try {
      if (identifierType === "phone" && !resolvedEmail && selectedEstablishment) {
        const last10 = resolvedPhone.slice(-10);
        const { data: rows } = await supabase
          .from("clients")
          .select("id, email, global_identity_email, phone, establishment_id")
          .eq("establishment_id", selectedEstablishment.id);
        const candidates = (rows ?? []).filter((r: any) => onlyDigits(r.phone ?? "").endsWith(last10));
        if (candidates.length > 0) {
          await supabase
            .from("clients")
            .update({
              email: finalEmail,
              global_identity_email: finalEmail,
              cpf: onlyDigits(cpf),
              shared_history_consent: true,
              terms_accepted_at: new Date().toISOString(),
            })
            .eq("id", candidates[0].id);
        }
      }

      const { error: setErr } = await supabase.functions.invoke("client-auth-set-password", {
        body: { email: finalEmail, password, mode: "first_time" },
      });
      if (setErr) {
        const ctx: any = (setErr as any).context;
        if (ctx?.status === 409) {
          toast.error("Senha já cadastrada. Use 'Esqueci minha senha' se precisar redefinir.", {
            position: "top-center",
            duration: 3500,
          });
          setResolvedEmail(finalEmail);
          setStep("login");
          return;
        }
        if (ctx?.status === 404) {
          toast.error("Não foi possível vincular seu e-mail ao cadastro. Peça ao salão para atualizar seu e-mail.", {
            position: "top-center",
            duration: 4000,
          });
          return;
        }
        throw setErr;
      }

      try {
        await supabase
          .from("clients")
          .update({
            cpf: onlyDigits(cpf),
            global_identity_email: finalEmail,
            shared_history_consent: true,
            terms_accepted_at: new Date().toISOString(),
          })
          .or(`email.eq.${finalEmail},global_identity_email.eq.${finalEmail}`);
      } catch (e) {
        console.warn("CPF/LGPD update best-effort failed", e);
      }

      const anyOk = await loginIntoAllSalons(finalEmail, password);
      if (!anyOk) {
        toast.error("Cadastro criado, mas não conseguimos abrir o salão. Tente novamente.", {
          position: "top-center",
          duration: 3000,
        });
        return;
      }
      toast.success("Cadastro concluído!", { position: "top-center", duration: 2000 });
      navigate("/hub");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao concluir cadastro. Tente novamente.", { position: "top-center", duration: 2500 });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const raw = identifier.trim();
    const targetEmail = (resolvedEmail || (isEmail(raw.toLowerCase()) ? raw.toLowerCase() : "")).trim();
    if (!isEmail(targetEmail)) {
      toast.error("Para recuperar a senha, informe seu e-mail no campo acima.", {
        position: "top-center",
        duration: 3000,
      });
      return;
    }
    setLoading(true);
    try {
      await supabase.functions.invoke("client-auth-request-reset", { body: { email: targetEmail } });
      setForgotInfoEmail(targetEmail);
    } catch (err) {
      console.error(err);
      setForgotInfoEmail(targetEmail);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("login");
    setIdentifier("");
    setPassword("");
    setConfirmPassword("");
    setResolvedEmail("");
    setResolvedPhone("");
    setExtraEmail("");
    setCpf("");
    setAcceptTerms(false);
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

          {step === "login" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Acesso do Cliente</h1>
                <p className="text-sm text-muted-foreground">
                  Entre com seu e-mail (ou telefone) e senha.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4 bg-card border border-border rounded-lg p-6 shadow-sm">
                <div className="space-y-2">
                  <Label htmlFor="identifier">E-mail ou telefone</Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="voce@exemplo.com ou (11) 91234-5678"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoFocus
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwd">Senha</Label>
                  <PasswordInput
                    id="pwd"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</> : "Entrar"}
                </Button>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="w-full text-sm text-primary hover:underline"
                >
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

              <p className="text-xs text-center text-muted-foreground">
                Você só conseguirá acessar se já tiver cadastro em algum salão.
              </p>
            </div>
          )}

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
                  <button
                    key={est.id}
                    onClick={() => handleSelectEstablishment(est)}
                    className="w-full bg-card border border-border rounded-lg p-4 hover:border-primary hover:shadow-md transition-all text-left flex items-center gap-4"
                  >
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

              <Button variant="ghost" onClick={reset} className="w-full">Voltar</Button>
            </div>
          )}

          {step === "create_password" && selectedEstablishment && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Complete seu cadastro</h1>
                <p className="text-sm text-muted-foreground">
                  Identificamos seu cadastro em <strong>{selectedEstablishment.name}</strong>.
                  Para continuar, complete os dados abaixo.
                </p>
              </div>

              <form onSubmit={handleCreatePassword} className="space-y-4 bg-card border border-border rounded-lg p-6 shadow-sm">
                {resolvedEmail ? (
                  <div className="space-y-2">
                    <Label htmlFor="email-ro2">E-mail</Label>
                    <Input id="email-ro2" value={resolvedEmail} disabled />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="extra-email">Seu e-mail *</Label>
                    <Input
                      id="extra-email"
                      type="email"
                      inputMode="email"
                      value={extraEmail}
                      onChange={(e) => setExtraEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF *</Label>
                  <Input
                    id="cpf"
                    inputMode="numeric"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-pwd">Nova senha (mín. 6 caracteres) *</Label>
                  <PasswordInput id="new-pwd" value={password}
                    onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pwd">Confirme a senha *</Label>
                  <PasswordInput id="confirm-pwd" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
                  <Checkbox
                    id="accept-terms"
                    checked={acceptTerms}
                    onCheckedChange={(v) => setAcceptTerms(Boolean(v))}
                    className="mt-0.5"
                  />
                  <label htmlFor="accept-terms" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                    Autorizo o compartilhamento, via CPF, do meu <strong>histórico de consumo</strong>{" "}
                    (datas e procedimentos) entre os salões da plataforma Salão Cloud,{" "}
                    <strong>sem expor valores, quantidades ou nomes dos salões</strong>. Li e aceito os{" "}
                    <Link to="/termos" target="_blank" className="text-primary hover:underline">Termos de Uso</Link>{" "}
                    e a{" "}
                    <Link to="/privacidade" target="_blank" className="text-primary hover:underline">
                      Política de Privacidade
                    </Link>.
                  </label>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Concluir cadastro e entrar"}
                </Button>
              </form>
            </div>
          )}

          {step === "no_match" && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Cadastro não encontrado</h1>
                <p className="text-sm text-muted-foreground">
                  Não localizamos cadastro para <strong>{identifier}</strong>.
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6 text-left space-y-3">
                <p className="text-sm">
                  Para usar o Salão Cloud como cliente, você precisa ser cadastrado pelo salão onde costuma se atender.
                </p>
                <p className="text-sm text-muted-foreground">
                  Peça ao seu salão o link exclusivo dele (algo como <code className="text-xs bg-muted px-1 py-0.5 rounded">salaocloud.com.br/nome-do-salao</code>) ou
                  peça que cadastrem seu telefone/e-mail no balcão.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={reset}>Tentar com outro contato</Button>
                <Button variant="ghost" asChild><Link to="/">Voltar à página inicial</Link></Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
