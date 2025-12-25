import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Calendar, Clock, User, Phone, Mail, ChevronLeft, ChevronRight, Check, X, Loader2 } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Appointment = Tables<"appointments"> & {
  services?: { name: string } | null;
  professionals?: { name: string } | null;
};

export default function Agenda() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchEstablishment();
    }
  }, [user]);

  useEffect(() => {
    if (establishmentId) {
      fetchAppointments();
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

  const fetchAppointments = async () => {
    if (!establishmentId) return;

    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date;

      if (viewMode === "day") {
        startDate = startOfDay(currentDate);
        endDate = addDays(startDate, 1);
      } else {
        startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
        endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
      }

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          services:service_id(name),
          professionals:professional_id(name)
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
    const days = viewMode === "day" ? 1 : 7;
    setCurrentDate(addDays(currentDate, direction * days));
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  };

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter((apt) => isSameDay(parseISO(apt.scheduled_at), date));
  };

  const timeSlots = Array.from({ length: 13 }, (_, i) => `${(i + 8).toString().padStart(2, "0")}:00`);

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
            <Select value={viewMode} onValueChange={(v: "day" | "week") => setViewMode(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Dia</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Navigation */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <h2 className="text-lg font-semibold">
                  {viewMode === "day"
                    ? format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "dd/MM")} - ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), "dd/MM/yyyy")}`}
                </h2>
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : viewMode === "week" ? (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <div className="min-w-[800px]">
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
                      <p className="text-sm font-medium">{format(day, "EEE", { locale: ptBR })}</p>
                      <p className="text-lg font-bold">{format(day, "dd")}</p>
                    </div>
                  ))}
                </div>

                {/* Time Slots */}
                {timeSlots.map((time) => (
                  <div key={time} className="grid grid-cols-8 border-b last:border-b-0">
                    <div className="p-2 text-center text-sm text-muted-foreground border-r">
                      {time}
                    </div>
                    {getWeekDays().map((day) => {
                      const dayAppointments = getAppointmentsForDay(day).filter(
                        (apt) => format(parseISO(apt.scheduled_at), "HH:00") === time
                      );
                      return (
                        <div key={day.toISOString()} className="p-1 border-r last:border-r-0 min-h-[60px]">
                          {dayAppointments.map((apt) => (
                            <button
                              key={apt.id}
                              onClick={() => {
                                setSelectedAppointment(apt);
                                setDialogOpen(true);
                              }}
                              className={`w-full text-left p-2 rounded text-xs mb-1 transition-colors ${
                                apt.status === "cancelled"
                                  ? "bg-destructive/20 text-destructive"
                                  : apt.status === "completed"
                                  ? "bg-muted text-muted-foreground"
                                  : apt.status === "confirmed"
                                  ? "bg-primary/20 text-primary"
                                  : "bg-accent/20 text-accent-foreground"
                              }`}
                            >
                              <p className="font-semibold truncate">{apt.client_name}</p>
                              <p className="truncate">{apt.services?.name}</p>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Day View */
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum agendamento</h3>
                  <p className="text-muted-foreground">Não há agendamentos para este dia.</p>
                </CardContent>
              </Card>
            ) : (
              appointments.map((apt) => (
                <Card key={apt.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => {
                  setSelectedAppointment(apt);
                  setDialogOpen(true);
                }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Clock className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{apt.client_name}</h3>
                            {getStatusBadge(apt.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{apt.services?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(apt.scheduled_at), "HH:mm")} - {apt.professionals?.name}
                          </p>
                        </div>
                      </div>
                      <p className="font-bold text-accent">R$ {Number(apt.price).toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Appointment Details Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Agendamento</DialogTitle>
              <DialogDescription>
                Visualize e gerencie este agendamento
              </DialogDescription>
            </DialogHeader>
            {selectedAppointment && (
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
                  {selectedAppointment.client_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedAppointment.client_email}</span>
                    </div>
                  )}
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
            <DialogFooter className="flex-col sm:flex-row gap-2">
              {selectedAppointment?.status === "pending" && (
                <>
                  <Button
                    variant="default"
                    onClick={() => updateAppointmentStatus(selectedAppointment.id, "confirmed")}
                  >
                    <Check className="h-4 w-4 mr-2" /> Confirmar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => updateAppointmentStatus(selectedAppointment.id, "cancelled")}
                  >
                    <X className="h-4 w-4 mr-2" /> Cancelar
                  </Button>
                </>
              )}
              {selectedAppointment?.status === "confirmed" && (
                <Button
                  variant="default"
                  onClick={() => updateAppointmentStatus(selectedAppointment.id, "completed")}
                >
                  <Check className="h-4 w-4 mr-2" /> Marcar como Concluído
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
