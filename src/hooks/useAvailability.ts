import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  format, parseISO, setHours, setMinutes, addMinutes, 
  isBefore, isAfter, isSameDay, startOfDay, addDays,
  getDay, isWithinInterval
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables, Json } from "@/integrations/supabase/types";

type Professional = Tables<"professionals">;
type Establishment = Tables<"establishments">;

interface BlockedTime {
  id: string;
  professional_id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

interface Closure {
  id: string;
  establishment_id: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  is_recurring: boolean;
}

interface WorkingHoursDay {
  open: string;
  close: string;
  enabled: boolean;
}

interface WorkingHours {
  [key: string]: WorkingHoursDay;
}

interface ScheduleSlot {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  professional_id: string;
  service_id: string;
  status: string;
}

interface NextAvailableSlot {
  date: Date;
  time: string;
  professional: Professional | null;
}

interface UseAvailabilityProps {
  establishmentId: string | null;
  establishment: Establishment | null;
  professionals: Professional[];
  appointments: ScheduleSlot[];
}

interface UseAvailabilityReturn {
  blockedTimes: BlockedTime[];
  closures: Closure[];
  loading: boolean;
  isEstablishmentOpen: (date: Date, time?: string) => boolean;
  isProfessionalAvailable: (date: Date, time: string, professionalId: string, durationMinutes: number, isAdminOverride?: boolean) => boolean;
  isTimeSlotAvailable: (date: Date, time: string, professionalId: string | null, durationMinutes: number, serviceId: string, availableProfs: Professional[], isAdminOverride?: boolean) => boolean;
  hasProfessionalConflict: (date: Date, time: string, professionalId: string, durationMinutes: number, excludeAppointmentId?: string) => boolean;
  getWorkingHoursForDay: (date: Date, professionalId?: string) => { open: string; close: string } | null;
  getEstablishmentWorkingHoursMessage: () => string;
  findNextAvailableSlot: (fromDate: Date, serviceId: string, durationMinutes: number, preferredProfessionalId: string | null, availableProfs: Professional[]) => NextAvailableSlot | null;
  generateAvailableSlotsForDay: (date: Date, professionalId: string | null, durationMinutes: number, serviceId: string, availableProfs: Professional[]) => { time: string; available: boolean; capacity: number }[];
  refetchBlockedTimes: () => Promise<void>;
  refetchClosures: () => Promise<void>;
}

const DEFAULT_WORKING_HOURS: WorkingHours = {
  "0": { open: "09:00", close: "18:00", enabled: false }, // Sunday
  "1": { open: "09:00", close: "20:00", enabled: true },  // Monday
  "2": { open: "09:00", close: "20:00", enabled: true },  // Tuesday
  "3": { open: "09:00", close: "20:00", enabled: true },  // Wednesday
  "4": { open: "09:00", close: "20:00", enabled: true },  // Thursday
  "5": { open: "09:00", close: "20:00", enabled: true },  // Friday
  "6": { open: "09:00", close: "18:00", enabled: true },  // Saturday
};

const DAY_NAMES_PT: Record<string, string> = {
  "0": "domingo",
  "1": "segunda-feira",
  "2": "terça-feira",
  "3": "quarta-feira",
  "4": "quinta-feira",
  "5": "sexta-feira",
  "6": "sábado",
};

export function useAvailability({
  establishmentId,
  establishment,
  professionals,
  appointments,
}: UseAvailabilityProps): UseAvailabilityReturn {
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlockedTimes = useCallback(async () => {
    if (!establishmentId) return;

    try {
      const professionalIds = professionals.map(p => p.id);
      if (professionalIds.length === 0) {
        setBlockedTimes([]);
        return;
      }

      const { data } = await supabase
        .from("professional_blocked_times")
        .select("*")
        .in("professional_id", professionalIds)
        .gte("end_time", new Date().toISOString());

      setBlockedTimes(data || []);
    } catch (error) {
      console.error("Error fetching blocked times:", error);
    }
  }, [establishmentId, professionals]);

  const fetchClosures = useCallback(async () => {
    if (!establishmentId) return;

    try {
      const { data } = await supabase
        .from("establishment_closures")
        .select("*")
        .eq("establishment_id", establishmentId)
        .gte("end_date", format(new Date(), "yyyy-MM-dd"));

      setClosures(data || []);
    } catch (error) {
      console.error("Error fetching closures:", error);
    }
  }, [establishmentId]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchBlockedTimes(), fetchClosures()]);
      setLoading(false);
    };
    fetchAll();
  }, [fetchBlockedTimes, fetchClosures]);

  // Parse working hours from establishment or use defaults
  const establishmentWorkingHours = useMemo((): WorkingHours => {
    if (!establishment?.working_hours) return DEFAULT_WORKING_HOURS;
    
    const wh = establishment.working_hours as unknown;
    if (typeof wh === "object" && wh !== null) {
      return wh as WorkingHours;
    }
    return DEFAULT_WORKING_HOURS;
  }, [establishment?.working_hours]);

  // Get working hours for a specific day
  const getWorkingHoursForDay = useCallback((date: Date, professionalId?: string): { open: string; close: string } | null => {
    const dayOfWeek = getDay(date).toString();
    
    // Check professional's working hours first if specified
    if (professionalId) {
      const professional = professionals.find(p => p.id === professionalId);
      if (professional?.working_hours) {
        const profWh = professional.working_hours as unknown as WorkingHours;
        const profDay = profWh[dayOfWeek];
        if (profDay && profDay.enabled) {
          return { open: profDay.open, close: profDay.close };
        } else if (profDay && !profDay.enabled) {
          return null; // Professional doesn't work this day
        }
      }
    }
    
    // Fall back to establishment working hours
    const day = establishmentWorkingHours[dayOfWeek];
    if (!day || !day.enabled) return null;
    
    return { open: day.open, close: day.close };
  }, [establishmentWorkingHours, professionals]);

  // Check if a date/time is during a closure
  const isClosedDueToClosure = useCallback((date: Date, time?: string): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    return closures.some(closure => {
      // Check if date is within closure range
      if (dateStr < closure.start_date || dateStr > closure.end_date) {
        return false;
      }
      
      // If no specific times, it's a full day closure
      if (!closure.start_time || !closure.end_time) {
        return true;
      }
      
      // If time is specified, check if it falls within closure times
      if (time) {
        return time >= closure.start_time && time < closure.end_time;
      }
      
      return true;
    });
  }, [closures]);

  // Check if establishment is open at a specific date/time
  const isEstablishmentOpen = useCallback((date: Date, time?: string): boolean => {
    // Check closures first
    if (isClosedDueToClosure(date, time)) {
      return false;
    }
    
    // Check working hours
    const workingHours = getWorkingHoursForDay(date);
    if (!workingHours) return false;
    
    if (time) {
      return time >= workingHours.open && time < workingHours.close;
    }
    
    return true;
  }, [getWorkingHoursForDay, isClosedDueToClosure]);

  // Check if a professional is blocked at a specific time
  const isProfessionalBlocked = useCallback((date: Date, time: string, professionalId: string, durationMinutes: number): boolean => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = setMinutes(setHours(date, hours), minutes);
    const slotEnd = addMinutes(slotStart, durationMinutes);

    return blockedTimes.some(block => {
      if (block.professional_id !== professionalId) return false;
      
      const blockStart = parseISO(block.start_time);
      const blockEnd = parseISO(block.end_time);
      
      // Check for overlap
      return isBefore(slotStart, blockEnd) && isAfter(slotEnd, blockStart);
    });
  }, [blockedTimes]);

  // Check if a professional has an existing appointment at the time
  const hasProfessionalAppointment = useCallback((date: Date, time: string, professionalId: string, durationMinutes: number, excludeAppointmentId?: string): boolean => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = setMinutes(setHours(date, hours), minutes);
    const slotEnd = addMinutes(slotStart, durationMinutes);

    return appointments.some(apt => {
      if (apt.status === "cancelled") return false;
      if (excludeAppointmentId && apt.id === excludeAppointmentId) return false;
      if (apt.professional_id !== professionalId) return false;
      
      const aptStart = parseISO(apt.scheduled_at);
      const aptEnd = addMinutes(aptStart, apt.duration_minutes);
      
      return isBefore(slotStart, aptEnd) && isAfter(slotEnd, aptStart);
    });
  }, [appointments]);

  // Public helper: check if there's an existing conflicting appointment for the professional
  const hasProfessionalConflict = useCallback((date: Date, time: string, professionalId: string, durationMinutes: number, excludeAppointmentId?: string): boolean => {
    return hasProfessionalAppointment(date, time, professionalId, durationMinutes, excludeAppointmentId);
  }, [hasProfessionalAppointment]);

  // Check if a professional is available
  const isProfessionalAvailable = useCallback((date: Date, time: string, professionalId: string, durationMinutes: number, isAdminOverride: boolean = false): boolean => {
    // Check establishment open
    if (!isEstablishmentOpen(date, time)) return false;
    
    // Check professional's working hours
    const profWorkingHours = getWorkingHoursForDay(date, professionalId);
    if (!profWorkingHours) return false;
    
    // Check if time is within professional's working hours
    const [hours, minutes] = time.split(":").map(Number);
    const endTime = addMinutes(setMinutes(setHours(date, hours), minutes), durationMinutes);
    const endTimeStr = format(endTime, "HH:mm");
    
    if (time < profWorkingHours.open || endTimeStr > profWorkingHours.close) {
      return false;
    }
    
    // Check blocked times
    if (isProfessionalBlocked(date, time, professionalId, durationMinutes)) return false;
    
    // Check existing appointments (skipped when admin explicitly allows simultaneous booking)
    if (!isAdminOverride && hasProfessionalAppointment(date, time, professionalId, durationMinutes)) return false;
    
    return true;
  }, [isEstablishmentOpen, getWorkingHoursForDay, isProfessionalBlocked, hasProfessionalAppointment]);

  // Check if a time slot is available (for any or specific professional)
  const isTimeSlotAvailable = useCallback((
    date: Date, 
    time: string, 
    professionalId: string | null, 
    durationMinutes: number,
    serviceId: string,
    availableProfs: Professional[],
    isAdminOverride: boolean = false
  ): boolean => {
    if (professionalId) {
      return isProfessionalAvailable(date, time, professionalId, durationMinutes, isAdminOverride);
    }
    
    return availableProfs.some(p => isProfessionalAvailable(date, time, p.id, durationMinutes, isAdminOverride));
  }, [isProfessionalAvailable]);

  // Generate establishment working hours message
  const getEstablishmentWorkingHoursMessage = useCallback((): string => {
    const enabledDays: { day: string; open: string; close: string }[] = [];
    
    for (let i = 0; i <= 6; i++) {
      const dayKey = i.toString();
      const day = establishmentWorkingHours[dayKey];
      if (day?.enabled) {
        enabledDays.push({
          day: DAY_NAMES_PT[dayKey],
          open: day.open,
          close: day.close,
        });
      }
    }

    if (enabledDays.length === 0) return "Estabelecimento fechado";
    
    // Group consecutive days with same hours
    const groups: { days: string[]; open: string; close: string }[] = [];
    
    for (const d of enabledDays) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.open === d.open && lastGroup.close === d.close) {
        lastGroup.days.push(d.day);
      } else {
        groups.push({ days: [d.day], open: d.open, close: d.close });
      }
    }

    return groups.map(g => {
      const daysText = g.days.length > 1 
        ? `${g.days[0]} a ${g.days[g.days.length - 1]}`
        : g.days[0];
      return `${daysText} das ${g.open} às ${g.close}`;
    }).join(", ");
  }, [establishmentWorkingHours]);

  // Find next available slot
  const findNextAvailableSlot = useCallback((
    fromDate: Date,
    serviceId: string,
    durationMinutes: number,
    preferredProfessionalId: string | null,
    availableProfs: Professional[]
  ): NextAvailableSlot | null => {
    const now = new Date();
    const maxDaysAhead = 30;
    
    for (let dayOffset = 0; dayOffset <= maxDaysAhead; dayOffset++) {
      const checkDate = addDays(startOfDay(fromDate), dayOffset);
      const workingHours = getWorkingHoursForDay(checkDate);
      
      if (!workingHours) continue;
      if (isClosedDueToClosure(checkDate)) continue;
      
      const [openHour, openMin] = workingHours.open.split(":").map(Number);
      const [closeHour, closeMin] = workingHours.close.split(":").map(Number);
      
      for (let hour = openHour; hour < closeHour; hour++) {
        for (const minute of [0, 30]) {
          if (hour === openHour && minute < openMin) continue;
          
          const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
          const slotTime = setMinutes(setHours(checkDate, hour), minute);
          
          // Skip past times
          if (isBefore(slotTime, now)) continue;
          
          // Check end time within working hours
          const endTime = addMinutes(slotTime, durationMinutes);
          const endTimeStr = format(endTime, "HH:mm");
          if (endTimeStr > workingHours.close) continue;
          
          // Check preferred professional first
          if (preferredProfessionalId) {
            if (isProfessionalAvailable(checkDate, time, preferredProfessionalId, durationMinutes)) {
              const prof = professionals.find(p => p.id === preferredProfessionalId);
              return { date: checkDate, time, professional: prof || null };
            }
          }
          
          // Check any available professional
          for (const prof of availableProfs) {
            if (isProfessionalAvailable(checkDate, time, prof.id, durationMinutes)) {
              return { date: checkDate, time, professional: prof };
            }
          }
        }
      }
    }
    
    return null;
  }, [getWorkingHoursForDay, isClosedDueToClosure, isProfessionalAvailable, professionals]);

  // Generate available slots for a day
  const generateAvailableSlotsForDay = useCallback((
    date: Date, 
    professionalId: string | null, 
    durationMinutes: number,
    serviceId: string,
    availableProfs: Professional[]
  ): { time: string; available: boolean; capacity: number }[] => {
    const slots: { time: string; available: boolean; capacity: number }[] = [];
    const now = new Date();
    
    // Get working hours for this day
    const workingHours = getWorkingHoursForDay(date, professionalId || undefined);
    if (!workingHours) return slots;
    
    // Check if closed
    if (isClosedDueToClosure(date)) return slots;
    
    const [openHour, openMin] = workingHours.open.split(":").map(Number);
    const [closeHour] = workingHours.close.split(":").map(Number);
    
    for (let hour = openHour; hour < closeHour; hour++) {
      for (const minute of [0, 30]) {
        if (hour === openHour && minute < openMin) continue;
        
        const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        const slotTime = setMinutes(setHours(date, hour), minute);
        
        // Skip past times for today
        if (isBefore(slotTime, now)) continue;
        
        // Check end time
        const endTime = addMinutes(slotTime, durationMinutes);
        const endTimeStr = format(endTime, "HH:mm");
        if (endTimeStr > workingHours.close) continue;
        
        const available = isTimeSlotAvailable(date, time, professionalId, durationMinutes, serviceId, availableProfs);
        const capacity = professionalId 
          ? (available ? 1 : 0) 
          : availableProfs.filter(p => isProfessionalAvailable(date, time, p.id, durationMinutes)).length;
        
        slots.push({ time, available, capacity });
      }
    }
    
    return slots;
  }, [getWorkingHoursForDay, isClosedDueToClosure, isTimeSlotAvailable, isProfessionalAvailable]);

  return {
    blockedTimes,
    closures,
    loading,
    isEstablishmentOpen,
    isProfessionalAvailable,
    isTimeSlotAvailable,
    hasProfessionalConflict,
    getWorkingHoursForDay,
    getEstablishmentWorkingHoursMessage,
    findNextAvailableSlot,
    generateAvailableSlotsForDay,
    refetchBlockedTimes: fetchBlockedTimes,
    refetchClosures: fetchClosures,
  };
}
