import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Calendar, Clock, User, Phone, CreditCard, ArrowLeft, 
  Loader2, Store, Scissors, Star, Gift, LogOut, Filter,
  ChevronLeft, ChevronRight, AlertCircle, FileText
} from "lucide-react";
import { format, addDays, setHours, setMinutes, startOfDay, isBefore, addMinutes, isAfter, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Establishment = Tables<"establishments"> & { cancellation_policy?: string | null };
type Service = Tables<"services">;
type Client = Tables<"clients">;
type Professional = Tables<"professionals">;
type Appointment = Tables<"appointments"> & {
  services?: { name: string } | null;
  professionals?: { name: string } | null;
};
type LoyaltyProgram = Tables<"loyalty_programs">;
type LoyaltyPoints = Tables<"client_loyalty_points">;
type LoyaltyReward = Tables<"loyalty_rewards">;
type Promotion = Tables<"promotions">;
type ScheduleSlot = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  professional_id: string;
  service_id: string;
  status: string;
};

const ClientPortal = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingCpf, setCheckingCpf] = useState(false);
  const [cpfChecked, setCpfChecked] = useState(false);
  const [clientExists, setClientExists] = useState(false);
  
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [allAppointments, setAllAppointments] = useState<ScheduleSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState<LoyaltyPoints | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [professionalServices, setProfessionalServices] = useState<{professional_id: string, service_id: string}[]>([]);
  
  // CPF check form
  const [cpfToCheck, setCpfToCheck] = useState("");
  
  // Login form
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  
  // Registration form
  const [registerName, setRegisterName] = useState("");
  const [registerCpf, setRegisterCpf] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");

  // Booking state
  const [isBooking, setIsBooking] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  // Filters for agenda view
  const [filterDate, setFilterDate] = useState<Date>(startOfDay(new Date()));
  const [filterService, setFilterService] = useState<string>("all");
  const [filterProfessional, setFilterProfessional] = useState<string>("all");

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
      
      // Fetch services
      const { data: servicesData } = await supabase
        .from("services")
        .select("*")
        .eq("establishment_id", est.id)
        .eq("is_active", true)
        .order("name");
      
      setServices(servicesData || []);

      // Fetch professionals
      const { data: professionalsData } = await supabase
        .from("professionals")
        .select("*")
        .eq("establishment_id", est.id)
        .eq("is_active", true)
        .order("name");
      
      setProfessionals(professionalsData || []);

      // Fetch professional_services
      const { data: psData } = await supabase
        .from("professional_services")
        .select("professional_id, service_id");
      
      setProfessionalServices(psData || []);

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

  // Step 1: Check if CPF exists
  const handleCheckCpf = async () => {
    if (!establishment) return;
    
    const cpfClean = cpfToCheck.replace(/\D/g, "");
    
    if (cpfClean.length !== 11) {
      toast.error("CPF inválido");
      return;
    }

    setCheckingCpf(true);

    try {
      const { data: clientData, error } = await supabase
        .from("clients")
        .select("*")
        .eq("establishment_id", establishment.id)
        .eq("cpf", cpfClean)
        .maybeSingle();

      if (error) throw error;

      setCpfChecked(true);
      
      if (clientData) {
        setClientExists(true);
        setCpf(formatCpf(cpfClean));
      } else {
        setClientExists(false);
        setRegisterCpf(formatCpf(cpfClean));
      }
    } catch (error) {
      console.error("Error checking CPF:", error);
      toast.error("Erro ao verificar CPF");
    } finally {
      setCheckingCpf(false);
    }
  };

  // State for phone confirmation dialog
  const [showPhoneConfirm, setShowPhoneConfirm] = useState(false);
  const [pendingClient, setPendingClient] = useState<Client | null>(null);
  const [newPhone, setNewPhone] = useState("");

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
      // Only check by CPF, not by phone
      const { data: clientData, error } = await supabase
        .from("clients")
        .select("*")
        .eq("establishment_id", establishment.id)
        .eq("cpf", cpfClean)
        .maybeSingle();

      if (error) throw error;

      if (!clientData) {
        toast.error("Cadastro não encontrado. Verifique o CPF.");
        return;
      }

      // Check if phone is different from registered
      if (clientData.phone !== phoneClean) {
        // Show confirmation dialog for phone update
        setPendingClient(clientData);
        setNewPhone(phoneClean);
        setShowPhoneConfirm(true);
        setAuthenticating(false);
        return;
      }

      // Phone matches, proceed with login
      setClient(clientData);
      setIsAuthenticated(true);
      await fetchClientData(clientData.id);
      await fetchAllAppointments();
      toast.success(`Bem-vindo(a), ${clientData.name}!`);
    } catch (error) {
      console.error("Error authenticating:", error);
      toast.error("Erro ao fazer login");
    } finally {
      setAuthenticating(false);
    }
  };

  const handleConfirmPhoneUpdate = async () => {
    if (!pendingClient) return;

    setAuthenticating(true);
    try {
      // Update phone number
      const { error } = await supabase
        .from("clients")
        .update({ phone: newPhone })
        .eq("id", pendingClient.id);

      if (error) throw error;

      const updatedClient = { ...pendingClient, phone: newPhone };
      setClient(updatedClient);
      setIsAuthenticated(true);
      setShowPhoneConfirm(false);
      setPendingClient(null);
      setNewPhone("");
      await fetchClientData(updatedClient.id);
      await fetchAllAppointments();
      toast.success(`Bem-vindo(a), ${updatedClient.name}! Telefone atualizado.`);
    } catch (error) {
      console.error("Error updating phone:", error);
      toast.error("Erro ao atualizar telefone");
    } finally {
      setAuthenticating(false);
    }
  };

  const handleCancelPhoneUpdate = () => {
    setShowPhoneConfirm(false);
    setPendingClient(null);
    setNewPhone("");
    setPhone("");
    toast.info("Informe o telefone cadastrado para continuar.");
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
      
      await fetchAllAppointments();
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
      // Fetch client appointments
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

  const fetchAllAppointments = async () => {
    if (!establishment) return;
    
    try {
      // Fetch all appointments for the establishment (for availability checking)
      // We only get the schedules without client info for privacy
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, duration_minutes, professional_id, service_id, status")
        .eq("establishment_id", establishment.id)
        .in("status", ["pending", "confirmed"]);
      
      setAllAppointments(data || []);
    } catch (error) {
      console.error("Error fetching all appointments:", error);
    }
  };

  const handleLogout = () => {
    setClient(null);
    setIsAuthenticated(false);
    setAppointments([]);
    setLoyaltyPoints(null);
    setCpf("");
    setPhone("");
    setCpfToCheck("");
    setCpfChecked(false);
    setClientExists(false);
    setIsBooking(false);
    setBookingStep(1);
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
        fetchAllAppointments();
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

  // Get professionals that can perform a given service
  const getProfessionalsForService = (serviceId: string) => {
    const profIds = professionalServices
      .filter(ps => ps.service_id === serviceId)
      .map(ps => ps.professional_id);
    
    // If no specific mapping, return all professionals
    if (profIds.length === 0) {
      return professionals;
    }
    
    return professionals.filter(p => profIds.includes(p.id));
  };

  // Check if a professional is available at a specific time slot considering service duration
  const isProfessionalAvailable = (date: Date, time: string, professionalId: string, durationMinutes: number) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = setMinutes(setHours(date, hours), minutes);
    const slotEnd = addMinutes(slotStart, durationMinutes);

    return !allAppointments.some(apt => {
      if (apt.status === "cancelled") return false;
      if (apt.professional_id !== professionalId) return false;
      
      const aptStart = parseISO(apt.scheduled_at);
      const aptEnd = addMinutes(aptStart, apt.duration_minutes);
      
      // Check for overlap - professional must be completely free
      return (isBefore(slotStart, aptEnd) && isAfter(slotEnd, aptStart));
    });
  };

  // Check if a time slot is available (for any professional or specific one)
  const isTimeSlotAvailable = (date: Date, time: string, professionalId: string | null, durationMinutes: number) => {
    if (professionalId) {
      return isProfessionalAvailable(date, time, professionalId, durationMinutes);
    }
    
    // If no specific professional, check if at least one is available
    const availableProfs = getProfessionalsForService(selectedService?.id || "");
    return availableProfs.some(p => isProfessionalAvailable(date, time, p.id, durationMinutes));
  };

  // Get count of appointments for a professional on a given day
  const getProfessionalDayLoad = (professionalId: string, date: Date) => {
    return allAppointments.filter(apt => {
      if (apt.status === "cancelled") return false;
      if (apt.professional_id !== professionalId) return false;
      const aptDate = parseISO(apt.scheduled_at);
      return isSameDay(aptDate, date);
    }).length;
  };

  // Auto-assign professional with load balancing
  const autoAssignProfessional = (date: Date, time: string, serviceId: string, durationMinutes: number): Professional | null => {
    const availableProfs = getProfessionalsForService(serviceId);
    
    // Filter only available professionals for this time slot
    const freeProfs = availableProfs.filter(p => 
      isProfessionalAvailable(date, time, p.id, durationMinutes)
    );
    
    if (freeProfs.length === 0) return null;
    
    // Sort by day load (ascending) to balance appointments
    freeProfs.sort((a, b) => {
      const loadA = getProfessionalDayLoad(a.id, date);
      const loadB = getProfessionalDayLoad(b.id, date);
      return loadA - loadB;
    });
    
    return freeProfs[0];
  };

  // Get max capacity for a time slot (how many professionals can handle the service)
  const getSlotCapacity = (date: Date, time: string, serviceId: string, durationMinutes: number) => {
    const availableProfs = getProfessionalsForService(serviceId);
    return availableProfs.filter(p => 
      isProfessionalAvailable(date, time, p.id, durationMinutes)
    ).length;
  };

  const handleBookingSubmit = async () => {
    if (!establishment || !client || !selectedService || !selectedDate || !selectedTime) {
      toast.error("Complete todos os campos obrigatórios");
      return;
    }

    if (establishment.cancellation_policy && !policyAccepted) {
      toast.error("Você precisa aceitar a política de cancelamento");
      return;
    }

    // Find a professional - either selected or auto-assigned with load balancing
    let professionalId = selectedProfessional?.id;
    let assignedProfessional = selectedProfessional;
    
    if (!professionalId) {
      assignedProfessional = autoAssignProfessional(
        selectedDate, 
        selectedTime, 
        selectedService.id, 
        selectedService.duration_minutes
      );
      
      if (!assignedProfessional) {
        toast.error("Não há profissionais disponíveis para este horário. Por favor, escolha outro horário.");
        return;
      }
      professionalId = assignedProfessional.id;
    } else {
      // Verify selected professional is still available
      if (!isProfessionalAvailable(selectedDate, selectedTime, professionalId, selectedService.duration_minutes)) {
        toast.error("Este profissional não está mais disponível neste horário. Por favor, escolha outro horário ou profissional.");
        return;
      }
    }

    setConfirming(true);

    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      const { error } = await supabase.from("appointments").insert({
        establishment_id: establishment.id,
        service_id: selectedService.id,
        professional_id: professionalId,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: selectedService.duration_minutes,
        price: selectedService.price,
        client_name: client.name,
        client_phone: client.phone,
        client_id: client.id,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Agendamento realizado com sucesso!");
      setIsBooking(false);
      setBookingStep(1);
      setSelectedService(null);
      setSelectedProfessional(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setPolicyAccepted(false);
      fetchClientData(client.id);
      fetchAllAppointments();
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error("Erro ao criar agendamento");
    } finally {
      setConfirming(false);
    }
  };

  // Generate dates for date picker
  const generateDates = () => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 14; i++) {
      dates.push(addDays(today, i));
    }
    return dates;
  };

  // Generate available time slots for a date and optional professional
  const generateAvailableSlots = (date: Date, professionalId: string | null, durationMinutes: number) => {
    const slots: { time: string; available: boolean; capacity: number }[] = [];
    const now = new Date();
    const serviceId = selectedService?.id || "";
    
    for (let hour = 8; hour < 20; hour++) {
      for (const minute of [0, 30]) {
        const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        const slotTime = setMinutes(setHours(date, hour), minute);
        
        // Skip past times for today
        if (isBefore(slotTime, now)) {
          continue;
        }
        
        const available = isTimeSlotAvailable(date, time, professionalId, durationMinutes);
        const capacity = getSlotCapacity(date, time, serviceId, durationMinutes);
        slots.push({ time, available, capacity });
      }
    }
    return slots;
  };

  // Find alternative suggestions when a slot is not available
  const findAlternatives = (date: Date, time: string, serviceId: string, preferredProfessionalId: string | null) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return { sameProf: [], otherProfs: [] };

    const availableProfs = getProfessionalsForService(serviceId);
    const [hours, minutes] = time.split(":").map(Number);
    
    // Same professional, different times on same day
    const sameProfAlternatives: { time: string; professional: Professional }[] = [];
    if (preferredProfessionalId) {
      const prof = professionals.find(p => p.id === preferredProfessionalId);
      if (prof) {
        // Check 2 hours before and after
        for (let h = Math.max(8, hours - 2); h <= Math.min(19, hours + 2); h++) {
          for (const m of [0, 30]) {
            const altTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
            if (altTime !== time && isProfessionalAvailable(date, altTime, preferredProfessionalId, service.duration_minutes)) {
              sameProfAlternatives.push({ time: altTime, professional: prof });
            }
          }
        }
      }
    }

    // Other professionals at the same time
    const otherProfAlternatives: { time: string; professional: Professional }[] = [];
    for (const prof of availableProfs) {
      if (prof.id !== preferredProfessionalId) {
        if (isProfessionalAvailable(date, time, prof.id, service.duration_minutes)) {
          otherProfAlternatives.push({ time, professional: prof });
        }
      }
    }

    return { sameProf: sameProfAlternatives.slice(0, 3), otherProfs: otherProfAlternatives.slice(0, 3) };
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

  // Phone confirmation dialog
  const PhoneConfirmDialog = () => (
    <Dialog open={showPhoneConfirm} onOpenChange={setShowPhoneConfirm}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Atualização de Telefone</DialogTitle>
          <DialogDescription>
            O telefone informado ({formatPhone(newPhone)}) é diferente do cadastrado ({pendingClient?.phone ? formatPhone(pendingClient.phone) : ""}).
            Deseja atualizar seu telefone de contato?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={handleCancelPhoneUpdate}>
            Não, usar o cadastrado
          </Button>
          <Button onClick={handleConfirmPhoneUpdate} disabled={authenticating}>
            {authenticating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Sim, atualizar telefone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Login/Register screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background py-8 px-4">
        <PhoneConfirmDialog />
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
              <CardTitle>
                {!cpfChecked ? "Identificação" : clientExists ? "Acesse sua conta" : "Novo Cadastro"}
              </CardTitle>
              <CardDescription>
                {!cpfChecked 
                  ? "Informe seu CPF para verificarmos seu cadastro"
                  : clientExists 
                    ? "Confirme seu telefone para continuar"
                    : "Preencha seus dados para se cadastrar"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!cpfChecked ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cpfCheck">CPF</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="cpfCheck"
                        value={cpfToCheck}
                        onChange={(e) => setCpfToCheck(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleCheckCpf}
                    disabled={checkingCpf || cpfToCheck.replace(/\D/g, "").length !== 11}
                  >
                    {checkingCpf ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Verificar CPF
                  </Button>
                </>
              ) : clientExists ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="cpf"
                        value={cpf}
                        readOnly
                        className="pl-10 bg-muted"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Celular cadastrado</Label>
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
                    onClick={() => { setCpfChecked(false); setCpfToCheck(""); }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                </>
              ) : (
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
                        readOnly
                        className="pl-10 bg-muted"
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
                    onClick={() => { setCpfChecked(false); setCpfToCheck(""); }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Booking flow
  if (isBooking) {
    const availableSlots = selectedDate && selectedService 
      ? generateAvailableSlots(selectedDate, selectedProfessional?.id || null, selectedService.duration_minutes)
      : [];

    const alternatives = selectedDate && selectedTime && selectedService && !isTimeSlotAvailable(
      selectedDate, selectedTime, selectedProfessional?.id || null, selectedService.duration_minutes
    ) ? findAlternatives(selectedDate, selectedTime, selectedService.id, selectedProfessional?.id || null) : null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => setIsBooking(false)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Portal
          </Button>

          <h1 className="text-2xl font-display font-bold text-foreground mb-6">
            Novo Agendamento
          </h1>

          {/* Step 1: Select Service */}
          {bookingStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="h-5 w-5 text-primary" />
                  Escolha o Serviço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.map((service) => (
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
                      {establishment.show_catalog && (
                        <p className="font-bold text-accent">
                          R$ {Number(service.price).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end mt-6">
                  <Button onClick={() => setBookingStep(2)} disabled={!selectedService}>
                    Próximo <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Date and Time */}
          {bookingStep === 2 && selectedService && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Escolha a Data e Horário
                </CardTitle>
                <CardDescription>
                  Serviço: {selectedService.name} ({selectedService.duration_minutes} min)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Optional Professional Selection */}
                <div>
                  <Label className="text-base font-semibold mb-3 block">Profissional (opcional)</Label>
                  <Select 
                    value={selectedProfessional?.id || "any"}
                    onValueChange={(v) => {
                      if (v === "any") {
                        setSelectedProfessional(null);
                      } else {
                        const prof = professionals.find(p => p.id === v);
                        setSelectedProfessional(prof || null);
                      }
                      setSelectedTime(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Qualquer profissional disponível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer profissional disponível</SelectItem>
                      {getProfessionalsForService(selectedService.id).map((prof) => (
                        <SelectItem key={prof.id} value={prof.id}>{prof.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Selection */}
                <div>
                  <Label className="text-base font-semibold mb-3 block">Data</Label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {generateDates().map((date) => (
                      <button
                        key={date.toISOString()}
                        onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
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
                      {availableSlots.map(({ time, available }) => (
                        <button
                          key={time}
                          onClick={() => available && setSelectedTime(time)}
                          disabled={!available}
                          className={`p-2 rounded-lg border text-center transition-all ${
                            !available 
                              ? "border-muted bg-muted text-muted-foreground cursor-not-allowed"
                              : selectedTime === time
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:border-primary/50"
                          }`}
                        >
                          {available ? time : "Ocupado"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alternative suggestions */}
                {alternatives && (alternatives.sameProf.length > 0 || alternatives.otherProfs.length > 0) && (
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-semibold flex items-center gap-2 mb-3">
                      <AlertCircle className="h-4 w-4 text-warning" />
                      Horário indisponível. Sugestões:
                    </p>
                    {alternatives.sameProf.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground mb-2">Mesmo profissional, outros horários:</p>
                        <div className="flex flex-wrap gap-2">
                          {alternatives.sameProf.map((alt, i) => (
                            <Button
                              key={i}
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedTime(alt.time)}
                            >
                              {alt.time}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    {alternatives.otherProfs.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Outros profissionais no mesmo horário:</p>
                        <div className="flex flex-wrap gap-2">
                          {alternatives.otherProfs.map((alt, i) => (
                            <Button
                              key={i}
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProfessional(alt.professional);
                                setSelectedTime(alt.time);
                              }}
                            >
                              {alt.professional.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={() => setBookingStep(1)}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  <Button
                    onClick={() => setBookingStep(3)}
                    disabled={!selectedDate || !selectedTime}
                  >
                    Próximo <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Confirmation */}
          {bookingStep === 3 && selectedService && selectedDate && selectedTime && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Confirme seu Agendamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p><strong>Serviço:</strong> {selectedService.name}</p>
                  <p><strong>Duração:</strong> {selectedService.duration_minutes} minutos</p>
                  {establishment.show_catalog && (
                    <p><strong>Valor:</strong> R$ {Number(selectedService.price).toFixed(2)}</p>
                  )}
                  <p><strong>Profissional:</strong> {selectedProfessional?.name || "Será definido conforme disponibilidade"}</p>
                  <p><strong>Data:</strong> {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                  <p><strong>Horário:</strong> {selectedTime}</p>
                </div>

                {/* Cancellation Policy */}
                {establishment.cancellation_policy && (
                  <div className="border border-border rounded-lg p-4">
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-warning" />
                      Política de Cancelamento
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {establishment.cancellation_policy}
                    </p>
                    <label className="flex items-center gap-2 mt-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={policyAccepted}
                        onChange={(e) => setPolicyAccepted(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className="text-sm">Li e aceito a política de cancelamento</span>
                    </label>
                  </div>
                )}

                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={() => setBookingStep(2)}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  <Button
                    onClick={handleBookingSubmit}
                    disabled={confirming || (!!establishment.cancellation_policy && !policyAccepted)}
                  >
                    {confirming ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Confirmar Agendamento
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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
        <Tabs defaultValue="booking" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="booking">
              <Calendar className="h-4 w-4 mr-2 hidden sm:inline" />
              Agendar
            </TabsTrigger>
            <TabsTrigger value="appointments">
              <Clock className="h-4 w-4 mr-2 hidden sm:inline" />
              Meus
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
          </TabsList>

          {/* Booking Tab */}
          <TabsContent value="booking" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Agendar Serviço</h2>
            </div>
            
            <Card>
              <CardContent className="p-6 text-center">
                <Calendar className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Pronto para agendar?</h3>
                <p className="text-muted-foreground mb-4">
                  Escolha o serviço, data e horário de sua preferência
                </p>
                <Button onClick={() => { setIsBooking(true); setBookingStep(1); }}>
                  Iniciar Agendamento
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Appointments Tab */}
          <TabsContent value="appointments" className="space-y-4">
            <h2 className="text-lg font-semibold">Meus Agendamentos</h2>

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
                        {establishment.show_catalog && (
                          <p className="font-bold text-accent">
                            R$ {Number(appointment.price).toFixed(2)}
                          </p>
                        )}
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
        </Tabs>
      </main>
    </div>
  );
};

export default ClientPortal;
