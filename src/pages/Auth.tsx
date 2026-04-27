import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowLeft, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo-salaocloud-v5.png";
import salonBg from "@/assets/salon-dark-bg.png";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

const signupSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isSignup, setIsSignup] = useState(searchParams.get("mode") === "signup");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [establishments, setEstablishments] = useState<{ slug: string; name: string }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user, role, loading } = useAuth();

  const debugEnabled = import.meta.env.DEV;
  const debug = (...args: unknown[]) => {
    if (debugEnabled) console.debug("[Auth]", ...args);
  };

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const redirectToEstablishment = (userId: string) => {
    supabase
      .from("establishments")
      .select("slug, name")
      .eq("owner_id", userId)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          navigate("/onboarding");
        } else if (data.length === 1) {
          navigate(`/portal/${data[0].slug}`);
        } else {
          setEstablishments(data as { slug: string; name: string }[]);
          setShowPicker(true);
        }
      });
  };

  // Redirect based on role when user is authenticated
  useEffect(() => {
    debug("state", { isSignup, loading, hasUser: !!user, role });

    if (!loading && user && !showPicker) {
      if (role === "super_admin") {
        navigate("/admin");
      } else if (role === "establishment") {
        redirectToEstablishment(user.id);
      } else if (role === "client") {
        navigate("/meus-agendamentos");
      } else {
        redirectToEstablishment(user.id);
      }
    }
  }, [user, role, loading, navigate, isSignup, showPicker]);

  const handleLogin = async (data: LoginFormData) => {
    debug("login_submit", { emailLen: data.email.length });

    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    setIsLoading(false);

    debug("login_result", { ok: !error, error: error ? error.message : null });

    if (error) {
      let message = "Erro ao fazer login. Tente novamente.";
      if (error.message.includes("Invalid login credentials")) {
        message = "Email ou senha incorretos.";
      } else if (error.message.includes("Email not confirmed")) {
        message = "Confirme seu email antes de fazer login.";
      }
      toast({
        variant: "destructive",
        title: "Ops!",
        description: message,
      });
    }
  };

  const handleNativeLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const parsed = loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      toast({
        variant: "destructive",
        title: "Verifique os dados",
        description: parsed.error.issues[0]?.message || "Informe email e senha válidos.",
      });
      return;
    }

    await handleLogin(parsed.data);
  };

  const handleSignup = async (data: SignupFormData) => {
    debug("signup_submit", {
      emailLen: data.email.length,
      fullNameLen: data.fullName?.length ?? 0,
    });

    setIsLoading(true);
    const { error } = await signUp(data.email, data.password, data.fullName);
    setIsLoading(false);

    debug("signup_result", { ok: !error, error: error ? error.message : null });

    if (error) {
      let message = "Erro ao criar conta. Tente novamente.";
      if (error.message.includes("already registered")) {
        message = "Este email já está cadastrado.";
      }
      toast({
        variant: "destructive",
        title: "Ops!",
        description: message,
      });
    } else {
      toast({
        title: "Conta criada!",
        description: "Bem-vindo ao Salão Cloud!",
      });
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center salon-photo-bg"
        style={{ ['--salon-bg-image' as any]: `url(${salonBg})` }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showPicker) {
    return (
      <div
        className="min-h-screen flex items-center justify-center salon-photo-bg px-4"
        style={{ ['--salon-bg-image' as any]: `url(${salonBg})` }}
      >
        <div className="max-w-md w-full premium-card p-6 sm:p-8">
          <img src={logo} alt="Salão Cloud" className="h-12 w-auto mb-8 mx-auto" />
          <h1 className="font-display text-2xl font-bold text-center mb-2">
            Qual estabelecimento deseja acessar?
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Você possui {establishments.length} estabelecimentos cadastrados
          </p>
          <div className="space-y-3">
            {establishments.map((est) => (
              <button
                key={est.slug}
                onClick={() => navigate(`/portal/${est.slug}`)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary hover:shadow-md transition-all text-left"
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">{est.name}</div>
                  <div className="text-sm text-muted-foreground">/{est.slug}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex salon-photo-bg"
      style={{ ['--salon-bg-image' as any]: `url(${salonBg})` }}
    >
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16 relative z-10">
        <div className="max-w-md w-full mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar para o site
          </Link>

          <img src={logo} alt="Salão Cloud" className="h-12 w-auto mb-8" />

          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold mb-2">
              {isSignup ? "Crie sua conta" : "Bem-vindo de volta!"}
            </h1>
            <p className="text-muted-foreground">
              {isSignup
                ? "Cadastre seu salão e comece a receber agendamentos hoje."
                : "Entre para acessar seu painel"}
            </p>
          </div>

          {isSignup ? (
            <Form {...signupForm}>
              <form
                onSubmit={signupForm.handleSubmit(handleSignup)}
                className="space-y-5"
                autoComplete="off"
              >
                <FormField
                  control={signupForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="seu@email.com"
                          autoComplete="email"
                          onPointerDown={() => debug("pointer", { field: "signup.email" })}
                          onFocus={(e) =>
                            debug("focus", {
                              field: "signup.email",
                              disabled: e.currentTarget.disabled,
                              readOnly: e.currentTarget.readOnly,
                            })
                          }
                          onChange={(e) => {
                            debug("change", { field: "signup.email", len: e.target.value.length });
                            field.onChange(e);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signupForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          placeholder="Seu nome (opcional)"
                          autoComplete="name"
                          autoCapitalize="words"
                          inputMode="text"
                          onPointerDown={() => debug("pointer", { field: "signup.fullName" })}
                          onFocus={(e) =>
                            debug("focus", {
                              field: "signup.fullName",
                              disabled: e.currentTarget.disabled,
                              readOnly: e.currentTarget.readOnly,
                            })
                          }
                          onChange={(e) => {
                            debug("change", { field: "signup.fullName", len: e.target.value.length });
                            field.onChange(e);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signupForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            autoComplete="new-password"
                            onPointerDown={() => debug("pointer", { field: "signup.password" })}
                            onFocus={(e) =>
                              debug("focus", {
                                field: "signup.password",
                                disabled: e.currentTarget.disabled,
                                readOnly: e.currentTarget.readOnly,
                              })
                            }
                            onChange={(e) => {
                              debug("change", { field: "signup.password", len: e.target.value.length });
                              field.onChange(e);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signupForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar senha</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          onPointerDown={() => debug("pointer", { field: "signup.confirmPassword" })}
                          onFocus={(e) =>
                            debug("focus", {
                              field: "signup.confirmPassword",
                              disabled: e.currentTarget.disabled,
                              readOnly: e.currentTarget.readOnly,
                            })
                          }
                          onChange={(e) => {
                            debug("change", { field: "signup.confirmPassword", len: e.target.value.length });
                            field.onChange(e);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-primary hover:opacity-90 font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Criar Conta"
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <form onSubmit={handleNativeLogin} className="space-y-5">
              <div className="space-y-2">
                <FormLabel htmlFor="login-email">Email</FormLabel>
                <Input
                  id="login-email"
                  name="email"
                  type="text"
                  placeholder="seu@email.com"
                  autoComplete="username email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  className="h-14 text-lg"
                />
              </div>

              <div className="space-y-2">
                <FormLabel htmlFor="login-password">Senha</FormLabel>
                <div className="relative">
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    enterKeyHint="done"
                    className="h-14 pr-12 text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-primary hover:opacity-90 font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isSignup
                ? "Já tem uma conta? Faça login"
                : "Não tem conta? Cadastre-se"}
            </button>
          </div>
        </div>
      </div>

      {/* Right side - Decoration */}
      <div className="hidden lg:flex flex-1 bg-primary items-center justify-center p-16">
        <div className="max-w-md text-primary-foreground text-center">
          <p className="text-xs uppercase tracking-premium mb-5 opacity-80">
            Salão Cloud
          </p>
          <h2 className="font-display text-4xl font-bold mb-6 leading-tight">
            Menos preocupações.
            <br />
            Mais Clientes.
          </h2>
          <p className="text-primary-foreground/80 text-lg">
            O sistema completo para gerenciar seu salão com elegância e simplicidade.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-6 text-left">
            <div className="bg-primary-foreground/10 rounded-sm p-4">
              <div className="text-3xl font-bold">500+</div>
              <div className="text-sm text-primary-foreground/70">salões ativos</div>
            </div>
            <div className="bg-primary-foreground/10 rounded-sm p-4">
              <div className="text-3xl font-bold">10k+</div>
              <div className="text-sm text-primary-foreground/70">agendamentos/mês</div>
            </div>
            <div className="bg-primary-foreground/10 rounded-sm p-4">
              <div className="text-3xl font-bold">4.9</div>
              <div className="text-sm text-primary-foreground/70">avaliação média</div>
            </div>
            <div className="bg-primary-foreground/10 rounded-sm p-4">
              <div className="text-3xl font-bold">24/7</div>
              <div className="text-sm text-primary-foreground/70">atendimento IA</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
