import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ConfirmedIndicator } from "./ConfirmedIndicator";
import type { Tables } from "@/integrations/supabase/types";

type Appointment = Tables<"appointments"> & {
  services?: { name: string } | null;
  professionals?: { name: string } | null;
  confirmed_at?: string | null;
};
type Professional = Tables<"professionals">;

const PROFESSIONAL_COLORS = [
  { bg: "bg-blue-500/15", border: "border-blue-500", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-purple-500/15", border: "border-purple-500", text: "text-purple-700 dark:text-purple-300" },
  { bg: "bg-emerald-500/15", border: "border-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-orange-500/15", border: "border-orange-500", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-pink-500/15", border: "border-pink-500", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-cyan-500/15", border: "border-cyan-500", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-amber-500/15", border: "border-amber-500", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-indigo-500/15", border: "border-indigo-500", text: "text-indigo-700 dark:text-indigo-300" },
  { bg: "bg-rose-500/15", border: "border-rose-500", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-teal-500/15", border: "border-teal-500", text: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-lime-500/15", border: "border-lime-500", text: "text-lime-700 dark:text-lime-300" },
  { bg: "bg-violet-500/15", border: "border-violet-500", text: "text-violet-700 dark:text-violet-300" },
];

const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 56; // px per 30-min slot
const TOTAL_SLOTS = (24 * 60) / SLOT_MINUTES; // 48
const TIME_COL_W = 56; // px

interface DayScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  appointments: Appointment[];
  professionals: Professional[];
  onAppointmentClick: (apt: Appointment) => void;
  onCreateAtSlot?: (date: Date, time: string) => void;
  basePath?: string; // e.g. "/portal/:slug" for client navigation
}

export function DayScheduleDialog({
  open,
  onOpenChange,
  date: initialDate,
  appointments,
  professionals,
  onAppointmentClick,
  onCreateAtSlot,
  basePath,
}: DayScheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) setSelectedDate(initialDate);
  }, [open, initialDate]);

  // Tick every minute for now-line
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, [open]);

  const professionalColorMap = useMemo(() => {
    const map: Record<string, typeof PROFESSIONAL_COLORS[number]> = {};
    professionals.forEach((p, i) => {
      map[p.id] = PROFESSIONAL_COLORS[i % PROFESSIONAL_COLORS.length];
    });
    return map;
  }, [professionals]);

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => isSameDay(parseISO(a.scheduled_at), selectedDate))
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [appointments, selectedDate],
  );

  // Group by 30-min slot bucket
  const slotBuckets = useMemo(() => {
    const map: Record<number, Appointment[]> = {};
    dayAppointments.forEach((apt) => {
      const d = parseISO(apt.scheduled_at);
      const minutes = d.getHours() * 60 + d.getMinutes();
      const bucket = Math.floor(minutes / SLOT_MINUTES);
      if (!map[bucket]) map[bucket] = [];
      map[bucket].push(apt);
    });
    return map;
  }, [dayAppointments]);

  const isToday = isSameDay(selectedDate, new Date());

  // Auto-scroll to current time (or 8h) on open
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (!scrollRef.current) return;
      const target = isToday ? nowMinutes : 8 * 60;
      const top = (target / SLOT_MINUTES) * SLOT_HEIGHT - scrollRef.current.clientHeight / 2;
      scrollRef.current.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedDate]);

  const goToClient = (e: React.MouseEvent, clientId: string | null) => {
    if (!clientId || !slug) return;
    e.stopPropagation();
    if (basePath?.includes("/portal/")) {
      navigate(`/portal/${slug}/clientes/${clientId}`, { state: { from: "agenda" } });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Pend.", className: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40" },
      confirmed: { label: "Conf.", className: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40" },
      in_service: { label: "Atend.", className: "bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/40" },
      completed: { label: "Conc.", className: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/40" },
      no_show: { label: "Faltou", className: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40" },
      cancelled: { label: "Canc.", className: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40" },
    };
    const v = variants[status] ?? { label: status, className: "" };
    return <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 font-medium border", v.className)}>{v.label}</Badge>;
  };

  const handleSlotClick = (slotIdx: number) => {
    if (!onCreateAtSlot) return;
    const hour = Math.floor((slotIdx * SLOT_MINUTES) / 60);
    const minute = (slotIdx * SLOT_MINUTES) % 60;
    const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    onCreateAtSlot(selectedDate, time);
  };

  const shiftDay = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 max-w-3xl w-[calc(100vw-1rem)] sm:w-full max-h-[92vh] h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b bg-background sticky top-0 z-20">
          <div className="flex items-center gap-1 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => shiftDay(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-8 px-2 gap-1.5 font-semibold text-sm sm:text-base truncate">
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate capitalize">
                    {format(selectedDate, "EEEE, dd 'de' MMM", { locale: ptBR })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => {
                    if (d) setSelectedDate(d);
                    setCalendarOpen(false);
                  }}
                  locale={ptBR}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => shiftDay(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedDate(new Date())}>
              Hoje
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="relative" style={{ height: TOTAL_SLOTS * SLOT_HEIGHT }}>
            {/* Slots grid */}
            {Array.from({ length: TOTAL_SLOTS }).map((_, idx) => {
              const hour = Math.floor((idx * SLOT_MINUTES) / 60);
              const minute = (idx * SLOT_MINUTES) % 60;
              const isHour = minute === 0;
              const apts = slotBuckets[idx] || [];
              const hasApts = apts.length > 0;
              return (
                <div
                  key={idx}
                  className={cn(
                    "absolute left-0 right-0 flex border-t",
                    isHour ? "border-border" : "border-border/40 border-dashed",
                  )}
                  style={{ top: idx * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                >
                  {/* Time column */}
                  <div
                    className="shrink-0 text-[10px] sm:text-xs text-muted-foreground font-mono pr-2 pt-0.5 text-right"
                    style={{ width: TIME_COL_W }}
                  >
                    {isHour ? `${hour.toString().padStart(2, "0")}:00` : ""}
                  </div>
                  {/* Slot content */}
                  <div
                    className={cn(
                      "flex-1 min-w-0 px-1 py-0.5 transition-colors",
                      !hasApts && "cursor-pointer hover:bg-primary/5",
                    )}
                    onClick={() => !hasApts && handleSlotClick(idx)}
                  >
                    {hasApts ? (
                      <div className="flex gap-1.5 overflow-x-auto h-full pb-0.5 snap-x">
                        {apts.map((apt) => {
                          const colors = professionalColorMap[apt.professional_id] ?? PROFESSIONAL_COLORS[0];
                          const dur = apt.duration_minutes || 30;
                          const isInactive = apt.status === "cancelled" || apt.status === "no_show";
                          return (
                            <button
                              key={apt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentClick(apt);
                              }}
                              className={cn(
                                "snap-start text-left shrink-0 w-[160px] sm:w-[200px] rounded-md border-l-4 px-2 py-1 hover:opacity-90 transition-opacity",
                                colors.bg,
                                colors.border,
                                isInactive && "opacity-60",
                              )}
                            >
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <div className="flex items-center gap-1 min-w-0">
                                  <ConfirmedIndicator isConfirmed={!!apt.confirmed_at} />
                                  <span
                                    onClick={(e) => goToClient(e, apt.client_id)}
                                    className={cn(
                                      "font-semibold text-xs truncate",
                                      colors.text,
                                      apt.client_id && "hover:underline",
                                      apt.status === "cancelled" && "line-through",
                                    )}
                                  >
                                    {apt.client_name}
                                  </span>
                                </div>
                                {getStatusBadge(apt.status)}
                              </div>
                              <div className={cn("text-[10px] truncate", colors.text, "opacity-90")}>
                                {format(parseISO(apt.scheduled_at), "HH:mm")} · {dur}min
                              </div>
                              <div className={cn("text-[10px] truncate", colors.text, "opacity-80")}>
                                {apt.services?.name}
                              </div>
                              <div className={cn("text-[10px] truncate font-medium", colors.text)}>
                                {apt.professionals?.name}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {/* Now indicator */}
            {isToday && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                style={{ top: (nowMinutes / SLOT_MINUTES) * SLOT_HEIGHT - 1 }}
              >
                <div
                  className="text-[10px] font-mono font-bold text-primary pr-1 text-right shrink-0"
                  style={{ width: TIME_COL_W }}
                >
                  {`${Math.floor(nowMinutes / 60).toString().padStart(2, "0")}:${(nowMinutes % 60).toString().padStart(2, "0")}`}
                </div>
                <div className="flex-1 flex items-center">
                  <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_2px_hsl(var(--primary)/0.5)]" />
                  <div className="flex-1 h-[2px] bg-primary" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground text-center bg-muted/30 shrink-0">
          Toque em um horário livre para criar · {dayAppointments.length} agendamento(s)
        </div>
      </DialogContent>
    </Dialog>
  );
}
