import { useMemo, useState } from "react";
import { format, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Clock } from "lucide-react";
import { ConfirmedIndicator } from "./ConfirmedIndicator";
import type { Tables } from "@/integrations/supabase/types";

type Appointment = Tables<"appointments"> & {
  services?: { name: string } | null;
  professionals?: { name: string } | null;
  clients?: { cpf: string | null } | null;
  confirmed_at?: string | null;
};

type Professional = Tables<"professionals">;

interface WorkingHours {
  [key: string]: {
    open: string;
    close: string;
    enabled: boolean;
  };
}

interface AgendaTimeSlotsProps {
  date: Date;
  appointments: Appointment[];
  professionals: Professional[];
  workingHours: WorkingHours | null;
  slotInterval: number; // 15, 30, 60
  expandHours: number; // hours before/after working hours
  onAppointmentClick: (apt: Appointment) => void;
  viewMode: "day" | "week";
}

// Cores fixas para profissionais (até 12 cores distintas)
const PROFESSIONAL_COLORS = [
  { bg: "bg-blue-100 dark:bg-blue-900/40", border: "border-blue-400", text: "text-blue-800 dark:text-blue-200" },
  { bg: "bg-purple-100 dark:bg-purple-900/40", border: "border-purple-400", text: "text-purple-800 dark:text-purple-200" },
  { bg: "bg-emerald-100 dark:bg-emerald-900/40", border: "border-emerald-400", text: "text-emerald-800 dark:text-emerald-200" },
  { bg: "bg-orange-100 dark:bg-orange-900/40", border: "border-orange-400", text: "text-orange-800 dark:text-orange-200" },
  { bg: "bg-pink-100 dark:bg-pink-900/40", border: "border-pink-400", text: "text-pink-800 dark:text-pink-200" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/40", border: "border-cyan-400", text: "text-cyan-800 dark:text-cyan-200" },
  { bg: "bg-amber-100 dark:bg-amber-900/40", border: "border-amber-400", text: "text-amber-800 dark:text-amber-200" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/40", border: "border-indigo-400", text: "text-indigo-800 dark:text-indigo-200" },
  { bg: "bg-rose-100 dark:bg-rose-900/40", border: "border-rose-400", text: "text-rose-800 dark:text-rose-200" },
  { bg: "bg-teal-100 dark:bg-teal-900/40", border: "border-teal-400", text: "text-teal-800 dark:text-teal-200" },
  { bg: "bg-lime-100 dark:bg-lime-900/40", border: "border-lime-400", text: "text-lime-800 dark:text-lime-200" },
  { bg: "bg-violet-100 dark:bg-violet-900/40", border: "border-violet-400", text: "text-violet-800 dark:text-violet-200" },
];

export function AgendaTimeSlots({
  date,
  appointments,
  professionals,
  workingHours,
  slotInterval,
  expandHours,
  onAppointmentClick,
  viewMode,
}: AgendaTimeSlotsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Mapear profissionais para cores
  const professionalColorMap = useMemo(() => {
    const map: Record<string, typeof PROFESSIONAL_COLORS[0]> = {};
    professionals.forEach((pro, index) => {
      map[pro.id] = PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length];
    });
    return map;
  }, [professionals]);

  // Calcular horários do dia baseado no working_hours
  const { startHour, endHour, dayEnabled } = useMemo(() => {
    const dayOfWeek = date.getDay().toString();
    const dayConfig = workingHours?.[dayOfWeek];
    
    if (!dayConfig?.enabled) {
      return { startHour: 8, endHour: 18, dayEnabled: false };
    }
    
    const openHour = parseInt(dayConfig.open.split(":")[0]);
    const closeHour = parseInt(dayConfig.close.split(":")[0]);
    
    return {
      startHour: openHour,
      endHour: closeHour,
      dayEnabled: true,
    };
  }, [date, workingHours]);

  // Gerar slots de tempo
  const timeSlots = useMemo(() => {
    const effectiveExpandHours = isExpanded ? expandHours : 0;
    const start = Math.max(0, startHour - effectiveExpandHours);
    const end = Math.min(24, endHour + effectiveExpandHours);
    
    const slots: string[] = [];
    const slotsPerHour = 60 / slotInterval;
    
    for (let hour = start; hour < end; hour++) {
      for (let i = 0; i < slotsPerHour; i++) {
        const minute = i * slotInterval;
        slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
      }
    }
    
    return slots;
  }, [startHour, endHour, slotInterval, isExpanded, expandHours]);

  // Agrupar agendamentos por horário
  const appointmentsBySlot = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    
    appointments.forEach((apt) => {
      if (apt.status === "cancelled") return;
      const aptDate = parseISO(apt.scheduled_at);
      if (!isSameDay(aptDate, date)) return;
      
      const time = format(aptDate, "HH:mm");
      if (!map[time]) map[time] = [];
      map[time].push(apt);
    });
    
    return map;
  }, [appointments, date]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Pend.", className: "bg-amber-200 text-amber-900 text-[10px] px-1" },
      confirmed: { label: "Conf.", className: "bg-blue-200 text-blue-900 text-[10px] px-1" },
      completed: { label: "Conc.", className: "bg-green-200 text-green-900 text-[10px] px-1" },
    };
    const config = variants[status] || { label: status, className: "" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const isOutsideWorkingHours = (time: string) => {
    if (!dayEnabled) return true;
    const hour = parseInt(time.split(":")[0]);
    return hour < startHour || hour >= endHour;
  };

  if (viewMode === "day") {
    return (
      <div className="space-y-2">
        {/* Botões de expandir/contrair */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {dayEnabled 
                ? `Expediente: ${startHour.toString().padStart(2, "0")}:00 - ${endHour.toString().padStart(2, "0")}:00`
                : "Fechado"
              }
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 text-xs"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Contrair
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Expandir ±{expandHours}h
                </>
              )}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[600px]">
          <div className="space-y-1">
            {timeSlots.map((time) => {
              const slotAppointments = appointmentsBySlot[time] || [];
              const hasAppointments = slotAppointments.length > 0;
              const isOutside = isOutsideWorkingHours(time);

              return (
                <div
                  key={time}
                  className={`rounded-lg border transition-colors ${
                    isOutside 
                      ? "bg-muted/30 border-muted" 
                      : hasAppointments 
                        ? "bg-background border-border" 
                        : "bg-green-500/10 border-green-500/30"
                  }`}
                >
                  <div className="flex items-stretch gap-2 p-2">
                    <div className={`w-14 flex-shrink-0 font-mono text-sm font-medium py-1 ${
                      isOutside ? "text-muted-foreground" : ""
                    }`}>
                      {time}
                    </div>
                    
                    {hasAppointments ? (
                      <div className="flex-1 flex flex-wrap gap-1.5">
                        {slotAppointments.map((apt) => {
                          const colors = professionalColorMap[apt.professional_id] || PROFESSIONAL_COLORS[0];
                          return (
                            <div
                              key={apt.id}
                              onClick={() => onAppointmentClick(apt)}
                              className={`flex-1 min-w-[180px] max-w-[300px] p-2 rounded border-l-4 cursor-pointer hover:opacity-80 transition-opacity ${colors.bg} ${colors.border}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <ConfirmedIndicator isConfirmed={!!apt.confirmed_at} />
                                  <span className={`font-medium truncate text-sm ${colors.text}`}>
                                    {apt.client_name}
                                  </span>
                                </div>
                                {getStatusBadge(apt.status)}
                              </div>
                              <div className={`text-xs mt-1 truncate ${colors.text} opacity-80`}>
                                {apt.services?.name}
                              </div>
                              <div className={`text-xs truncate font-medium ${colors.text}`}>
                                {apt.professionals?.name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`flex-1 text-sm py-1 ${
                        isOutside ? "text-muted-foreground/50" : "text-muted-foreground"
                      }`}>
                        {isOutside ? "Fora do expediente" : "Disponível"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Week view - compact cards
  const dayAppointments = appointments.filter(
    (apt) => apt.status !== "cancelled" && isSameDay(parseISO(apt.scheduled_at), date)
  );

  return (
    <div className="space-y-1">
      {dayAppointments.length > 0 ? (
        dayAppointments.map((apt) => {
          const colors = professionalColorMap[apt.professional_id] || PROFESSIONAL_COLORS[0];
          return (
            <div
              key={apt.id}
              onClick={() => onAppointmentClick(apt)}
              className={`p-1.5 rounded border-l-2 text-xs cursor-pointer hover:opacity-80 transition-opacity ${colors.bg} ${colors.border}`}
            >
              <div className="flex items-center gap-1">
                <ConfirmedIndicator isConfirmed={!!apt.confirmed_at} />
                <span className={`font-medium ${colors.text}`}>
                  {format(parseISO(apt.scheduled_at), "HH:mm")}
                </span>
              </div>
              <div className={`truncate ${colors.text}`}>{apt.client_name}</div>
              <div className={`truncate opacity-70 ${colors.text}`}>{apt.professionals?.name}</div>
            </div>
          );
        })
      ) : (
        <div className="p-2 text-xs text-center text-muted-foreground bg-green-500/10 rounded border border-green-500/30">
          Livre
        </div>
      )}
    </div>
  );
}
