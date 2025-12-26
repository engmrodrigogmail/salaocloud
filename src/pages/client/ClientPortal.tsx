import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Calendar, Clock, User, Phone, CreditCard, ArrowLeft, 
  Loader2, Store, Scissors, Star, Gift, LogOut 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Establishment = Tables<"establishments">;
type Service = Tables<"services">;
type Client = Tables<"clients">;
type Appointment = Tables<"appointments"> & {
  services?: { name: string } | null;
  professionals?: { name: string } | null;
};
type LoyaltyProgram = Tables<"loyalty_programs">;
type LoyaltyPoints = Tables<"client_loyalty_points">;
type LoyaltyReward = Tables<"loyalty_rewards">;
type Promotion = Tables<"promotions">;

const ClientPortal = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState<LoyaltyPoints | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  
  // Login form
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  
  // Registration form
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerCpf, setRegisterCpf] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");

  useEffect(() => {
    if (slug) {
      fetchEstablishment();
    }
  }, [slug]);

  const fetchEstablishment = async () => {
    try {
      const { data: est, error } = await supabase
        .from("establishments")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .single();

      if (error || !est) {
        toast.error("Estabelecimento não encontrado");
        navigate("/");
        return;
      }

      setEstablishment(est);
      
      // Fetch services if catalog is enabled
      if (est.show_catalog) {
        const { data: servicesData } = await supabase
          .from("services")
          .select("*")
          .eq("establishment_id", est.id)
          .eq("is_active", true)
          .order("name");
        
        setServices(servicesData || []);
      }

      // Fetch active promotions
      const { data: promotionsData } = await supabase
        .from("promotions")
        .select("*")
        .eq("establishment_id", est.id)
        .eq("is_active", true)
        .gte("end_date", new Date().toISOString())
        .lte("start_date", new Date().toISOString());
      
      setPromotions(promotionsData || []);

      // Fetch loyalty program
      const { data: loyaltyData } = await supabase
        .from("loyalty_programs")
        .select("*")
        .eq("establishment_id", est.id)
        .eq("is_active", true)
        .maybeSingle();
      
      setLoyaltyProgram(loyaltyData);

      if (loyaltyData) {
        const { data: rewardsData } = await supabase
          .from("loyalty_rewards")
          .select("*")
          .eq("loyalty_program_id", loyaltyData.id)
          .eq("is_active", true)
          .order("points_required");
        
        setRewards(rewardsData || []);
      }

    } catch (error) {
      console.error("Error fetching establishment:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const handleLogin = async () => {
    if (!establishment) return;
    
    const cpfClean = cpf.replace(/\D/g, "");
    const phoneClean = phone.replace(/\D/g, "");
    
    if (cpfClean.length !== 11) {
      toast.error("CPF inválido");
      return;
    }
    
    if (phoneClean.length < 10) {
      toast.error("Telefone inválido");
      return;
    }

    setAuthenticating(true);

    try {
      const { data: clientData, error } = await supabase
        .from("clients")
        .select("*")
        .eq("establishment_id", establishment.id)
        .eq("cpf", cpfClean)
        .eq("phone", phoneClean)
        .maybeSingle();

      if (error) throw error;

      if (!clientData) {
        toast.error("Cliente não encontrado. Verifique seus dados ou faça seu cadastro.");
        return;
      }

      setClient(clientData);
      setIsAuthenticated(true);
      await fetchClientData(clientData.id);
      toast.success(`Bem-vindo(a), ${clientData.name}!`);
    } catch (error) {
      console.error("Error authenticating:", error);
      toast.error("Erro ao fazer login");
    } finally {
      setAuthenticating(false);
    }
  };

  const handleRegister = async () => {
    if (!establishment) return;
    
    const cpfClean = registerCpf.replace(/\D/g, "");
    const phoneClean = registerPhone.replace(/\D/g, "");
    
    if (!registerName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    
    if (cpfClean.length !== 11) {
      toast.error("CPF inválido");
      return;
    }
    
    if (phoneClean.length < 10) {
      toast.error("Telefone inválido");
      return;
    }

    setAuthenticating(true);

    try {
      // Check if client already exists
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("establishment_id", establishment.id)
        .eq("cpf", cpfClean)
        .maybeSingle();

      if (existingClient) {
        toast.error("CPF já cadastrado neste estabelecimento");
        return;
      }

      const { data: newClient, error } = await supabase
        .from("clients")
        .insert({
          establishment_id: establishment.id,
          name: registerName.trim(),
          cpf: cpfClean,
          phone: phoneClean,
        })
        .select()
        .single();

      if (error) throw error;

      setClient(newClient);
      setIsAuthenticated(true);
      
      // Create loyalty points if program exists
      if (loyaltyProgram) {
        await supabase
          .from("client_loyalty_points")
          .insert({
            client_id: newClient.id,
            loyalty_program_id: loyaltyProgram.id,
            points_balance: 0,
            total_points_earned: 0,
          });
      }
      
      toast.success(`Cadastro realizado com sucesso, ${newClient.name}!`);
    } catch (error) {
      console.error("Error registering:", error);
      toast.error("Erro ao fazer cadastro");
    } finally {
      setAuthenticating(false);
    }
  };

  const fetchClientData = async (clientId: string) => {
    try {
      // Fetch appointments
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select(`
          *,
          services:service_id(name),
          professionals:professional_id(name)
        `)
        .eq("client_id", clientId)
        .order("scheduled_at", { ascending: false });
      
      setAppointments(appointmentsData || []);

      // Fetch loyalty points if program exists
      if (loyaltyProgram) {
        const { data: pointsData } = await supabase
          .from("client_loyalty_points")
          .select("*")
          .eq("client_id", clientId)
          .eq("loyalty_program_id", loyaltyProgram.id)
          .maybeSingle();
        
        setLoyaltyPoints(pointsData);
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
    }
  };

  const handleLogout = () => {
    setClient(null);
    setIsAuthenticated(false);
    setAppointments([]);
    setLoyaltyPoints(null);
    setCpf("");
    setPhone("");
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);

      if (error) throw error;

      toast.success("Agendamento cancelado");
      if (client) {
        fetchClientData(client.id);
      }
    } catch (error) {
      console.error("Error cancelling:", error);
      toast.error("Erro ao cancelar");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      confirmed: { label: "Confirmado", variant: "default" },
      completed: { label: "Concluído", variant: "outline" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const { label, variant } = variants[status] || { label: status, variant: "outline" as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Estabelecimento não encontrado</h2>
            <p className="text-muted-foreground mb-4">O link pode estar incorreto.</p>
            <Button onClick={() => navigate("/")}>Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Login/Register screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background py-8 px-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Store className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">
              {establishment.name}
            </h1>
            <p className="text-muted-foreground">Área do Cliente</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{isRegistering ? "Novo Cadastro" : "Acesse sua conta"}</CardTitle>
              <CardDescription>
                {isRegistering 
                  ? "Preencha seus dados para se cadastrar"
                  : "Entre com seu CPF e celular"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isRegistering ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regCpf">CPF</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="regCpf"
                        value={registerCpf}
                        onChange={(e) => setRegisterCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regPhone">Celular</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="regPhone"
                        value={registerPhone}
                        onChange={(e) => setRegisterPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleRegister}
                    disabled={authenticating}
                  >
                    {authenticating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Cadastrar
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => setIsRegistering(false)}
                  >
                    Já tenho cadastro
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="cpf"
                        value={cpf}
                        onChange={(e) => setCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Celular</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleLogin}
                    disabled={authenticating}
                  >
                    {authenticating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Entrar
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => setIsRegistering(true)}
                  >
                    Não tenho cadastro
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <Button 
              variant="link" 
              onClick={() => navigate(`/${slug}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para agendamento
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated client portal
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">
              {establishment.name}
            </h1>
            <p className="text-sm text-muted-foreground">Olá, {client?.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Tabs defaultValue="appointments" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appointments">
              <Calendar className="h-4 w-4 mr-2 hidden sm:inline" />
              Agenda
            </TabsTrigger>
            {establishment.show_catalog && (
              <TabsTrigger value="services">
                <Scissors className="h-4 w-4 mr-2 hidden sm:inline" />
                Serviços
              </TabsTrigger>
            )}
            <TabsTrigger value="loyalty">
              <Star className="h-4 w-4 mr-2 hidden sm:inline" />
              Fidelidade
            </TabsTrigger>
            <TabsTrigger value="promotions">
              <Gift className="h-4 w-4 mr-2 hidden sm:inline" />
              Promoções
            </TabsTrigger>
          </TabsList>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Meus Agendamentos</h2>
              <Button onClick={() => navigate(`/${slug}`)}>
                Novo Agendamento
              </Button>
            </div>

            {appointments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum agendamento encontrado</p>
                </CardContent>
              </Card>
            ) : (
              appointments.map((appointment) => (
                <Card key={appointment.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{appointment.services?.name}</h3>
                          {getStatusBadge(appointment.status)}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(appointment.scheduled_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(appointment.scheduled_at), "HH:mm")}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {appointment.professionals?.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold text-accent">
                          R$ {Number(appointment.price).toFixed(2)}
                        </p>
                        {appointment.status === "pending" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelAppointment(appointment.id)}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Services Tab */}
          {establishment.show_catalog && (
            <TabsContent value="services" className="space-y-4">
              <h2 className="text-lg font-semibold">Nossos Serviços</h2>
              
              {services.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Scissors className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhum serviço disponível</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {services.map((service) => (
                    <Card key={service.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{service.name}</h3>
                            {service.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {service.description}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground mt-2">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {service.duration_minutes} min
                            </p>
                          </div>
                          <p className="font-bold text-accent text-lg">
                            R$ {Number(service.price).toFixed(2)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* Loyalty Tab */}
          <TabsContent value="loyalty" className="space-y-4">
            <h2 className="text-lg font-semibold">Programa de Fidelidade</h2>
            
            {!loyaltyProgram ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Este estabelecimento ainda não possui programa de fidelidade
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Points Card */}
                <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Seus pontos</p>
                        <p className="text-4xl font-bold text-primary">
                          {loyaltyPoints?.points_balance || 0}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Total acumulado: {loyaltyPoints?.total_points_earned || 0} pontos
                        </p>
                      </div>
                      <Star className="h-16 w-16 text-primary/20" />
                    </div>
                  </CardContent>
                </Card>

                {/* Rewards */}
                <h3 className="font-semibold mt-6">Recompensas Disponíveis</h3>
                {rewards.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma recompensa cadastrada</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {rewards.map((reward) => (
                      <Card 
                        key={reward.id}
                        className={loyaltyPoints && loyaltyPoints.points_balance >= reward.points_required 
                          ? "border-accent" 
                          : ""
                        }
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold">{reward.name}</h4>
                              {reward.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {reward.description}
                                </p>
                              )}
                            </div>
                            <Badge variant={
                              loyaltyPoints && loyaltyPoints.points_balance >= reward.points_required 
                                ? "default" 
                                : "secondary"
                            }>
                              {reward.points_required} pts
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Promotions Tab */}
          <TabsContent value="promotions" className="space-y-4">
            <h2 className="text-lg font-semibold">Promoções Ativas</h2>
            
            {promotions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma promoção ativa no momento</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {promotions.map((promo) => (
                  <Card key={promo.id} className="border-accent/30">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-accent/10">
                          <Gift className="h-5 w-5 text-accent" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{promo.name}</h4>
                          {promo.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {promo.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="outline">
                              {promo.discount_type === "percentage" 
                                ? `${promo.discount_value}% OFF`
                                : `R$ ${Number(promo.discount_value).toFixed(2)} OFF`
                              }
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Até {format(new Date(promo.end_date), "dd/MM/yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ClientPortal;