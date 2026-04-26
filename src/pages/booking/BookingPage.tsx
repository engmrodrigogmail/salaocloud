import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar, Clock, User, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, addDays, setHours, setMinutes, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { EstablishmentAIChat } from "@/components/ai-assistant/EstablishmentAIChat";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { EstablishmentNameHeader } from "@/components/branding/EstablishmentNameHeader";

type Service = Tables<"services">;
type Professional = Tables<"professionals">;
type Establishment = Tables<"establishments">;


const BookingPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isImpersonating } = useImpersonation();
  
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
    <>
      <ImpersonationBanner />
      <div
        className="min-h-screen bg-background"
        style={{ paddingTop: isImpersonating ? "2.5rem" : undefined }}
      >
        <EstablishmentNameHeader
          name={establishment.name}
          subtitle="Agende seu horário online"
        />

        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">

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
          <Card>
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
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedService?.id === service.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
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
          <Card>
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
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedProfessional?.id === professional.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 border-2 border-primary/30">
                        <AvatarImage src={professional.avatar_url || undefined} alt={professional.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {professional.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
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

