/**
 * Centralized date/time utilities for consistent formatting and timezone handling.
 * All dates should use Brazil timezone (America/Sao_Paulo, UTC-3).
 * Standard format: dd/MM/yyyy HH:mm
 */

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Timezone identifier for Brazil
export const BRAZIL_TIMEZONE = 'America/Sao_Paulo';
export const BRAZIL_OFFSET_MINUTES = -180; // UTC-3 = -180 minutes

/**
 * Get current date/time in Brazil timezone
 */
export function getBrazilNow(): Date {
  const now = new Date();
  const localOffset = now.getTimezoneOffset();
  const brazilOffset = BRAZIL_OFFSET_MINUTES;
  return new Date(now.getTime() + (localOffset - brazilOffset) * 60 * 1000);
}

/**
 * Convert a UTC date to Brazil timezone
 */
export function utcToBrazil(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  const localOffset = date.getTimezoneOffset();
  const brazilOffset = BRAZIL_OFFSET_MINUTES;
  return new Date(date.getTime() + (localOffset - brazilOffset) * 60 * 1000);
}

/**
 * Convert a Brazil timezone date to UTC for storage
 */
export function brazilToUtc(brazilDate: Date): Date {
  return new Date(brazilDate.getTime() + 3 * 60 * 60 * 1000);
}

/**
 * Format date/time in standard Brazilian format: dd/MM/yyyy HH:mm
 * @param date - Date object or ISO string
 * @param options - Formatting options
 */
export function formatDateTime(
  date: Date | string,
  options?: {
    showSeconds?: boolean;
    dateOnly?: boolean;
    timeOnly?: boolean;
  }
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  if (options?.dateOnly) {
    return format(dateObj, 'dd/MM/yyyy', { locale: ptBR });
  }
  
  if (options?.timeOnly) {
    return format(dateObj, options.showSeconds ? 'HH:mm:ss' : 'HH:mm', { locale: ptBR });
  }
  
  const formatStr = options?.showSeconds ? 'dd/MM/yyyy HH:mm:ss' : 'dd/MM/yyyy HH:mm';
  return format(dateObj, formatStr, { locale: ptBR });
}

/**
 * Format date/time with "às" separator: dd/MM/yyyy às HH:mm
 */
export function formatDateTimeWithAs(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/**
 * Format date only: dd/MM/yyyy
 */
export function formatDate(date: Date | string): string {
  return formatDateTime(date, { dateOnly: true });
}

/**
 * Format time only: HH:mm
 */
export function formatTime(date: Date | string): string {
  return formatDateTime(date, { timeOnly: true });
}

/**
 * Format date in verbose style: dd de MMMM de yyyy
 */
export function formatDateVerbose(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * Format with weekday: Seg, 02/01 às 14:30
 */
export function formatWithWeekday(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, "EEE, dd/MM 'às' HH:mm", { locale: ptBR });
}

/**
 * Format using Intl.DateTimeFormat with explicit Brazil timezone
 * Use this for displaying dates where the browser timezone might differ
 */
export function formatDateTimeBrazil(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: BRAZIL_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  
  return dateObj.toLocaleString('pt-BR', { ...defaultOptions, ...options });
}

/**
 * Format time only using Intl with Brazil timezone
 */
export function formatTimeBrazil(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  return dateObj.toLocaleString('pt-BR', {
    timeZone: BRAZIL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Parse a Brazilian date string (dd/MM/yyyy) to Date object
 */
export function parseBrazilianDate(dateStr: string, timeStr?: string): Date | null {
  try {
    const parts = dateStr.trim().split('/');
    if (parts.length < 2) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    let year = parts.length === 3 ? parseInt(parts[2], 10) : new Date().getFullYear();
    
    // Handle 2-digit year
    if (year < 100) {
      year += 2000;
    }
    
    // Parse time if provided
    let hour = 0, minute = 0;
    if (timeStr) {
      const timeParts = timeStr.trim().split(':');
      hour = parseInt(timeParts[0], 10) || 0;
      minute = parseInt(timeParts[1], 10) || 0;
    }
    
    // Validate ranges
    if (day < 1 || day > 31 || month < 1 || month > 12 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }
    
    const date = new Date(year, month - 1, day, hour, minute, 0);
    
    // Validate the date is valid (e.g., Feb 30 would fail)
    if (date.getDate() !== day || date.getMonth() !== month - 1) {
      return null;
    }
    
    return date;
  } catch {
    return null;
  }
}

/**
 * Get relative day label (Hoje, Amanhã, or weekday name)
 */
export function getRelativeDayLabel(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const today = getBrazilNow();
  
  const isToday = dateObj.getDate() === today.getDate() &&
                  dateObj.getMonth() === today.getMonth() &&
                  dateObj.getFullYear() === today.getFullYear();
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const isTomorrow = dateObj.getDate() === tomorrow.getDate() &&
                     dateObj.getMonth() === tomorrow.getMonth() &&
                     dateObj.getFullYear() === tomorrow.getFullYear();
  
  if (isToday) return 'Hoje';
  if (isTomorrow) return 'Amanhã';
  
  return format(dateObj, 'EEEE', { locale: ptBR });
}
