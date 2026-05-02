import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
import { useSignupsEnabled } from "@/hooks/useSignupsEnabled";
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
  // Controlado dinamicamente pelo super admin em /admin/configuracoes.
  const { signupsEnabled } = useSignupsEnabled();
  const SIGNUPS_DISABLED = !signupsEnabled;
  const [isSignup, setIsSignup] = useState(searchParams.get("mode") === "signup");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user, loading } = useAuth();


  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  // Toda autenticação bem-sucedida cai no /hub central — ele decide
  // se auto-redireciona (1 destino) ou mostra seletor (2+).
  useEffect(() => {
    if (!loading && user) {
      navigate("/hub", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    setIsLoading(false);

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

    const parsed = loginSchema.safeParse({
      email: loginEmail.trim(),
      password: loginPassword,
    });

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
    if (SIGNUPS_DISABLED) {
      toast({
        variant: "destructive",
        title: "Novos cadastros suspensos",
        description: "No momento não estamos aceitando novos cadastros de salões. Em breve reabriremos as inscrições.",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(data.email, data.password, data.fullName || undefined);
    setIsLoading(false);

    if (error) {
      let message = "Erro ao criar conta. Tente novamente.";
      if (error.message?.includes("already registered") || error.message?.includes("already been registered")) {
        message = "Este email já está cadastrado. Faça login.";
      }
      toast({ variant: "destructive", title: "Ops!", description: message });
      return;
    }

    toast({
      title: "Conta criada!",
      description: "Verifique seu email para confirmar o cadastro antes de entrar.",
    });
    setIsSignup(false);
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
              {isSignup
                ? SIGNUPS_DISABLED
                  ? "Novos cadastros suspensos"
                  : "Crie sua conta"
                : "Bem-vindo de volta!"}
            </h1>
            <p className="text-muted-foreground">
              {isSignup
                ? SIGNUPS_DISABLED
                  ? "No momento não estamos aceitando novos cadastros de salões. Em breve reabriremos as inscrições."
                  : "Cadastre-se para começar a usar o Salão Cloud"
                : "Entre para acessar seu painel"}
            </p>
          </div>
          {isSignup && SIGNUPS_DISABLED ? (
            <div className="space-y-5">
              <div className="rounded-md border border-primary/30 bg-primary/5 p-5 text-sm text-foreground">
                <p className="font-semibold mb-2">Inscrições temporariamente fechadas</p>
                <p className="text-muted-foreground">
                  Estamos pausando novos cadastros de salões para garantir a melhor
                  experiência aos nossos clientes atuais. Volte em breve — reabriremos
                  as inscrições muito em breve.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setIsSignup(false)}
                className="w-full h-12 bg-gradient-primary hover:opacity-90 font-semibold"
              >
                Já tenho conta — Entrar
              </Button>
            </div>
          ) : isSignup ? (
            <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-5" noValidate>
                <FormField
                  control={signupForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Seu nome"
                          autoComplete="name"
                          className="h-14 text-lg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          className="h-14 text-lg"
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
                        <PasswordInput
                          {...field}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="h-14 text-lg"
                        />
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
                        <PasswordInput
                          {...field}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="h-14 text-lg"
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
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Criar conta"}
                </Button>
              </form>
            </Form>
          ) : (
            <form onSubmit={handleNativeLogin} className="space-y-5" key="login-form" noValidate>
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.currentTarget.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="relative z-20 pointer-events-auto touch-auto flex h-14 w-full rounded-md border border-input bg-background px-3 py-2 text-lg text-foreground caret-primary ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.currentTarget.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    enterKeyHint="done"
                    className="relative z-20 pointer-events-auto touch-auto flex h-14 w-full rounded-md border border-input bg-background px-3 py-2 pr-12 text-lg text-foreground caret-primary ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 z-30 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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

          {!SIGNUPS_DISABLED && (
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
          )}
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
