import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, ArrowLeft, Building2, Clock, Check, Loader2, Calendar, Users, Settings, Scissors, CreditCard, ExternalLink, Copy, MapPin, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo-salaocloud-v5.png";
import salonBg from "@/assets/salon-dark-bg.png";

const onboardingSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  slug: z.string().min(2, "URL deve ter pelo menos 2 caracteres").regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  description: z.string().optional(),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

const steps = [
  { id: 1, title: "Dados Básicos", description: "Nome e contato" },
  { id: 2, title: "Endereço", description: "Localização" },
  { id: 3, title: "Revisão", description: "Confirmar" },
];

interface QuickLink {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  priority: "high" | "medium";
}

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [createdSlug, setCreatedSlug] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: "",
      slug: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      description: "",
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (value: string) => {
    form.setValue("name", value);
    if (!form.getValues("slug")) {
      form.setValue("slug", generateSlug(value));
    }
  };

  const handleSubmit = async (data: OnboardingFormData) => {
    if (!user) return;

    setIsLoading(true);

    try {
      // Create establishment
      const { error: estError } = await supabase.from("establishments").insert({
        owner_id: user.id,
        name: data.name,
        slug: data.slug,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        description: data.description || null,
        status: "active",
      });

      if (estError) {
        if (estError.message.includes("duplicate")) {
          toast({
            variant: "destructive",
            title: "Ops!",
            description: "Esta URL já está em uso. Escolha outra.",
          });
          setIsLoading(false);
          return;
        }
        throw estError;
      }

      // Add establishment role to user
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: user.id,
        role: "establishment",
      });

      if (roleError && !roleError.message.includes("duplicate")) {
        console.error("Role error:", roleError);
      }

      setCreatedSlug(data.slug);
      setIsComplete(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível criar o estabelecimento.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = async () => {
    if (currentStep === 1) {
      const isValid = await form.trigger(["name", "slug", "phone", "email"]);
      if (!isValid) return;
    }
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Link copiado para a área de transferência.",
    });
  };

  const quickLinks: QuickLink[] = [
    {
      title: "Cadastrar Serviços",
      description: "Adicione os serviços que você oferece com preços e duração",
      href: `/portal/${createdSlug}/servicos`,
      icon: <Scissors className="h-5 w-5" />,
      priority: "high",
    },
    {
      title: "Cadastrar Profissionais",
      description: "Registre sua equipe para gerenciar agendamentos",
      href: `/portal/${createdSlug}/profissionais`,
      icon: <Users className="h-5 w-5" />,
      priority: "high",
    },
    {
      title: "Configurar Horários",
      description: "Defina os horários de funcionamento do seu espaço",
      href: `/portal/${createdSlug}/configuracoes`,
      icon: <Clock className="h-5 w-5" />,
      priority: "high",
    },
    {
      title: "Ver Agenda",
      description: "Acompanhe e gerencie os agendamentos",
      href: `/portal/${createdSlug}/agenda`,
      icon: <Calendar className="h-5 w-5" />,
      priority: "medium",
    },
    {
      title: "Painel Interno",
      description: "Acesse comandas e operações do dia a dia",
      href: `/interno/${createdSlug}`,
      icon: <CreditCard className="h-5 w-5" />,
      priority: "medium",
    },
    {
      title: "Configurações",
      description: "Personalize seu estabelecimento e preferências",
      href: `/portal/${createdSlug}/configuracoes`,
      icon: <Settings className="h-5 w-5" />,
      priority: "medium",
    },
  ];

  // Welcome screen after successful creation
  if (isComplete) {
    const bookingUrl = `salaocloud.com.br/${createdSlug}`;
    const fullBookingUrl = `https://salaocloud.com.br/${createdSlug}`;

    return (
      <div
        className="min-h-screen salon-photo-bg flex flex-col"
        style={{ ['--salon-bg-image' as any]: `url(${salonBg})` }}
      >
        {/* Header */}
        <header className="bg-background border-b border-border py-4 px-6">
          <img src={logo} alt="Salão Cloud" className="h-10 w-auto" />
        </header>

        <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success/10 flex items-center justify-center animate-in zoom-in duration-300">
              <Check className="h-10 w-10 text-success" />
            </div>
            <h1 className="font-display text-3xl font-bold mb-2">
              Parabéns! Seu espaço está pronto! 🎉
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Seu estabelecimento <strong>{form.getValues("name")}</strong> foi criado com sucesso. 
              Veja abaixo como começar a usar o sistema.
            </p>
          </div>

          {/* Booking Link Card */}
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                    <ExternalLink className="h-5 w-5 text-primary" />
                    Link de Agendamento para Clientes
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Compartilhe este link com seus clientes para que eles possam agendar online:
                  </p>
                  <div className="flex items-center gap-2 bg-background rounded-lg px-4 py-2 border">
                    <span className="font-mono text-sm">{bookingUrl}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(fullBookingUrl)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.open(`/${createdSlug}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Start Section */}
          <div className="mb-8">
            <h2 className="font-display text-xl font-semibold mb-4">
              🚀 Primeiros Passos (Recomendado)
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {quickLinks
                .filter((link) => link.priority === "high")
                .map((link, index) => (
                  <Card
                    key={link.title}
                    className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                    onClick={() => navigate(link.href)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {link.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                              Passo {index + 1}
                            </span>
                          </div>
                          <h3 className="font-medium mt-1">{link.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {link.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>

          {/* Other Features Section */}
          <div className="mb-8">
            <h2 className="font-display text-xl font-semibold mb-4">
              📋 Outras Funcionalidades
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {quickLinks
                .filter((link) => link.priority === "medium")
                .map((link) => (
                  <Card
                    key={link.title}
                    className="cursor-pointer hover:border-primary/30 transition-all"
                    onClick={() => navigate(link.href)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        {link.icon}
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{link.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {link.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>

          {/* Info Box */}
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">💡 Dica</h3>
              <p className="text-sm text-muted-foreground">
                Para acessar seu painel a qualquer momento, vá para{" "}
                <strong>salaocloud.com.br/portal/{createdSlug}</strong>. 
                Você também pode acessar pelo menu principal após fazer login.
              </p>
            </CardContent>
          </Card>

          {/* CTA Button */}
          <div className="mt-8 text-center">
            <Button
              size="lg"
              className="bg-gradient-primary"
              onClick={() => navigate(`/portal/${createdSlug}/servicos`)}
            >
              Começar a Configurar
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              ou{" "}
              <button
                className="underline hover:text-primary"
                onClick={() => navigate("/dashboard")}
              >
                ir para o painel principal
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen salon-photo-bg flex flex-col"
      style={{ ['--salon-bg-image' as any]: `url(${salonBg})` }}
    >
      {/* Header */}
      <header className="bg-background border-b border-border py-4 px-6">
        <img src={logo} alt="Salão Cloud" className="h-10 w-auto" />
      </header>

      <div className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
        {/* Aviso para quem chegou aqui sem ser dono */}
        <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
          <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Não encontramos um salão vinculado ao seu email</p>
            <p className="text-muted-foreground">
              Se você é <strong>profissional</strong> ou <strong>cliente</strong> de um salão, peça ao dono para cadastrar o email <strong>{user?.email}</strong> no seu perfil — assim o sistema reconhece automaticamente.
              Se você é <strong>dono</strong>, continue abaixo para criar seu estabelecimento.
            </p>
            <button
              type="button"
              onClick={() => navigate("/hub")}
              className="text-primary hover:underline mt-2 font-medium"
            >
              ← Voltar ao hub
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    currentStep > step.id
                      ? "bg-success text-success-foreground"
                      : currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? <Check size={18} /> : step.id}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-24 sm:w-32 h-1 mx-2 rounded ${
                      currentStep > step.id ? "bg-success" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step) => (
              <div key={step.id} className="text-center" style={{ width: "80px" }}>
                <div className="text-sm font-medium">{step.title}</div>
                <div className="text-xs text-muted-foreground">{step.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="bg-card rounded-2xl border border-border p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {currentStep === 1 && (
                <>
                  <div className="text-center mb-8">
                    <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
                    <h2 className="font-display text-2xl font-bold">
                      Vamos configurar seu espaço!
                    </h2>
                    <p className="text-muted-foreground mt-2">
                      Comece com as informações básicas do seu salão ou barbearia
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do estabelecimento *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Salão da Maria"
                            {...field}
                            onChange={(e) => handleNameChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de agendamento *</FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                            <span className="text-sm text-muted-foreground mr-2 whitespace-nowrap">
                              salaocloud.com.br/
                            </span>
                            <Input placeholder="meu-salao" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription className="text-xs">
                          Este será o link que seus clientes usarão para agendar online. 
                          <br />
                          <strong>Exemplo:</strong> Se você digitar <code className="bg-muted px-1 rounded">barbearia-style</code>, 
                          o link ficará: <code className="bg-muted px-1 rounded">salaocloud.com.br/barbearia-style</code>
                          <br />
                          <span className="text-muted-foreground">Use apenas letras minúsculas, números e hífens (sem espaços ou acentos).</span>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 99999-9999" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="contato@meusalao.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <div className="text-center mb-8">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-primary" />
                    <h2 className="font-display text-2xl font-bold">
                      Onde fica seu espaço?
                    </h2>
                    <p className="text-muted-foreground mt-2">
                      Essas informações são opcionais mas ajudam seus clientes
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Rua das Flores, 123"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="São Paulo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <FormControl>
                            <Input placeholder="SP" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Conte um pouco sobre seu espaço..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentStep === 3 && (
                <>
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
                      <Check className="h-8 w-8 text-success" />
                    </div>
                    <h2 className="font-display text-2xl font-bold">
                      Tudo pronto!
                    </h2>
                    <p className="text-muted-foreground mt-2">
                      Confira se está tudo certo e vamos começar
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-xl p-6 space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Nome</div>
                      <div className="font-medium">{form.getValues("name")}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">URL de agendamento</div>
                      <div className="font-medium">salaocloud.com.br/{form.getValues("slug")}</div>
                    </div>
                    {form.getValues("phone") && (
                      <div>
                        <div className="text-sm text-muted-foreground">Telefone</div>
                        <div className="font-medium">{form.getValues("phone")}</div>
                      </div>
                    )}
                    {form.getValues("city") && (
                      <div>
                        <div className="text-sm text-muted-foreground">Localização</div>
                        <div className="font-medium">
                          {form.getValues("city")}, {form.getValues("state")}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>

                {currentStep < steps.length ? (
                  <Button type="button" onClick={nextStep}>
                    Próximo
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="bg-gradient-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Criar meu espaço
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
