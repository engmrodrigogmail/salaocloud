import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Calendar, Clock, User, Phone, CreditCard, ChevronLeft, ChevronRight, 
  Check, X, Loader2, Search, Edit, Trash2, RefreshCw, Layers, Plus,
  Filter
} from "lucide-react";
import { 
  format, addDays, addMonths, addYears, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameDay, parseISO, startOfDay, startOfMonth, 
  endOfMonth, startOfYear, endOfYear, eachMonthOfInterval, setHours, setMinutes
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type Service = Tables<"services">;
type Professional = Tables<"professionals">;

type Appointment = Tables<"appointments"> & {
  services?: { name: string } | null;
  professionals?: { name: string } | null;
  clients?: { cpf: string | null } | null;
};

export default function Agenda() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "year">("week");
  
  // Dialog states
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  
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
    if (user) {
      fetchEstablishment();
    }
  }, [user]);

  useEffect(() => {
    if (establishmentId) {
      fetchAppointments();
      fetchServices();
      fetchProfessionals();
      fetchClients();
    }
  }, [establishmentId, currentDate, viewMode]);

  const fetchEstablishment = async () => {
    try {
      const { data, error } = await supabase
        .from("establishments")
        .select("id")
        .eq("owner_id", user?.id)
        .single();

      if (error) throw error;
      setEstablishmentId(data.id);
    } catch (error) {
      console.error("Error fetching establishment:", error);
    }
  };

  const fetchServices = async () => {
    if (!establishmentId) return;
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true);
    setServices(data || []);
  };

  const fetchProfessionals = async () => {
    if (!establishmentId) return;
    const { data } = await supabase
      .from("professionals")
      .select("*")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true);
    setProfessionals(data || []);
  };

  const fetchClients = async () => {
    if (!establishmentId) return;
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("establishment_id", establishmentId);
    setClients(data || []);
  };

  const fetchAppointments = async () => {
    if (!establishmentId) return;

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
        .eq("establishment_id", establishmentId)
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

  const updateAppointmentStatus = async (appointmentId: string, status: "pending" | "confirmed" | "completed" | "cancelled") => {
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
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      confirmed: { label: "Confirmado", variant: "default" },
      completed: { label: "Concluído", variant: "outline" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const { label, variant } = variants[status] || { label: status, variant: "outline" as const };
    return <Badge variant={variant}>{label}</Badge>;
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

  // Generate 30-min time slots for day view
  const timeSlots30min = Array.from({ length: 24 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minute = (i % 2) * 30;
    if (hour >= 20) return null;
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  }).filter(Boolean) as string[];

  const timeSlots = Array.from({ length: 12 }, (_, i) => `${(i + 8).toString().padStart(2, "0")}:00`);

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

  // Check if slot is free or occupied for color coding
  const getSlotStatus = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotTime = setMinutes(setHours(date, hours), minutes);
    
    const hasAppointment = filteredAppointments.some(apt => {
      if (apt.status === "cancelled") return false;
      const aptTime = parseISO(apt.scheduled_at);
      return isSameDay(aptTime, date) && format(aptTime, "HH:mm") === time;
    });
    
    return hasAppointment ? "occupied" : "free";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Agenda</h1>
            <p className="text-muted-foreground">Gerencie seus agendamentos</p>
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
              <Select value={filterProfessional} onValueChange={setFilterProfessional}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Profissionais</SelectItem>
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
        ) : viewMode === "year" ? (
          /* Year View */
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                {eachMonthOfInterval({
                  start: startOfYear(currentDate),
                  end: endOfYear(currentDate)
                }).map((month) => {
                  const monthAppts = appointments.filter(a => 
                    parseISO(a.scheduled_at).getMonth() === month.getMonth()
                  );
                  const hasAppts = monthAppts.length > 0;
                  return (
                    <button
                      key={month.toISOString()}
                      onClick={() => { setCurrentDate(month); setViewMode("month"); }}
                      className={`p-4 rounded-lg border text-center transition-all hover:border-primary ${
                        hasAppts ? "bg-primary/10 border-primary/30" : "border-border"
                      }`}
                    >
                      <p className="font-semibold capitalize">{format(month, "MMMM", { locale: ptBR })}</p>
                      <p className="text-sm text-muted-foreground">{monthAppts.length} agendamentos</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : viewMode === "month" ? (
          /* Month View */
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-1">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
                {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-2" />
                ))}
                {getMonthDays().map((day) => {
                  const dayAppts = getAppointmentsForDay(day);
                  const hasAppts = dayAppts.length > 0;
                  const isToday = isSameDay(day, new Date());
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => { setCurrentDate(day); setViewMode("day"); }}
                      className={`p-2 rounded-lg border text-center transition-all hover:border-primary min-h-[60px] ${
                        isToday ? "bg-primary/20 border-primary" : hasAppts ? "bg-accent/10" : "border-border"
                      }`}
                    >
                      <p className={`font-bold ${isToday ? "text-primary" : ""}`}>{format(day, "dd")}</p>
                      {hasAppts && (
                        <p className="text-xs text-muted-foreground">{dayAppts.length} agend.</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : viewMode === "week" ? (
          /* Week View */
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Week Header */}
                <div className="grid grid-cols-8 border-b">
                  <div className="p-3 text-center text-sm font-medium text-muted-foreground border-r">
                    Horário
                  </div>
                  {getWeekDays().map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`p-3 text-center border-r last:border-r-0 ${
                        isSameDay(day, new Date()) ? "bg-primary/10" : ""
                      }`}
                    >
                      <p className="text-sm font-medium capitalize">{format(day, "EEE", { locale: ptBR })}</p>
                      <p className="text-lg font-bold">{format(day, "dd")}</p>
                    </div>
                  ))}
                </div>

                {/* Time Slots */}
                <ScrollArea className="h-[600px]">
                  {timeSlots.map((time) => (
                    <div key={time} className="grid grid-cols-8 border-b last:border-b-0">
                      <div className="p-2 text-center text-sm text-muted-foreground border-r">
                        {time}
                      </div>
                      {getWeekDays().map((day) => {
                        const dayAppointments = getAppointmentsForDay(day).filter(
                          (apt) => format(parseISO(apt.scheduled_at), "HH:00") === time
                        );
                        const slotStatus = getSlotStatus(day, time);
                        return (
                          <div 
                            key={day.toISOString()} 
                            className={`p-1 border-r last:border-r-0 min-h-[70px] ${
                              slotStatus === "occupied" ? "bg-red-500/10" : "bg-green-500/5"
                            }`}
                          >
                            {dayAppointments.map((apt) => (
                              <button
                                key={apt.id}
                                onClick={() => {
                                  setSelectedAppointment(apt);
                                  setEditMode(false);
                                  setDialogOpen(true);
                                }}
                                className={`w-full text-left p-2 rounded text-xs mb-1 transition-colors border-l-4 ${
                                  apt.status === "cancelled"
                                    ? "bg-destructive/20 text-destructive border-destructive"
                                    : apt.status === "completed"
                                    ? "bg-muted text-muted-foreground border-muted"
                                    : apt.status === "confirmed"
                                    ? "bg-primary/20 text-primary border-primary"
                                    : "bg-accent/20 text-accent-foreground border-accent"
                                }`}
                              >
                                <p className="font-semibold truncate">{apt.client_name}</p>
                                <p className="truncate text-[10px]">{apt.services?.name}</p>
                                <p className="truncate text-[10px]">{apt.professionals?.name}</p>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Day View - 30 min slots */
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {timeSlots30min.map((time) => {
                  const dayAppointments = getAppointmentsForDay(currentDate).filter((apt) => 
                    format(parseISO(apt.scheduled_at), "HH:mm") === time
                  );
                  const slotStatus = getSlotStatus(currentDate, time);
                  
                  return (
                    <div 
                      key={time} 
                      className={`flex border-b last:border-b-0 ${
                        slotStatus === "occupied" ? "bg-red-500/10" : "bg-green-500/5"
                      }`}
                    >
                      <div className="w-20 p-3 text-center text-sm font-medium text-muted-foreground border-r flex-shrink-0">
                        {time}
                      </div>
                      <div className="flex-1 p-2 min-h-[60px]">
                        {dayAppointments.length === 0 ? (
                          <p className="text-sm text-green-600">Livre</p>
                        ) : (
                          dayAppointments.map((apt) => (
                            <button
                              key={apt.id}
                              onClick={() => {
                                setSelectedAppointment(apt);
                                setEditMode(false);
                                setDialogOpen(true);
                              }}
                              className="w-full text-left p-3 rounded-lg bg-card border hover:border-primary/50 transition-colors mb-2"
                            >
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">{apt.client_name}</span>
                                    {getStatusBadge(apt.status)}
                                  </div>
                                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Phone className="h-3 w-3" />
                                    {apt.client_phone}
                                  </p>
                                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <CreditCard className="h-3 w-3" />
                                    {formatCpf(apt.clients?.cpf)}
                                  </p>
                                  <p className="text-sm">
                                    <strong>Serviço:</strong> {apt.services?.name}
                                  </p>
                                  <p className="text-sm">
                                    <strong>Profissional:</strong> {apt.professionals?.name}
                                  </p>
                                </div>
                                <p className="font-bold text-accent">
                                  R$ {Number(apt.price).toFixed(2)}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Appointment Details/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditMode(false); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editMode ? "Editar Agendamento" : "Detalhes do Agendamento"}</DialogTitle>
              <DialogDescription>
                {editMode ? "Altere os dados do agendamento" : "Visualize e gerencie este agendamento"}
              </DialogDescription>
            </DialogHeader>
            {selectedAppointment && !editMode && (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{selectedAppointment.client_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAppointment.client_phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span>{formatCpf(selectedAppointment.clients?.cpf)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p><strong>Serviço:</strong> {selectedAppointment.services?.name}</p>
                  <p><strong>Profissional:</strong> {selectedAppointment.professionals?.name}</p>
                  <p><strong>Data/Hora:</strong> {format(parseISO(selectedAppointment.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  <p><strong>Duração:</strong> {selectedAppointment.duration_minutes} minutos</p>
                  <p><strong>Valor:</strong> R$ {Number(selectedAppointment.price).toFixed(2)}</p>
                  <p><strong>Status:</strong> {getStatusBadge(selectedAppointment.status)}</p>
                  {selectedAppointment.notes && (
                    <p><strong>Observações:</strong> {selectedAppointment.notes}</p>
                  )}
                </div>
              </div>
            )}
            {selectedAppointment && editMode && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <Select value={editServiceId} onValueChange={setEditServiceId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Profissional</Label>
                  <Select value={editProfessionalId} onValueChange={setEditProfessionalId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Observações do agendamento..."
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              {!editMode ? (
                <>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedAppointment!)}>
                      <Edit className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Excluir
                    </Button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedAppointment?.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => updateAppointmentStatus(selectedAppointment.id, "confirmed")}>
                          <Check className="h-4 w-4 mr-1" /> Confirmar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => updateAppointmentStatus(selectedAppointment.id, "cancelled")}>
                          <X className="h-4 w-4 mr-1" /> Cancelar
                        </Button>
                      </>
                    )}
                    {selectedAppointment?.status === "confirmed" && (
                      <Button size="sm" onClick={() => updateAppointmentStatus(selectedAppointment.id, "completed")}>
                        <Check className="h-4 w-4 mr-1" /> Concluir
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
                  <Button onClick={handleEditAppointment}>Salvar Alterações</Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
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
      </div>
    </DashboardLayout>
  );
}
