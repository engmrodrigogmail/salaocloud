import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { InternoLayout } from "@/components/layouts/InternoLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Calendar, Clock, User, Phone, ChevronLeft, ChevronRight, 
  Check, X, Loader2, Search, Edit, Trash2, RefreshCw, Plus, Filter, Receipt
} from "lucide-react";
import { 
  format, addDays, addMonths, addYears, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameDay, parseISO, startOfDay, startOfMonth, 
  endOfMonth, startOfYear, endOfYear, eachMonthOfInterval, setHours, setMinutes
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { AgendaTimeSlots } from "@/components/schedule/AgendaTimeSlots";

type Client = Tables<"clients">;
type Service = Tables<"services">;
type Professional = Tables<"professionals">;

type Appointment = Tables<"appointments"> & {
  services?: { name: string } | null;
  professionals?: { name: string } | null;
  clients?: { cpf: string | null } | null;
};

interface WorkingHours {
  [key: string]: {
    open: string;
    close: string;
    enabled: boolean;
  };
}

interface Establishment {
  id: string;
  name: string;
  owner_id: string;
  working_hours: WorkingHours | null;
  agenda_slot_interval: number | null;
  agenda_expand_hours: number | null;
}

export default function InternoAgenda() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "year">("week");
  
  // Professional-specific state
  const [currentProfessionalId, setCurrentProfessionalId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  
  // Dialog states
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // Edit form state
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editServiceId, setEditServiceId] = useState("");
  const [editProfessionalId, setEditProfessionalId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  
  // Filters
  const [filterService, setFilterService] = useState<string>("all");
  const [filterProfessional, setFilterProfessional] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/interno/${slug}/agenda`);
      return;
    }

    if (slug && user) {
      fetchEstablishment();
    }
  }, [slug, user, authLoading]);

  useEffect(() => {
    if (establishment?.id) {
      fetchAppointments();
      fetchServices();
      fetchProfessionals();
    }
  }, [establishment?.id, currentDate, viewMode]);

  // Auto-set filter to current professional's agenda if user is a professional
  useEffect(() => {
    if (role === "professional" && currentProfessionalId && filterProfessional === "all") {
      setFilterProfessional(currentProfessionalId);
    }
  }, [role, currentProfessionalId]);

  const fetchEstablishment = async () => {
    try {
      const { data, error } = await supabase
        .from("establishments")
        .select("id, name, owner_id, working_hours, agenda_slot_interval, agenda_expand_hours")
        .eq("slug", slug)
        .single();

      if (error || !data) {
        navigate("/");
        return;
      }

      // Check if user is owner OR a professional of this establishment
      const ownerCheck = data.owner_id === user?.id;
      setIsOwner(ownerCheck);
      
      if (!ownerCheck) {
        // Check if user is a professional of this establishment
        const { data: professional } = await supabase
          .from("professionals")
          .select("id")
          .eq("establishment_id", data.id)
          .eq("user_id", user?.id)
          .maybeSingle();
        
        if (!professional) {
          navigate("/");
          return;
        }
        
        // Store the professional's ID for filtering
        setCurrentProfessionalId(professional.id);
      }

      setEstablishment({
        ...data,
        working_hours: data.working_hours as unknown as WorkingHours | null,
      });
    } catch (error) {
      console.error("Error fetching establishment:", error);
      navigate("/");
    }
  };

  const fetchServices = async () => {
    if (!establishment?.id) return;
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("establishment_id", establishment.id)
      .eq("is_active", true);
    setServices(data || []);
  };

  const fetchProfessionals = async () => {
    if (!establishment?.id) return;
    const { data } = await supabase
      .from("professionals")
      .select("*")
      .eq("establishment_id", establishment.id)
      .eq("is_active", true);
    setProfessionals(data || []);
  };

  const fetchAppointments = async () => {
    if (!establishment?.id) return;

    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date;

      if (viewMode === "day") {
        startDate = startOfDay(currentDate);
        endDate = addDays(startDate, 1);
      } else if (viewMode === "week") {
        startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
        endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
      } else if (viewMode === "month") {
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
      } else {
        startDate = startOfYear(currentDate);
        endDate = endOfYear(currentDate);
      }

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          services:service_id(name),
          professionals:professional_id(name),
          clients:client_id(cpf)
        `)
        .eq("establishment_id", establishment.id)
        .gte("scheduled_at", startDate.toISOString())
        .lte("scheduled_at", endDate.toISOString())
        .order("scheduled_at");

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  };

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      if (filterService !== "all" && apt.service_id !== filterService) return false;
      if (filterProfessional !== "all" && apt.professional_id !== filterProfessional) return false;
      if (filterSearch) {
        const search = filterSearch.toLowerCase();
        const cpfClean = apt.clients?.cpf?.replace(/\D/g, "") || "";
        const phoneClean = apt.client_phone?.replace(/\D/g, "") || "";
        if (
          !apt.client_name.toLowerCase().includes(search) &&
          !cpfClean.includes(search.replace(/\D/g, "")) &&
          !phoneClean.includes(search.replace(/\D/g, "")) &&
          !apt.services?.name?.toLowerCase().includes(search) &&
          !apt.professionals?.name?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [appointments, filterService, filterProfessional, filterSearch]);

  const updateAppointmentStatus = async (appointmentId: string, status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show") => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", appointmentId);

      if (error) throw error;
      toast.success(`Status atualizado`);
      fetchAppointments();
      setDialogOpen(false);
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleEditAppointment = async () => {
    if (!selectedAppointment) return;

    try {
      const scheduledAt = new Date(`${editDate}T${editTime}`);
      const service = services.find(s => s.id === editServiceId);

      const { error } = await supabase
        .from("appointments")
        .update({
          scheduled_at: scheduledAt.toISOString(),
          service_id: editServiceId,
          professional_id: editProfessionalId,
          duration_minutes: service?.duration_minutes || selectedAppointment.duration_minutes,
          price: service?.price || selectedAppointment.price,
          notes: editNotes,
        })
        .eq("id", selectedAppointment.id);

      if (error) throw error;
      toast.success("Agendamento atualizado");
      fetchAppointments();
      setEditMode(false);
      setDialogOpen(false);
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast.error("Erro ao atualizar agendamento");
    }
  };

  const handleOpenTabFromAppointment = async () => {
    if (!selectedAppointment || !establishment) return;
    try {
      const { data: tab, error: tabError } = await supabase
        .from("tabs")
        .insert({
          establishment_id: establishment.id,
          client_name: selectedAppointment.client_name,
          client_id: selectedAppointment.client_id ?? null,
          appointment_id: selectedAppointment.id,
          professional_id: selectedAppointment.professional_id,
          status: "open",
          subtotal: 0,
          total: 0,
        })
        .select("id")
        .single();

      if (tabError || !tab) throw tabError;

      const { error: updError } = await supabase
        .from("appointments")
        .update({ status: "in_service", previous_status: selectedAppointment.status } as never)
        .eq("id", selectedAppointment.id);

      if (updError) throw updError;

      toast.success("Comanda aberta. Agenda bloqueada até o fechamento.");
      setDialogOpen(false);
      fetchAppointments();
      navigate(`/interno/${slug}/comandas`);
    } catch (error) {
      console.error("Error opening tab from appointment:", error);
      toast.error("Erro ao abrir comanda");
    }
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;

    try {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", selectedAppointment.id);

      if (error) throw error;
      toast.success("Agendamento excluído");
      fetchAppointments();
      setDeleteConfirmOpen(false);
      setDialogOpen(false);
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast.error("Erro ao excluir agendamento");
    }
  };

  const openViewDialog = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setEditMode(false);
    setDialogOpen(true);
  };

  const openEditDialog = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setEditDate(format(parseISO(apt.scheduled_at), "yyyy-MM-dd"));
    setEditTime(format(parseISO(apt.scheduled_at), "HH:mm"));
    setEditServiceId(apt.service_id);
    setEditProfessionalId(apt.professional_id);
    setEditNotes(apt.notes || "");
    setEditMode(true);
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      pending: { label: "Pendente", variant: "secondary", className: "bg-amber-100 text-amber-800 border-amber-300" },
      confirmed: { label: "Confirmado", variant: "default", className: "bg-blue-100 text-blue-800 border-blue-300" },
      in_service: { label: "Em atendimento", variant: "default", className: "bg-violet-100 text-violet-800 border-violet-300" },
      completed: { label: "Concluído", variant: "outline", className: "bg-green-100 text-green-800 border-green-300" },
      cancelled: { label: "Cancelado", variant: "destructive" },
      no_show: { label: "Não compareceu", variant: "outline", className: "bg-orange-100 text-orange-800 border-orange-300" },
    };
    const { label, variant, className } = variants[status] || { label: status, variant: "outline" as const };
    return <Badge variant={variant} className={className}>{label}</Badge>;
  };

  const navigateDate = (direction: number) => {
    if (viewMode === "day") {
      setCurrentDate(addDays(currentDate, direction));
    } else if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, direction * 7));
    } else if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, direction));
    } else {
      setCurrentDate(addYears(currentDate, direction));
    }
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  };

  const getMonthDays = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getAppointmentsForDay = (date: Date) => {
    return filteredAppointments.filter((apt) => isSameDay(parseISO(apt.scheduled_at), date));
  };

  const formatCpf = (cpf: string | null | undefined) => {
    if (!cpf) return "-";
    const clean = cpf.replace(/\D/g, "");
    if (clean.length !== 11) return cpf;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
  };

  // Generate 30-min time slots for day view (8h-20h)
  const timeSlots30min = Array.from({ length: 24 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minute = (i % 2) * 30;
    if (hour >= 20) return null;
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  }).filter(Boolean) as string[];

  const getDateLabel = () => {
    if (viewMode === "day") {
      return format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } else if (viewMode === "week") {
      return `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "dd/MM")} - ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), "dd/MM/yyyy")}`;
    } else if (viewMode === "month") {
      return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    } else {
      return format(currentDate, "yyyy");
    }
  };

  const getSlotStatus = (date: Date, time: string) => {
    const hasAppointment = filteredAppointments.some(apt => {
      if (apt.status === "cancelled") return false;
      const aptTime = parseISO(apt.scheduled_at);
      return isSameDay(aptTime, date) && format(aptTime, "HH:mm") === time;
    });
    
    return hasAppointment ? "occupied" : "free";
  };

  const getAppointmentAtSlot = (date: Date, time: string): Appointment | undefined => {
    return filteredAppointments.find(apt => {
      if (apt.status === "cancelled") return false;
      const aptTime = parseISO(apt.scheduled_at);
      return isSameDay(aptTime, date) && format(aptTime, "HH:mm") === time;
    });
  };

  if (authLoading) {
    return (
      <InternoLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96" />
        </div>
      </InternoLayout>
    );
  }

  return (
    <InternoLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Agenda</h1>
            <p className="text-muted-foreground">Gerencie os agendamentos do dia</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(v: "day" | "week" | "month" | "year") => setViewMode(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Diária</SelectItem>
                <SelectItem value="week">Semanal</SelectItem>
                <SelectItem value="month">Mensal</SelectItem>
                <SelectItem value="year">Anual</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
              Hoje
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CPF, celular..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterService} onValueChange={setFilterService}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Serviços</SelectItem>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={filterProfessional} 
                onValueChange={setFilterProfessional}
                disabled={role === "professional" && !isOwner}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  {/* Only show "Todos" option for owners */}
                  {isOwner && <SelectItem value="all">Todos Profissionais</SelectItem>}
                  {professionals.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Date Navigation */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <h2 className="text-lg font-semibold capitalize">{getDateLabel()}</h2>
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {/* Color Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500" />
                <span className="text-sm">Livre</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500" />
                <span className="text-sm">Ocupado</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : viewMode === "day" ? (
          <Card>
            <CardContent className="p-4">
              <AgendaTimeSlots
                date={currentDate}
                appointments={filteredAppointments}
                professionals={professionals}
                workingHours={establishment?.working_hours || null}
                slotInterval={establishment?.agenda_slot_interval || 30}
                expandHours={establishment?.agenda_expand_hours || 1}
                onAppointmentClick={openViewDialog}
                viewMode="day"
              />
            </CardContent>
          </Card>
        ) : viewMode === "week" ? (
          <Card>
            <CardContent className="p-4 overflow-x-auto">
              <div className="grid grid-cols-7 gap-2 min-w-[700px]">
                {getWeekDays().map((day) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={day.toISOString()} className="space-y-2">
                      <div className={`text-center p-2 rounded-lg ${isToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <div className="text-xs">{format(day, "EEE", { locale: ptBR })}</div>
                        <div className="text-lg font-bold">{format(day, "dd")}</div>
                      </div>
                      <AgendaTimeSlots
                        date={day}
                        appointments={filteredAppointments}
                        professionals={professionals}
                        workingHours={establishment?.working_hours || null}
                        slotInterval={establishment?.agenda_slot_interval || 30}
                        expandHours={establishment?.agenda_expand_hours || 1}
                        onAppointmentClick={openViewDialog}
                        viewMode="week"
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : viewMode === "month" ? (
          /* Month View */
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-2">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                  <div key={d} className="text-center text-sm font-medium text-muted-foreground py-2">{d}</div>
                ))}
                {getMonthDays().map((day, idx) => {
                  const dayAppointments = getAppointmentsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const startPadding = idx === 0 ? day.getDay() : 0;
                  return (
                    <>
                      {idx === 0 && Array.from({ length: startPadding }).map((_, i) => (
                        <div key={`pad-${i}`} />
                      ))}
                      <div
                        key={day.toISOString()}
                        className={`min-h-[80px] p-1 border rounded-lg ${
                          isToday ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : ""}`}>
                          {format(day, "dd")}
                        </div>
                        {dayAppointments.length > 0 ? (
                          <div className={`text-xs px-1 py-0.5 rounded ${
                            dayAppointments.some(a => a.status !== "cancelled") 
                              ? "bg-red-500/20 text-red-700" 
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {dayAppointments.filter(a => a.status !== "cancelled").length} agend.
                          </div>
                        ) : (
                          <div className="text-xs px-1 py-0.5 rounded bg-green-500/20 text-green-700">
                            Livre
                          </div>
                        )}
                      </div>
                    </>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Year View */
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                {eachMonthOfInterval({
                  start: startOfYear(currentDate),
                  end: endOfYear(currentDate)
                }).map((month) => {
                  const monthStart = startOfMonth(month);
                  const monthEnd = endOfMonth(month);
                  const monthAppointments = appointments.filter(apt => {
                    const aptDate = parseISO(apt.scheduled_at);
                    return aptDate >= monthStart && aptDate <= monthEnd && apt.status !== "cancelled";
                  });
                  return (
                    <div 
                      key={month.toISOString()} 
                      className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => { setCurrentDate(month); setViewMode("month"); }}
                    >
                      <div className="text-lg font-medium capitalize">
                        {format(month, "MMMM", { locale: ptBR })}
                      </div>
                      <div className="text-2xl font-bold text-primary">{monthAppointments.length}</div>
                      <div className="text-xs text-muted-foreground">agendamentos</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMode ? "Editar Agendamento" : "Detalhes do Agendamento"}</DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <>
              {editMode ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Data</Label>
                      <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                    </div>
                    <div>
                      <Label>Horário</Label>
                      <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Serviço</Label>
                    <Select value={editServiceId} onValueChange={setEditServiceId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {services.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Profissional</Label>
                    <Select value={editProfessionalId} onValueChange={setEditProfessionalId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {professionals.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium">{selectedAppointment.client_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Telefone:</span>
                    <span>{selectedAppointment.client_phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CPF:</span>
                    <span>{formatCpf(selectedAppointment.clients?.cpf)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serviço:</span>
                    <span>{selectedAppointment.services?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profissional:</span>
                    <span>{selectedAppointment.professionals?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data/Hora:</span>
                    <span>{format(parseISO(selectedAppointment.scheduled_at), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preço:</span>
                    <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selectedAppointment.price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    {getStatusBadge(selectedAppointment.status)}
                  </div>
                  {selectedAppointment.notes && (
                    <div>
                      <span className="text-muted-foreground">Observações:</span>
                      <p className="mt-1 text-sm">{selectedAppointment.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
                <Button onClick={handleEditAppointment}>Salvar</Button>
              </>
            ) : (
              <>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedAppointment!)}>
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                </div>
                {selectedAppointment?.status === "pending" && (
                  <Button size="sm" onClick={() => updateAppointmentStatus(selectedAppointment.id, "confirmed")}>
                    <Check className="h-4 w-4 mr-1" /> Confirmar
                  </Button>
                )}
                {(selectedAppointment?.status === "pending" || selectedAppointment?.status === "confirmed") && (
                  <Button size="sm" variant="secondary" onClick={handleOpenTabFromAppointment}>
                    <Receipt className="h-4 w-4 mr-1" /> Abrir comanda
                  </Button>
                )}
                {selectedAppointment?.status === "confirmed" && (
                  <Button size="sm" onClick={() => updateAppointmentStatus(selectedAppointment.id, "completed")}>
                    <Check className="h-4 w-4 mr-1" /> Concluir
                  </Button>
                )}
                {(selectedAppointment?.status === "pending" || selectedAppointment?.status === "confirmed") && (
                  <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => updateAppointmentStatus(selectedAppointment.id, "no_show")}>
                    <X className="h-4 w-4 mr-1" /> Marcou falta
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  <X className="h-4 w-4 mr-1" /> Fechar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteAppointment}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InternoLayout>
  );
}
