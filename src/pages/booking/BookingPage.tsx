import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar, Clock, User, Phone, Mail, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { format, addDays, setHours, setMinutes, isBefore, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Service = Tables<"services">;
type Professional = Tables<"professionals">;
type Establishment = Tables<"establishments">;

const BookingPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCpf, setClientCpf] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (slug) {
      fetchEstablishmentData();
    }
  }, [slug]);

  const fetchEstablishmentData = async () => {
    try {
      const { data: est, error: estError } = await supabase
        .from("establishments")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .single();

      if (estError || !est) {
        toast.error("Estabelecimento não encontrado");
        navigate("/");
        return;
      }

      setEstablishment(est);

      const { data: servicesData } = await supabase
        .from("services")
        .select("*")
        .eq("establishment_id", est.id)
        .eq("is_active", true)
        .order("name");

      setServices(servicesData || []);

      const { data: professionalsData } = await supabase
        .from("professionals")
        .select("*")
        .eq("establishment_id", est.id)
        .eq("is_active", true)
        .order("name");

      setProfessionals(professionalsData || []);
    } catch (error) {
      console.error("Error fetching establishment:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 8; hour < 20; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    return slots;
  };

  const generateDates = () => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 14; i++) {
      dates.push(addDays(today, i));
    }
    return dates;
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

  const handleSubmit = async () => {
    if (!establishment || !selectedService || !selectedProfessional || !selectedDate || !selectedTime) {
      toast.error("Por favor, complete todas as etapas");
      return;
    }

    if (!clientName.trim() || !clientPhone.trim() || !clientCpf.trim()) {
      toast.error("Nome, telefone e CPF são obrigatórios");
      return;
    }

    const cpfClean = clientCpf.replace(/\D/g, "");
    const phoneClean = clientPhone.replace(/\D/g, "");

    if (cpfClean.length !== 11) {
      toast.error("CPF inválido");
      return;
    }

    if (phoneClean.length < 10) {
      toast.error("Telefone inválido");
      return;
    }

    setSubmitting(true);

    try {
      // Check if client already exists or create new one
      let clientId: string | null = null;
      
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("establishment_id", establishment.id)
        .eq("cpf", cpfClean)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
        // Update client info if needed
        await supabase
          .from("clients")
          .update({ 
            name: clientName.trim(),
            phone: phoneClean,
            email: clientEmail || null
          })
          .eq("id", existingClient.id);
      } else {
        // Create new client
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            establishment_id: establishment.id,
            name: clientName.trim(),
            phone: phoneClean,
            cpf: cpfClean,
            email: clientEmail || null,
          })
          .select("id")
          .single();

        if (clientError) {
          console.error("Error creating client:", clientError);
        } else {
          clientId = newClient.id;
        }
      }

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      const { error } = await supabase.from("appointments").insert({
        establishment_id: establishment.id,
        service_id: selectedService.id,
        professional_id: selectedProfessional.id,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: selectedService.duration_minutes,
        price: selectedService.price,
        client_name: clientName,
        client_phone: phoneClean,
        client_email: clientEmail || null,
        client_id: clientId,
        notes: notes || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Agendamento realizado com sucesso!");
      setStep(5);
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error("Erro ao criar agendamento");
    } finally {
      setSubmitting(false);
    }
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
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Estabelecimento não encontrado</h2>
            <p className="text-muted-foreground mb-4">O link pode estar incorreto ou o estabelecimento não está ativo.</p>
            <Button onClick={() => navigate("/")}>Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            {establishment.name}
          </h1>
          <p className="text-muted-foreground">Agende seu horário online</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : s < step
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <Check className="h-5 w-5" /> : s}
            </div>
          ))}
        </div>

        {/* Step 1: Select Service */}
        {step === 1 && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Escolha o Serviço
              </CardTitle>
              <CardDescription>Selecione o serviço que deseja agendar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {services.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum serviço disponível no momento
                </p>
              ) : (
                services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-primary/50 ${
                      selectedService?.id === service.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{service.name}</h3>
                        {service.description && (
                          <p className="text-sm text-muted-foreground">{service.description}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {service.duration_minutes} min
                        </p>
                      </div>
                      <p className="font-bold text-accent">
                        R$ {Number(service.price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedService}
                >
                  Próximo <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Professional */}
        {step === 2 && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Escolha o Profissional
              </CardTitle>
              <CardDescription>Selecione o profissional de sua preferência</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {professionals.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum profissional disponível no momento
                </p>
              ) : (
                professionals.map((professional) => (
                  <div
                    key={professional.id}
                    onClick={() => setSelectedProfessional(professional)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-primary/50 ${
                      selectedProfessional?.id === professional.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{professional.name}</h3>
                        {professional.specialties && professional.specialties.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {professional.specialties.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!selectedProfessional}
                >
                  Próximo <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Select Date and Time */}
        {step === 3 && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Escolha a Data e Horário
              </CardTitle>
              <CardDescription>Selecione quando deseja ser atendido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date Selection */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Data</Label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {generateDates().map((date) => (
                    <button
                      key={date.toISOString()}
                      onClick={() => setSelectedDate(date)}
                      className={`p-2 rounded-lg border text-center transition-all hover:border-primary/50 ${
                        selectedDate?.toDateString() === date.toDateString()
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      <p className="text-xs uppercase">
                        {format(date, "EEE", { locale: ptBR })}
                      </p>
                      <p className="text-lg font-bold">{format(date, "dd")}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Selection */}
              {selectedDate && (
                <div>
                  <Label className="text-base font-semibold mb-3 block">Horário</Label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {generateTimeSlots().map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`p-2 rounded-lg border text-center transition-all hover:border-primary/50 ${
                          selectedTime === time
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={!selectedDate || !selectedTime}
                >
                  Próximo <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Client Information */}
        {step === 4 && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Seus Dados
              </CardTitle>
              <CardDescription>Preencha suas informações para confirmar o agendamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p><strong>Serviço:</strong> {selectedService?.name}</p>
                <p><strong>Profissional:</strong> {selectedProfessional?.name}</p>
                <p><strong>Data:</strong> {selectedDate && format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                <p><strong>Horário:</strong> {selectedTime}</p>
                <p><strong>Valor:</strong> R$ {Number(selectedService?.price || 0).toFixed(2)}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <Label htmlFor="cpf">CPF *</Label>
                  <Input
                    id="cpf"
                    value={clientCpf}
                    onChange={(e) => setClientCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Celular *</Label>
                  <Input
                    id="phone"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Observações (opcional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Alguma observação para o atendimento?"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !clientName.trim() || !clientPhone.trim() || !clientCpf.trim()}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Confirmar Agendamento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && (
          <Card className="border-accent/20">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
                <Check className="h-10 w-10 text-accent" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Agendamento Confirmado!</h2>
              <p className="text-muted-foreground mb-6">
                Seu agendamento foi realizado com sucesso. Você receberá uma confirmação em breve.
              </p>
              <div className="bg-muted/50 p-4 rounded-lg text-left space-y-2 mb-6">
                <p><strong>Serviço:</strong> {selectedService?.name}</p>
                <p><strong>Profissional:</strong> {selectedProfessional?.name}</p>
                <p><strong>Data:</strong> {selectedDate && format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                <p><strong>Horário:</strong> {selectedTime}</p>
              </div>
              <Button onClick={() => navigate("/")}>Voltar ao Início</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BookingPage;
