import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface EstablishmentData {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  working_hours: any;
  cancellation_policy: string | null;
  services: Array<{ id: string; name: string; price: number; duration_minutes: number; description: string | null }>;
  professionals: Array<{ id: string; name: string; specialties: string[]; working_hours: any }>;
  promotions: Array<{ name: string; description: string; discount_value: number; discount_type: string; start_date: string; end_date: string }>;
  coupons: Array<{ code: string; description: string | null; discount_value: number; discount_type: string; valid_until: string | null; min_purchase_value: number | null }>;
  loyaltyProgram: { name: string; description: string | null; points_per_currency: number; rewards: Array<{ name: string; points_required: number; reward_value: number }> } | null;
}

interface AssistantConfig {
  is_enabled: boolean;
  assistant_name: string;
  language_style: 'casual' | 'formal';
  availability_mode: 'only_business_hours' | '24h_with_message';
  working_hours: any;
  welcome_message: string | null;
  offline_message: string | null;
  escalation_whatsapp: string | null;
  custom_instructions: string | null;
}

interface AILearningRow {
  trigger_pattern: string | null;
  ideal_response: string | null;
  context_tags: string[] | null;
  confidence_score: number;
}

// ============= AI Learning System =============

async function loadEstablishmentLearnings(establishmentId: string, userMessage: string): Promise<string> {
  try {
    // Get top learnings by confidence score
    const { data: learnings } = await supabase
      .from('establishment_ai_learnings')
      .select('trigger_pattern, ideal_response, context_tags, confidence_score')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true)
      .order('confidence_score', { ascending: false })
      .limit(15);

    if (!learnings || learnings.length === 0) {
      return '';
    }

    // Filter relevant learnings based on context tags and message similarity
    const lowerMessage = userMessage.toLowerCase();
    const relevantLearnings = learnings.filter((l: AILearningRow) => {
      // Check if any context tag matches the message
      if (l.context_tags?.some((tag: string) => lowerMessage.includes(tag.toLowerCase()))) {
        return true;
      }
      // Check if trigger pattern is similar
      if (l.trigger_pattern && lowerMessage.includes(l.trigger_pattern.toLowerCase().slice(0, 20))) {
        return true;
      }
      // Include high-confidence learnings
      return l.confidence_score >= 0.8;
    }).slice(0, 10);

    if (relevantLearnings.length === 0) {
      return '';
    }

    let learningsText = '\n\n## Aprendizados do Estabelecimento (use para melhorar suas respostas):\n';
    relevantLearnings.forEach((l: AILearningRow, i: number) => {
      if (l.trigger_pattern && l.ideal_response) {
        learningsText += `${i + 1}. Quando perguntarem sobre "${l.trigger_pattern.slice(0, 50)}...", responda similar a: "${l.ideal_response.slice(0, 150)}..."\n`;
      }
    });

    console.log(`[AI-Learning] Loaded ${relevantLearnings.length} learnings for establishment`);
    return learningsText;
  } catch (error) {
    console.error('[AI-Learning] Error loading learnings:', error);
    return '';
  }
}

async function recordAutoLearning(
  establishmentId: string,
  conversationId: string,
  userMessage: string,
  assistantResponse: string,
  outcome: 'success' | 'failure',
  contextTags: string[]
): Promise<void> {
  try {
    // First, check if there's a similar learning already
    const { data: existingLearnings } = await supabase
      .from('establishment_ai_learnings')
      .select('id, success_count, failure_count, confidence_score')
      .eq('establishment_id', establishmentId)
      .ilike('trigger_pattern', `%${userMessage.slice(0, 30)}%`)
      .limit(1);

    if (existingLearnings && existingLearnings.length > 0) {
      // Update existing learning
      const existing = existingLearnings[0];
      const newSuccessCount = outcome === 'success' ? existing.success_count + 1 : existing.success_count;
      const newFailureCount = outcome === 'failure' ? existing.failure_count + 1 : existing.failure_count;
      const total = newSuccessCount + newFailureCount;
      const newConfidence = total > 0 ? newSuccessCount / total : 0.5;

      await supabase
        .from('establishment_ai_learnings')
        .update({
          success_count: newSuccessCount,
          failure_count: newFailureCount,
          confidence_score: Math.min(0.99, newConfidence),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      console.log(`[AI-Learning] Updated learning ${existing.id}, new confidence: ${newConfidence.toFixed(2)}`);
    } else if (outcome === 'success') {
      // Create new learning only for successful interactions
      await supabase.from('establishment_ai_learnings').insert({
        establishment_id: establishmentId,
        learning_type: 'auto',
        trigger_pattern: userMessage.slice(0, 500),
        ideal_response: assistantResponse.slice(0, 1000),
        context_tags: contextTags,
        success_count: 1,
        failure_count: 0,
        confidence_score: 0.6, // Start with moderate confidence
        source_conversation_id: conversationId,
      });

      console.log(`[AI-Learning] Created new learning for establishment ${establishmentId}`);
    }

    // Record feedback
    await supabase.from('ai_conversation_feedback').insert({
      conversation_id: conversationId,
      feedback_type: outcome,
      outcome: outcome === 'success' ? 'positive_interaction' : 'negative_interaction',
    });
  } catch (error) {
    console.error('[AI-Learning] Error recording learning:', error);
  }
}

async function recordAppointmentOutcome(
  establishmentId: string,
  conversationId: string,
  userMessage: string,
  assistantResponse: string,
  created: boolean
): Promise<void> {
  const contextTags = ['agendamento', 'horário', 'agendar', 'marcar'];
  await recordAutoLearning(
    establishmentId,
    conversationId,
    userMessage,
    assistantResponse,
    created ? 'success' : 'failure',
    contextTags
  );
  
  if (created) {
    await supabase.from('ai_conversation_feedback').insert({
      conversation_id: conversationId,
      feedback_type: 'success',
      outcome: 'appointment_created',
    });
  }
}

// ============= Centralized Date/Time Utilities =============
// IMPORTANT: This runtime typically runs in UTC. We need helpers that make
// Date#getHours()/getDay() reflect Brazil (America/Sao_Paulo) wall-clock time.
// We do that by shifting the underlying timestamp by the difference between
// the current runtime timezone and Brazil's timezone.
//
// In JS, getTimezoneOffset() returns minutes to add to LOCAL time to get UTC.
// For Brazil (UTC-3), that offset is 180.
const BRAZIL_TZ_OFFSET_MINUTES = 180; // UTC-3

function shiftToBrazilWallClock(date: Date): Date {
  const localOffset = date.getTimezoneOffset();
  // T' = T + (localOffset - brazilOffset)
  return new Date(date.getTime() + (localOffset - BRAZIL_TZ_OFFSET_MINUTES) * 60 * 1000);
}

function unshiftFromBrazilWallClock(brazilWallClockDate: Date): Date {
  const localOffset = brazilWallClockDate.getTimezoneOffset();
  // T = T' + (brazilOffset - localOffset)
  return new Date(brazilWallClockDate.getTime() + (BRAZIL_TZ_OFFSET_MINUTES - localOffset) * 60 * 1000);
}

function getBrazilNow(): Date {
  return shiftToBrazilWallClock(new Date());
}

function utcToBrazil(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return shiftToBrazilWallClock(date);
}

function brazilToUtc(brazilDate: Date): Date {
  return unshiftFromBrazilWallClock(brazilDate);
}

function formatBrazilDateTime(date: Date, options?: { dateOnly?: boolean; timeOnly?: boolean }): string {
  if (options?.dateOnly) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  if (options?.timeOnly) {
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${hour}:${minute}`;
  }
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

function formatBrazilDateTimeShort(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month} às ${hour}:${minute}`;
}

const DIAS_SEMANA_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_SEMANA_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const NAMED_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
// =============================================================

async function getEstablishmentData(establishmentId: string): Promise<EstablishmentData | null> {
  // Fetch all data in parallel for better performance
  const [
    establishmentResult,
    servicesResult,
    professionalsResult,
    promotionsResult,
    couponsResult,
    loyaltyResult,
  ] = await Promise.all([
    supabase
      .from('establishments')
      .select('id, name, phone, address, city, state, description, working_hours, cancellation_policy')
      .eq('id', establishmentId)
      .single(),
    supabase
      .from('services')
      .select('id, name, price, duration_minutes, description')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true),
    supabase
      .from('professionals')
      .select('id, name, specialties, working_hours')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true),
    supabase
      .from('promotions')
      .select('name, description, discount_value, discount_type, start_date, end_date')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true)
      .gte('end_date', new Date().toISOString()),
    supabase
      .from('discount_coupons')
      .select('code, description, discount_value, discount_type, valid_until, min_purchase_value')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true),
    supabase
      .from('loyalty_programs')
      .select(`
        name, description, points_per_currency,
        loyalty_rewards(name, points_required, reward_value)
      `)
      .eq('establishment_id', establishmentId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
  ]);

  const establishment = establishmentResult.data;
  if (!establishment) return null;

  // Filter valid coupons (not expired)
  const now = new Date().toISOString();
  const validCoupons = (couponsResult.data || []).filter(
    (c: any) => !c.valid_until || c.valid_until >= now
  );

  return {
    ...establishment,
    services: servicesResult.data || [],
    professionals: professionalsResult.data || [],
    promotions: promotionsResult.data || [],
    coupons: validCoupons,
    loyaltyProgram: loyaltyResult.data ? {
      name: loyaltyResult.data.name,
      description: loyaltyResult.data.description,
      points_per_currency: loyaltyResult.data.points_per_currency,
      rewards: (loyaltyResult.data as any).loyalty_rewards || [],
    } : null,
  };
}

async function getAssistantConfig(establishmentId: string): Promise<AssistantConfig | null> {
  const { data } = await supabase
    .from('establishment_ai_assistant')
    .select('*')
    .eq('establishment_id', establishmentId)
    .single();

  return data;
}

async function checkUsageLimits(establishmentId: string): Promise<{ allowed: boolean; reason?: string }> {
  // Check subscription status
  const { data: subscription } = await supabase
    .from('establishment_ai_subscriptions')
    .select('*')
    .eq('establishment_id', establishmentId)
    .single();

  if (!subscription) {
    // Create trial subscription
    await supabase.from('establishment_ai_subscriptions').insert({
      establishment_id: establishmentId,
      status: 'trial',
      trial_messages_used: 0,
    });
    return { allowed: true };
  }

  if (subscription.status === 'active') {
    return { allowed: true };
  }

  if (subscription.status === 'trial') {
    const { data: addon } = await supabase
      .from('platform_ai_addon')
      .select('trial_message_limit')
      .single();

    const limit = addon?.trial_message_limit || 200;

    if (subscription.trial_messages_used >= limit) {
      return {
        allowed: false,
        reason: `Limite de ${limit} mensagens gratuitas atingido. Assine o addon para continuar usando a assistente.`,
      };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: 'Assinatura inativa.' };
}

async function incrementUsage(establishmentId: string): Promise<void> {
  const monthYear = new Date().toISOString().slice(0, 7);

  try {
    // Update subscription trial count - fetch current value and increment
    const { data: subscription } = await supabase
      .from('establishment_ai_subscriptions')
      .select('id, trial_messages_used')
      .eq('establishment_id', establishmentId)
      .eq('status', 'trial')
      .single();

    if (subscription) {
      await supabase
        .from('establishment_ai_subscriptions')
        .update({ trial_messages_used: (subscription.trial_messages_used || 0) + 1 })
        .eq('id', subscription.id);
    }

    // Upsert monthly usage
    const { data: existing } = await supabase
      .from('ai_assistant_usage')
      .select('id, message_count')
      .eq('establishment_id', establishmentId)
      .eq('month_year', monthYear)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('ai_assistant_usage')
        .update({ message_count: (existing.message_count || 0) + 1 })
        .eq('id', existing.id);
    } else {
      await supabase.from('ai_assistant_usage').insert({
        establishment_id: establishmentId,
        month_year: monthYear,
        message_count: 1,
      });
    }
  } catch (error) {
    console.error('[AI-Assistant] Erro ao incrementar uso:', error);
    // Non-blocking - don't throw
  }
}

async function getClientFutureAppointments(establishmentId: string, clientId?: string, clientPhone?: string): Promise<any[]> {
  if (!clientId && !clientPhone) return [];

  const now = new Date().toISOString();
  
  let query = supabase
    .from('appointments')
    .select(`
      id,
      scheduled_at,
      status,
      client_name,
      client_phone,
      service:services(id, name, price),
      professional:professionals(id, name)
    `)
    .eq('establishment_id', establishmentId)
    .in('status', ['pending', 'confirmed'])
    .gte('scheduled_at', now)
    .order('scheduled_at', { ascending: true });

  if (clientId) {
    query = query.eq('client_id', clientId);
  } else if (clientPhone) {
    const phoneClean = clientPhone.replace(/\D/g, '');
    query = query.eq('client_phone', phoneClean);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }

  return data || [];
}

async function cancelAppointments(appointmentIds: string[], reason: string): Promise<{ success: boolean; cancelled: number; errors: string[] }> {
  const errors: string[] = [];
  let cancelled = 0;

  for (const id of appointmentIds) {
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_reason: reason,
        cancelled_via_whatsapp: false,
      })
      .eq('id', id);

    if (error) {
      console.error(`Error cancelling appointment ${id}:`, error);
      errors.push(id);
    } else {
      cancelled++;
    }
  }

  return { success: errors.length === 0, cancelled, errors };
}

// Check if there's a scheduling conflict for the professional
// scheduledAtUTC must be in UTC timezone
async function checkSchedulingConflict(
  establishmentId: string,
  professionalId: string,
  scheduledAtUTC: Date,
  durationMinutes: number
): Promise<{ hasConflict: boolean; conflictingAppointment?: any }> {
  try {
    // Calculate time window for query (4 hours before and after in UTC)
    const windowStart = new Date(scheduledAtUTC.getTime() - 4 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(scheduledAtUTC.getTime() + 4 * 60 * 60 * 1000).toISOString();

    console.log('[AI-Assistant] Verificando conflitos:', {
      professionalId,
      scheduledAtUTC: scheduledAtUTC.toISOString(),
      durationMinutes,
      windowStart,
      windowEnd,
    });

    // Check for overlapping appointments
    const { data: conflicts, error } = await supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes, client_name')
      .eq('establishment_id', establishmentId)
      .eq('professional_id', professionalId)
      .in('status', ['pending', 'confirmed'])
      .gte('scheduled_at', windowStart)
      .lte('scheduled_at', windowEnd)
      .limit(20);

    if (error) {
      console.error('[AI-Assistant] Erro ao buscar conflitos:', error);
      return { hasConflict: false }; // Fail open - let the appointment be created
    }

    if (!conflicts || conflicts.length === 0) {
      console.log('[AI-Assistant] Nenhum conflito encontrado');
      return { hasConflict: false };
    }

    console.log('[AI-Assistant] Agendamentos encontrados na janela:', conflicts.length);

    // Check each appointment for overlap
    for (const apt of conflicts) {
      const aptStart = new Date(apt.scheduled_at);
      const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60 * 1000);
      const newStart = scheduledAtUTC;
      const newEnd = new Date(scheduledAtUTC.getTime() + durationMinutes * 60 * 1000);

      // Check for overlap: (StartA < EndB) && (EndA > StartB)
      if (newStart < aptEnd && newEnd > aptStart) {
        console.log('[AI-Assistant] Conflito detectado com:', apt.id);
        return { hasConflict: true, conflictingAppointment: apt };
      }
    }

    return { hasConflict: false };
  } catch (error) {
    console.error('[AI-Assistant] Erro inesperado em checkSchedulingConflict:', error);
    return { hasConflict: false }; // Fail open
  }
}

// Get available time slots for the next days for each professional
async function getAvailabilityInfo(
  establishmentId: string,
  establishmentWorkingHours: any,
  professionals: Array<{ id: string; name: string; working_hours: any }>,
  ctx?: { requestId?: string; conversationId?: string }
): Promise<string> {
  const log = (event: string, data: Record<string, unknown> = {}) => {
    // Centralized, structured logs to simplify debugging in function logs
    console.log(
      '[AI-Assistant][Availability]',
      JSON.stringify({
        ts: new Date().toISOString(),
        event,
        establishmentId,
        conversationId: ctx?.conversationId,
        requestId: ctx?.requestId,
        ...data,
      })
    );
  };

  const safeKeys = (v: any) => {
    try {
      return v && typeof v === 'object' ? Object.keys(v) : [];
    } catch {
      return [];
    }
  };

  try {
    const brasiliaTime = getBrazilNow();

    // Get appointments for the next 7 days
    const startDate = new Date(brasiliaTime);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(brasiliaTime.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Convert to UTC for query (Brasília UTC-3)
    const startUTC = brazilToUtc(startDate);
    const endUTC = brazilToUtc(endDate);

    log('availability_start', {
      brasiliaNow: formatBrazilDateTime(brasiliaTime),
      brasiliaTimeISO: brasiliaTime.toISOString(),
      startUTC: startUTC.toISOString(),
      endUTC: endUTC.toISOString(),
      professionalsCount: professionals.length,
      establishmentWorkingHoursKeys: safeKeys(establishmentWorkingHours),
    });

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, professional_id, scheduled_at, duration_minutes, status')
      .eq('establishment_id', establishmentId)
      .in('status', ['pending', 'confirmed'])
      .gte('scheduled_at', startUTC.toISOString())
      .lte('scheduled_at', endUTC.toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) {
      log('availability_appointments_error', { error: String((error as any)?.message ?? error) });
      console.error('[AI-Assistant] Erro ao buscar agendamentos:', error);
      return 'Não foi possível verificar disponibilidade.';
    }

    const allAppointments = appointments || [];
    const appointmentProfessionalIds = Array.from(
      new Set(allAppointments.map((a: any) => a.professional_id).filter(Boolean))
    );

    log('availability_appointments_fetched', {
      count: allAppointments.length,
      uniqueProfessionalIdsCount: appointmentProfessionalIds.length,
      uniqueProfessionalIdsSample: appointmentProfessionalIds.slice(0, 10),
      sample: allAppointments.slice(0, 5).map((a: any) => ({
        id: a.id,
        professional_id: a.professional_id,
        scheduled_at: a.scheduled_at,
        duration_minutes: a.duration_minutes,
        status: a.status,
      })),
    });

    // Build availability info per professional
    const availabilityLines: string[] = [];

    for (const prof of professionals) {
      const profAppointments = allAppointments.filter((apt: any) => apt.professional_id === prof.id);

      const isNonEmptyWorkingHours = (wh: any) => {
        if (!wh || typeof wh !== 'object') return false;
        try {
          return Object.keys(wh).length > 0;
        } catch {
          return false;
        }
      };

      const professionalHasHours = isNonEmptyWorkingHours(prof.working_hours);
      const establishmentHasHours = isNonEmptyWorkingHours(establishmentWorkingHours);

      // Use professional working hours only when it has actual config; otherwise fallback to establishment
      const workingHours = professionalHasHours ? prof.working_hours : establishmentWorkingHours;

      log('availability_professional_start', {
        professionalId: prof.id,
        professionalName: prof.name,
        appointmentsCount: profAppointments.length,
        professionalWorkingHoursMeta: {
          type: typeof prof.working_hours,
          isArray: Array.isArray(prof.working_hours),
          keysCount: safeKeys(prof.working_hours).length,
        },
        establishmentWorkingHoursMeta: {
          type: typeof establishmentWorkingHours,
          isArray: Array.isArray(establishmentWorkingHours),
          keysCount: safeKeys(establishmentWorkingHours).length,
        },
        workingHoursSource: professionalHasHours ? 'professional' : 'establishment',
        workingHoursSelection: professionalHasHours
          ? 'professional_has_config'
          : establishmentHasHours
            ? 'fallback_to_establishment'
            : 'no_config_found',
        workingHoursKeys: safeKeys(workingHours),
        workingHoursSample: safeKeys(workingHours).slice(0, 10).reduce((acc: any, k: string) => {
          acc[k] = (workingHours as any)?.[k];
          return acc;
        }, {}),
      });

      const profAvailability: string[] = [];

      // Check next 3 days (today, tomorrow, day after tomorrow)
      for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
        const checkDate = new Date(brasiliaTime.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const dayIndex = checkDate.getDay();
        const dayName = dayOffset === 0 ? 'Hoje' : dayOffset === 1 ? 'Amanhã' : DIAS_SEMANA[dayIndex];
        const dateStr = formatBrazilDateTime(checkDate, { dateOnly: true }).slice(0, 5); // DD/MM

        // Get working hours for this day
        const dayConfig =
          workingHours?.[dayIndex.toString()] || workingHours?.[dayIndex] || workingHours?.[NAMED_DAYS[dayIndex]];

        if (!dayConfig) {
          log('availability_day_skip', {
            professionalId: prof.id,
            dayOffset,
            dayIndex,
            dayName,
            dateStr,
            reason: 'no_day_config',
          });
          continue;
        }

        // IMPORTANT: keep logic unchanged, but log what the function is seeing
        const enabled = Boolean((dayConfig as any)?.enabled);
        if (!enabled) {
          log('availability_day_skip', {
            professionalId: prof.id,
            dayOffset,
            dayIndex,
            dayName,
            dateStr,
            reason: 'day_disabled',
            dayConfig,
          });
          continue; // Skip closed days
        }

        const startTime = (dayConfig as any).start || (dayConfig as any).open || '09:00';
        const endTime = (dayConfig as any).end || (dayConfig as any).close || '18:00';

        // For today, start from current time rounded up to next 30 min
        let firstSlot = startTime;
        if (dayOffset === 0) {
          const currentHour = brasiliaTime.getHours();
          const currentMin = brasiliaTime.getMinutes();
          const nextSlotMin = currentMin < 30 ? 30 : 0;
          const nextSlotHour = currentMin < 30 ? currentHour : currentHour + 1;
          const nextSlotTime = `${nextSlotHour.toString().padStart(2, '0')}:${nextSlotMin
            .toString()
            .padStart(2, '0')}`;

          if (nextSlotTime > startTime) {
            firstSlot = nextSlotTime;
          }
        }

        // Skip if past working hours
        if (firstSlot >= endTime) {
          log('availability_day_skip', {
            professionalId: prof.id,
            dayOffset,
            dayIndex,
            dayName,
            dateStr,
            reason: 'first_slot_after_end',
            startTime,
            endTime,
            firstSlot,
            brasiliaNowTime: `${brasiliaTime.getHours().toString().padStart(2, '0')}:${brasiliaTime
              .getMinutes()
              .toString()
              .padStart(2, '0')}`,
          });
          continue;
        }

        // Find first available slot
        let foundSlot = false;
        let slotTime = firstSlot;
        let slotsChecked = 0;
        let conflictsCount = 0;
        let firstConflictSample: any = null;

        while (slotTime < endTime && !foundSlot) {
          slotsChecked++;
          const [slotHour, slotMin] = slotTime.split(':').map(Number);
          const slotDateTime = new Date(checkDate);
          slotDateTime.setHours(slotHour, slotMin, 0, 0);
          const slotDateTimeUTC = brazilToUtc(slotDateTime);

          // Check if this slot conflicts with any appointment
          let hasConflict = false;
          for (const apt of profAppointments) {
            const aptStart = new Date(apt.scheduled_at);
            const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60 * 1000);
            const slotEnd = new Date(slotDateTimeUTC.getTime() + 60 * 60 * 1000); // Assume 1 hour for checking

            if (slotDateTimeUTC < aptEnd && slotEnd > aptStart) {
              hasConflict = true;
              conflictsCount++;
              if (!firstConflictSample) {
                firstConflictSample = {
                  slotDateTimeUTC: slotDateTimeUTC.toISOString(),
                  slotEndUTC: slotEnd.toISOString(),
                  appointment: {
                    id: apt.id,
                    scheduled_at: apt.scheduled_at,
                    duration_minutes: apt.duration_minutes,
                    status: apt.status,
                  },
                };
              }
              break;
            }
          }

          if (!hasConflict) {
            profAvailability.push(`${dayName} (${dateStr}) às ${slotTime}`);
            foundSlot = true;
            log('availability_slot_found', {
              professionalId: prof.id,
              dayOffset,
              dayIndex,
              dayName,
              dateStr,
              startTime,
              endTime,
              firstSlot,
              foundSlotTime: slotTime,
              slotsChecked,
              conflictsCount,
            });
          } else {
            // Move to next 30 min slot
            const [h, m] = slotTime.split(':').map(Number);
            const nextMin = m === 0 ? 30 : 0;
            const nextHour = m === 0 ? h : h + 1;
            slotTime = `${nextHour.toString().padStart(2, '0')}:${nextMin.toString().padStart(2, '0')}`;
          }
        }

        if (!foundSlot) {
          log('availability_no_slot', {
            professionalId: prof.id,
            dayOffset,
            dayIndex,
            dayName,
            dateStr,
            startTime,
            endTime,
            firstSlot,
            slotsChecked,
            conflictsCount,
            firstConflictSample,
          });
        }
      }

      if (profAvailability.length > 0) {
        availabilityLines.push(`- **${prof.name}**: Próximos disponíveis: ${profAvailability.join(' | ')}`);
      } else {
        availabilityLines.push(`- **${prof.name}**: Sem disponibilidade nos próximos 3 dias`);
      }

      log('availability_professional_result', {
        professionalId: prof.id,
        professionalName: prof.name,
        resultCount: profAvailability.length,
        results: profAvailability,
      });
    }

    log('availability_result', { availabilityLines });

    return availabilityLines.join('\n');
  } catch (error) {
    log('availability_unexpected_error', { error: String(error) });
    console.error('[AI-Assistant] Erro ao calcular disponibilidade:', error);
    return 'Erro ao verificar disponibilidade.';
  }
}

// Parse Brazilian date formats to Date object (uses centralized getBrazilNow)
function parseBrazilianDateLocal(dateStr: string, timeStr: string): Date | null {
  try {
    dateStr = dateStr.trim();
    timeStr = timeStr.trim();

    const brasiliaTime = getBrazilNow();

    let day: number, month: number, year: number;
    const parts = dateStr.split('/');

    if (parts.length === 2) {
      // Format DD/MM - add current year, or next year if date has passed
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = brasiliaTime.getFullYear();

      // If the date has already passed this year, use next year
      const testDate = new Date(year, month - 1, day);
      if (testDate < brasiliaTime) {
        // Check if it's for "today" (same day)
        if (day !== brasiliaTime.getDate() || month !== brasiliaTime.getMonth() + 1) {
          year++;
        }
      }
    } else if (parts.length === 3) {
      // Format DD/MM/YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      // Handle 2-digit year
      if (year < 100) {
        year += 2000;
      }
    } else {
      console.error('[AI-Assistant] Formato de data inválido:', dateStr);
      return null;
    }

    // Parse time
    const timeParts = timeStr.split(':');
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1] || '0', 10);

    // Validate ranges
    if (day < 1 || day > 31 || month < 1 || month > 12 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      console.error('[AI-Assistant] Valores de data/hora fora do intervalo válido');
      return null;
    }

    // Create date in Brasília timezone
    const scheduledDate = new Date(year, month - 1, day, hour, minute, 0);

    // Validate the date is valid (e.g., Feb 30 would fail)
    if (scheduledDate.getDate() !== day || scheduledDate.getMonth() !== month - 1) {
      console.error('[AI-Assistant] Data inválida (dia não existe no mês)');
      return null;
    }

    return scheduledDate;
  } catch (e) {
    console.error('[AI-Assistant] Erro ao parsear data:', e);
    return null;
  }
}

function formatWorkingHours(workingHours: any): string {
  // Check if working_hours is empty or not defined
  if (!workingHours || Object.keys(workingHours).length === 0) {
    return 'HORÁRIO NÃO CONFIGURADO - O estabelecimento NÃO informou o horário de funcionamento. SIGA O PROTOCOLO DE HORÁRIO NÃO CONFIGURADO.';
  }
  
  // Support both formats: 
  // - Named keys: { monday: { enabled, start, end }, ... }
  // - Numeric keys: { 0: { enabled, open, close }, ... } where 0=Sunday, 1=Monday, etc.
  const dayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const namedDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  const lines: string[] = [];
  let hasAnyDayConfigured = false;
  
  for (let i = 0; i < 7; i++) {
    // Try numeric key first, then named key
    const day = workingHours[i.toString()] || workingHours[i] || workingHours[namedDays[i]];
    const label = dayLabels[i];
    
    if (day?.enabled) {
      hasAnyDayConfigured = true;
      // Support both start/end and open/close formats
      const startTime = day.start || day.open;
      const endTime = day.end || day.close;
      lines.push(`- ${label}: ${startTime} às ${endTime}`);
    } else if (day && day.enabled === false) {
      // Explicitly marked as closed
      lines.push(`- ${label}: Fechado`);
    }
    // Don't list days that aren't configured
  }
  
  // If no day is configured, return the warning message
  if (!hasAnyDayConfigured) {
    return 'HORÁRIO NÃO CONFIGURADO - O estabelecimento NÃO informou o horário de funcionamento. SIGA O PROTOCOLO DE HORÁRIO NÃO CONFIGURADO.';
  }
  
  return lines.join('\n');
}

function buildSystemPrompt(config: AssistantConfig, establishment: EstablishmentData, clientInfo?: { name?: string; phone?: string }, availabilityInfo?: string): string {
  const styleGuide = config.language_style === 'formal'
    ? 'Use linguagem formal e profissional. Trate o cliente por "senhor(a)".'
    : 'Use linguagem amigável e casual, mas sempre profissional. Pode usar emojis moderadamente.';

  const servicesInfo = establishment.services.map(s => 
    `- ${s.name}: R$ ${s.price.toFixed(2)} (${s.duration_minutes} min)${s.description ? ` - ${s.description}` : ''}`
  ).join('\n');

  const professionalsInfo = establishment.professionals.map(p =>
    `- ${p.name}${p.specialties?.length ? ` (especialidades: ${p.specialties.join(', ')})` : ''}`
  ).join('\n');

  const promotionsInfo = establishment.promotions.length > 0
    ? establishment.promotions.map(p =>
        `- ${p.name}: ${p.discount_type === 'percentage' ? `${p.discount_value}% de desconto` : `R$ ${p.discount_value} de desconto`}${p.description ? ` - ${p.description}` : ''}`
      ).join('\n')
    : 'Nenhuma promoção ativa no momento.';

  // Cupons de desconto
  const couponsInfo = establishment.coupons.length > 0
    ? establishment.coupons.map(c =>
        `- Código: ${c.code} → ${c.discount_type === 'percentage' ? `${c.discount_value}% de desconto` : `R$ ${c.discount_value} de desconto`}${c.min_purchase_value ? ` (mínimo R$ ${c.min_purchase_value})` : ''}${c.description ? ` - ${c.description}` : ''}`
      ).join('\n')
    : 'Nenhum cupom disponível.';

  // Programa de fidelidade
  const loyaltyInfo = establishment.loyaltyProgram
    ? `Programa: ${establishment.loyaltyProgram.name}
${establishment.loyaltyProgram.description || ''}
- A cada R$ 1 gasto, o cliente ganha ${establishment.loyaltyProgram.points_per_currency} ponto(s)
Recompensas disponíveis:
${establishment.loyaltyProgram.rewards.map(r => `  • ${r.name}: ${r.points_required} pontos (vale R$ ${r.reward_value})`).join('\n') || '  Nenhuma recompensa cadastrada.'}`
    : 'Nenhum programa de fidelidade ativo.';

  // Endereço
  const addressInfo = [establishment.address, establishment.city, establishment.state].filter(Boolean).join(', ') || 'Endereço não informado';

  // Client context section
  const clientContext = clientInfo?.name 
    ? `\n## Cliente Atual
O cliente que está conversando com você:
- Nome: ${clientInfo.name}
- Telefone: ${clientInfo.phone || 'Não informado'}

IMPORTANTE: Você JÁ SABE o nome e telefone deste cliente. NÃO pergunte novamente essas informações! Use o nome dele nas conversas para torná-las mais pessoais.`
    : `\n## Cliente Atual
O cliente ainda não está identificado. Você precisará coletar nome e telefone apenas se ele quiser agendar algo.`;

  // Obter data atual no fuso horário de Brasília
  const brasiliaTime = getBrazilNow();
  
  const diaAtual = formatBrazilDateTime(brasiliaTime, { dateOnly: true });
  const horaAtual = formatBrazilDateTime(brasiliaTime, { timeOnly: true });
  const diaSemanaAtual = DIAS_SEMANA_FULL[brasiliaTime.getDay()];
  const mesNomeAtual = MESES[brasiliaTime.getMonth()];
  const anoAtual = brasiliaTime.getFullYear();

  // Calcular data de amanhã corretamente
  const amanha = new Date(brasiliaTime.getTime() + 24 * 60 * 60 * 1000);
  const dataAmanha = formatBrazilDateTime(amanha, { dateOnly: true });

  const dataHoraInfo = `
## Data e Hora Atual (Brasília - UTC-3)
- Data: ${diaAtual} (${diaSemanaAtual}, ${brasiliaTime.getDate().toString().padStart(2, '0')} de ${mesNomeAtual} de ${anoAtual})
- Hora: ${horaAtual}
- "Amanhã" significa ${dataAmanha}

CRÍTICO: Use SEMPRE a data correta ao confirmar agendamentos. Hoje é ${diaAtual}. NÃO invente datas!`;

  // Disponibilidade em tempo real section
  const availabilitySection = availabilityInfo 
    ? `\n## DISPONIBILIDADE EM TEMPO REAL - USE ESTA INFORMAÇÃO SEMPRE!
IMPORTANTE: Esta é a disponibilidade REAL consultada no banco de dados AGORA. Use estas informações para sugerir horários!
${availabilityInfo}

REGRA CRÍTICA: Quando o cliente pedir "o mais rápido possível" ou "primeiro disponível", OFEREÇA O HORÁRIO MAIS PRÓXIMO desta lista, começando por HOJE se houver disponibilidade!`
    : '';

  return `Você é ${config.assistant_name}, assistente virtual do ${establishment.name}.
${dataHoraInfo}

## Informações do Estabelecimento
- **Nome**: ${establishment.name}
- **Telefone**: ${establishment.phone || 'Não informado'}
- **Endereço**: ${addressInfo}
${establishment.description ? `- **Sobre**: ${establishment.description}` : ''}

## Horário de Funcionamento
${formatWorkingHours(establishment.working_hours)}
${availabilitySection}

## Estilo de Comunicação
${styleGuide}
${clientContext}

## Suas Capacidades
1. **Agendamentos**: Ajudar clientes a agendar serviços
2. **Remarcações**: Auxiliar na remarcação de agendamentos existentes
3. **Cancelamentos**: Ajudar clientes a cancelar agendamentos
4. **Promoções e Cupons**: Informar sobre promoções ativas e cupons de desconto
5. **Programa de Fidelidade**: Explicar como funciona o programa e recompensas
6. **Fila de Espera**: Se a data/hora desejada estiver ocupada, oferecer alternativas ou adicionar à fila de espera
7. **Informações**: Responder dúvidas sobre serviços, preços, endereço e funcionamento

## Serviços Disponíveis
${servicesInfo || 'Nenhum serviço cadastrado.'}

## Profissionais
${professionalsInfo || 'Nenhum profissional cadastrado.'}

## Promoções Ativas
${promotionsInfo}

## Cupons de Desconto
${couponsInfo}

## Programa de Fidelidade
${loyaltyInfo}

${establishment.cancellation_policy ? `## Política de Cancelamento\n${establishment.cancellation_policy}` : ''}

## Instruções Especiais
${config.custom_instructions || 'Sem instruções adicionais.'}

## Regras CRÍTICAS - SIGA RIGOROSAMENTE
1. NUNCA invente informações - se não souber, diga que vai verificar ou encaminhe para humano
2. SEJA OBJETIVO E DIRETO - responda exatamente o que foi perguntado
3. Se o cliente pedir "o mais rápido possível" ou "primeiro horário disponível", USE A SEÇÃO "DISPONIBILIDADE EM TEMPO REAL" acima e sugira IMEDIATAMENTE o horário mais próximo (começando por HOJE)
4. Se o cliente disser "qualquer profissional" ou "independente de profissional", escolha o profissional com o horário mais próximo disponível
5. NÃO faça perguntas redundantes - se você já tem a informação, USE-A
6. Para agendar, confirme apenas as informações que FALTAM: serviço, profissional (se não especificado que pode ser qualquer um), data e horário
7. Mantenha respostas CONCISAS - máximo 2 parágrafos curtos
8. Se o cliente mencionar uma data/hora ocupada, sugira alternativas da lista de disponibilidade
9. Se não conseguir resolver, ofereça encaminhar para atendimento humano
10. USE A DATA ATUAL CORRETA: Hoje é ${diaAtual}. Amanhã é ${dataAmanha}. NUNCA invente datas!
11. Ao informar sobre cupons, diga o código exato para o cliente usar
12. Ao falar de fidelidade, explique quanto vale cada ponto e quais recompensas estão disponíveis
13. PRIORIZE SEMPRE horários de HOJE e AMANHÃ antes de sugerir datas mais distantes!

## PROTOCOLO DE HORÁRIO NÃO CONFIGURADO - CRÍTICO!
Se você ver a mensagem "HORÁRIO NÃO CONFIGURADO" nas informações de horário acima, você DEVE:
1. Informar ao cliente: "Infelizmente, o estabelecimento ainda não nos informou seus horários de funcionamento"
2. Pedir desculpas pela inconveniência
3. Sugerir que o cliente entre em contato diretamente com o estabelecimento pelo telefone: ${establishment.phone || 'não informado'}
4. Dizer que você vai notificar o estabelecimento sobre essa situação
5. Encerrar a conversa educadamente
6. Incluir [NOTIFICAR_HORARIO] ao final da sua mensagem para gerar notificação ao estabelecimento
7. NÃO tente agendar, nem dar informações de horário, nem prosseguir com atendimento normal

## CONSULTA DE AGENDAMENTOS - REGRA IMPORTANTE
Quando o cliente perguntar sobre seus agendamentos, quiser verificar, cancelar, remarcar ou alterar algo:
- Responda IMEDIATAMENTE com [LISTAR_AGENDAMENTOS] no final da sua mensagem
- NÃO pergunte detalhes antes de listar, o sistema vai mostrar os agendamentos automaticamente
- APÓS mostrar os agendamentos, o sistema exibirá opções para o cliente escolher o que deseja fazer
- Exemplo de resposta: "Claro! Vou buscar seus agendamentos. [LISTAR_AGENDAMENTOS]"

## Ações Especiais
- Para escalar para humano, inclua [ESCALAR] no final da resposta
- Para adicionar à fila de espera, inclua [FILA_ESPERA|serviço|data|horário] no final (use | como separador)
- Para agendar, inclua [AGENDAR|serviço|profissional|data|horário|nome|telefone] no final (use | como separador, data no formato DD/MM/AAAA, horário no formato HH:MM)
- Para buscar agendamentos do cliente, inclua [LISTAR_AGENDAMENTOS] no final
- Para notificar estabelecimento sobre horário não configurado, inclua [NOTIFICAR_HORARIO] no final`;

// IMPORTANTE: O separador | é usado para evitar conflitos com : no horário (ex: 13:30)
}

function isWorkingHoursConfigured(workingHours: any): boolean {
  if (!workingHours || Object.keys(workingHours).length === 0) {
    return false;
  }
  
  // Support both formats: numeric keys (0-6) and named keys (sunday-saturday)
  const namedDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  for (let i = 0; i < 7; i++) {
    const day = workingHours[i.toString()] || workingHours[i] || workingHours[namedDays[i]];
    if (day?.enabled === true || day?.enabled === false) {
      return true;
    }
  }
  
  return false;
}

function isWithinWorkingHours(workingHours: any): { configured: boolean; withinHours: boolean } {
  // If working_hours is null, undefined, or empty object - NOT configured
  if (!workingHours || Object.keys(workingHours).length === 0) {
    console.log('[AI-Assistant] Horário não configurado');
    return { configured: false, withinHours: false };
  }

  // Support both formats: numeric keys (0-6) and named keys (sunday-saturday)
  const namedDaysLocal = NAMED_DAYS;
  
  // Check if any day has configuration
  let hasAnyConfig = false;
  for (let i = 0; i < 7; i++) {
    const day = workingHours[i.toString()] || workingHours[i] || workingHours[namedDaysLocal[i]];
    if (day?.enabled === true || day?.enabled === false) {
      hasAnyConfig = true;
      break;
    }
  }
  
  if (!hasAnyConfig) {
    console.log('[AI-Assistant] Nenhum dia configurado no horário');
    return { configured: false, withinHours: false };
  }

  // Converter para horário de Brasília (UTC-3)
  const brasiliaTime = getBrazilNow();
  
  const dayIndex = brasiliaTime.getDay();
  // Try numeric key first, then named key
  const todayConfig = workingHours[dayIndex.toString()] || workingHours[dayIndex] || workingHours[namedDaysLocal[dayIndex]];

  // If this specific day is not configured, consider closed (not explicitly open)
  if (!todayConfig || todayConfig.enabled === undefined) {
    console.log(`[AI-Assistant] Dia ${dayIndex} (${namedDaysLocal[dayIndex]}) não configurado - considerando fechado`);
    return { configured: true, withinHours: false };
  }

  // If day exists but is explicitly disabled
  if (todayConfig.enabled === false) {
    console.log(`[AI-Assistant] Dia ${dayIndex} (${namedDaysLocal[dayIndex]}) explicitamente fechado`);
    return { configured: true, withinHours: false };
  }

  // If day is enabled, check time range - support both start/end and open/close formats
  const startTime = todayConfig.start || todayConfig.open;
  const endTime = todayConfig.end || todayConfig.close;
  
  if (todayConfig.enabled && startTime && endTime) {
    const hours = brasiliaTime.getHours().toString().padStart(2, '0');
    const minutes = brasiliaTime.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    
    const isWithin = currentTime >= startTime && currentTime <= endTime;
    console.log(`[AI-Assistant] Horário atual (BRT): ${currentTime}, Configurado: ${startTime}-${endTime}, Dentro: ${isWithin}`);
    
    return { configured: true, withinHours: isWithin };
  }

  // Default to closed if configuration is incomplete
  console.log(`[AI-Assistant] Configuração incompleta para dia ${dayIndex} - considerando fechado`);
  return { configured: true, withinHours: false };
}

function formatAppointmentDate(dateString: string): string {
  const date = new Date(dateString);
  const brasiliaTime = utcToBrazil(date);
  const diaSemana = DIAS_SEMANA_CURTOS[brasiliaTime.getDay()];
  return `${diaSemana}, ${formatBrazilDateTimeShort(brasiliaTime)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientRequestId =
      req.headers.get('x-client-request-id') ||
      req.headers.get('x-request-id') ||
      req.headers.get('cf-ray') ||
      crypto.randomUUID();

    const {
      action,
      establishmentId,
      conversationId,
      message,
      messageType = 'text',
      voiceTranscription,
      clientName,
      clientPhone,
      clientId,
      appointmentIds,
      cancelReason,
    } = await req.json();

    console.log(
      '[AI-Assistant] Request',
      JSON.stringify({
        ts: new Date().toISOString(),
        requestId: clientRequestId,
        action,
        establishmentId,
        conversationId,
        messageType,
        clientId,
      })
    );

    // Get assistant config
    const config = await getAssistantConfig(establishmentId);
    if (!config || !config.is_enabled) {
      return new Response(
        JSON.stringify({ error: 'Assistente virtual não está habilitada para este estabelecimento.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check working hours
    const workingHoursStatus = isWithinWorkingHours(config.working_hours);
    
    // Only apply business hours restriction if hours ARE configured
    if (config.availability_mode === 'only_business_hours' && workingHoursStatus.configured && !workingHoursStatus.withinHours) {
      return new Response(
        JSON.stringify({ 
          offline: true,
          message: config.offline_message || 'Estamos fora do horário de atendimento.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check usage limits
    const usageCheck = await checkUsageLimits(establishmentId);
    if (!usageCheck.allowed) {
      return new Response(
        JSON.stringify({ error: usageCheck.reason, limitReached: true }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get establishment data
    const establishment = await getEstablishmentData(establishmentId);
    if (!establishment) {
      return new Response(
        JSON.stringify({ error: 'Estabelecimento não encontrado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    if (action === 'start_conversation') {
      // Check for existing conversation from last 24 hours for this client
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let existingConversation = null;
      let existingMessages: Array<{ sender_type: string; content: string; created_at: string }> = [];

      if (clientId || clientPhone) {
        // Find existing active conversation from last 24h
        const conversationQuery = supabase
          .from('ai_assistant_conversations')
          .select('id, created_at')
          .eq('establishment_id', establishmentId)
          .eq('status', 'active')
          .gte('created_at', last24h)
          .order('created_at', { ascending: false })
          .limit(1);

        if (clientId) {
          conversationQuery.eq('client_id', clientId);
        } else if (clientPhone) {
          conversationQuery.eq('client_phone', clientPhone);
        }

        const { data: existingConv } = await conversationQuery.maybeSingle();
        
        if (existingConv) {
          existingConversation = existingConv;
          console.log('[AI-Assistant] Conversa existente encontrada:', existingConv.id);
          
          // Fetch messages from existing conversation
          const { data: messages } = await supabase
            .from('ai_assistant_messages')
            .select('sender_type, content, created_at')
            .eq('conversation_id', existingConv.id)
            .order('created_at', { ascending: true });
          
          existingMessages = messages || [];
          console.log('[AI-Assistant] Mensagens recuperadas:', existingMessages.length);
        }
      }

      let conversationId: string;
      let welcomeMessage: string;

      if (existingConversation && existingMessages.length > 0) {
        // Resume existing conversation
        conversationId = existingConversation.id;
        welcomeMessage = ''; // No welcome message needed when resuming
        
        // Update the conversation's updated_at
        await supabase
          .from('ai_assistant_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      } else {
        // Create new conversation
        const { data: conversation, error: convError } = await supabase
          .from('ai_assistant_conversations')
          .insert({
            establishment_id: establishmentId,
            client_id: clientId || null,
            client_name: clientName || null,
            client_phone: clientPhone || null,
            channel: 'portal',
            status: 'active',
          })
          .select()
          .single();

        if (convError) {
          console.error('Error creating conversation:', convError);
          throw convError;
        }

        conversationId = conversation.id;
        welcomeMessage = config.welcome_message || 
          `Olá! Sou ${config.assistant_name}, assistente virtual do ${establishment.name}. Como posso ajudar?`;

        await supabase.from('ai_assistant_messages').insert({
          conversation_id: conversationId,
          sender_type: 'assistant',
          message_type: 'text',
          content: welcomeMessage,
        });
      }

      // Add offline notice if outside hours (only if hours are configured)
      let offlineNotice = null;
      if (workingHoursStatus.configured && !workingHoursStatus.withinHours && config.availability_mode === '24h_with_message') {
        offlineNotice = config.offline_message;
      }

      return new Response(
        JSON.stringify({
          conversationId,
          welcomeMessage,
          offlineNotice,
          assistantName: config.assistant_name,
          existingMessages: existingMessages.map(m => ({
            content: m.content,
            senderType: m.sender_type,
            createdAt: m.created_at,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Get client's future appointments for cancellation
    if (action === 'get_appointments') {
      const appointments = await getClientFutureAppointments(establishmentId, clientId, clientPhone);
      
      const formattedAppointments = appointments.map(apt => ({
        id: apt.id,
        serviceName: apt.service?.name || 'Serviço',
        professionalName: apt.professional?.name || 'Profissional',
        dateTime: formatAppointmentDate(apt.scheduled_at),
        status: apt.status,
        price: apt.service?.price || 0,
      }));

      return new Response(
        JSON.stringify({ appointments: formattedAppointments }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Cancel selected appointments
    if (action === 'cancel_appointments') {
      if (!appointmentIds || appointmentIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Nenhum agendamento selecionado.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await cancelAppointments(appointmentIds, cancelReason || 'Cancelado pelo cliente via assistente virtual');
      
      // Save cancellation message to conversation
      if (conversationId) {
        const cancelMessage = result.success
          ? `✅ ${result.cancelled} agendamento(s) cancelado(s) com sucesso!`
          : `⚠️ ${result.cancelled} agendamento(s) cancelado(s), mas houve ${result.errors.length} erro(s).`;

        await supabase.from('ai_assistant_messages').insert({
          conversation_id: conversationId,
          sender_type: 'assistant',
          message_type: 'text',
          content: cancelMessage,
        });
      }

      return new Response(
        JSON.stringify({ 
          success: result.success,
          cancelled: result.cancelled,
          message: result.success 
            ? `${result.cancelled} agendamento(s) cancelado(s) com sucesso!`
            : `Alguns agendamentos não puderam ser cancelados.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send_message') {
      if (!conversationId || !message) {
        return new Response(
          JSON.stringify({ error: 'conversationId e message são obrigatórios.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Save user message
      await supabase.from('ai_assistant_messages').insert({
        conversation_id: conversationId,
        sender_type: 'client',
        message_type: messageType,
        content: message,
        voice_transcription: voiceTranscription,
      });

      // Get conversation history
      const { data: messages } = await supabase
        .from('ai_assistant_messages')
        .select('sender_type, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20);

      // Build messages for AI
      const chatMessages: ChatMessage[] = messages?.map(m => ({
        role: m.sender_type === 'client' ? 'user' : 'assistant',
        content: m.content,
      })) || [];

      // Get real-time availability info
      const availabilityInfo = await getAvailabilityInfo(
        establishmentId,
        establishment.working_hours,
        establishment.professionals,
        { requestId: clientRequestId, conversationId }
      );

      // Add system prompt with client context and availability
      let systemPrompt = buildSystemPrompt(config, establishment, { name: clientName, phone: clientPhone }, availabilityInfo);
      
      // Load and inject establishment-specific learnings
      const learningsContext = await loadEstablishmentLearnings(establishmentId, message);
      if (learningsContext) {
        systemPrompt += learningsContext;
      }

      // Call AI
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            ...chatMessages,
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Muitas requisições. Tente novamente em alguns segundos.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'Erro de créditos. Entre em contato com o suporte.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`AI API error: ${response.status}`);
      }

      const aiResponse = await response.json();
      let assistantMessage = aiResponse.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

      // Check for special actions
      let shouldEscalate = false;
      let waitlistData = null;
      let scheduleData: { 
        service: any; 
        professional: any; 
        date: any; 
        time: any; 
        name: any; 
        phone: any; 
        appointmentId?: string; 
        created?: boolean;
        error?: string;
        conflict?: boolean;
      } | null = null;
      let showAppointmentsList = false;
      let notifyWorkingHours = false;

      // Check for cancellation flow trigger
      if (assistantMessage.includes('[LISTAR_AGENDAMENTOS]')) {
        showAppointmentsList = true;
        assistantMessage = assistantMessage.replace('[LISTAR_AGENDAMENTOS]', '').trim();
      }

      // Check for working hours notification - just log it, no WhatsApp notification
      // The establishment will see an in-app alert on the portal dashboard
      if (assistantMessage.includes('[NOTIFICAR_HORARIO]')) {
        notifyWorkingHours = true;
        assistantMessage = assistantMessage.replace('[NOTIFICAR_HORARIO]', '').trim();
        console.log('[AI-Assistant] Horário de funcionamento não configurado - Cliente:', clientName, clientPhone);
      }

      if (assistantMessage.includes('[ESCALAR]')) {
        shouldEscalate = true;
        assistantMessage = assistantMessage.replace('[ESCALAR]', '').trim();
        
        // Update conversation status
        await supabase
          .from('ai_assistant_conversations')
          .update({ status: 'escalated', escalated_at: new Date().toISOString() })
          .eq('id', conversationId);

        // Enviar WhatsApp ao estabelecimento via instância Z-API do SaaS
        if (config.escalation_whatsapp) {
          const Z_API_INSTANCE_ID = Deno.env.get('Z_API_INSTANCE_ID');
          const Z_API_TOKEN = Deno.env.get('Z_API_TOKEN');
          const Z_API_CLIENT_TOKEN = Deno.env.get('Z_API_CLIENT_TOKEN') || Z_API_TOKEN;

          if (Z_API_INSTANCE_ID && Z_API_TOKEN) {
            try {
              // Buscar resumo da conversa para contexto
              const { data: recentMessages } = await supabase
                .from('ai_assistant_messages')
                .select('sender_type, content')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(5);

              const conversationSummary = recentMessages?.reverse()
                .map(m => `${m.sender_type === 'client' ? 'Cliente' : 'Assistente'}: ${m.content.slice(0, 100)}`)
                .join('\n') || 'Sem histórico';

              const escalationMessage = `🚨 *Escalonamento - ${establishment.name}*\n\n` +
                `*Cliente:* ${clientName || 'Não informado'}\n` +
                `*Telefone:* ${clientPhone || 'Não informado'}\n` +
                `*Canal:* Portal de agendamento\n\n` +
                `*Resumo da conversa:*\n${conversationSummary}\n\n` +
                `O cliente solicitou atendimento humano.`;

              const formattedPhone = config.escalation_whatsapp.replace(/\D/g, '');
              const phoneToSend = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (Z_API_CLIENT_TOKEN) {
                headers['Client-Token'] = Z_API_CLIENT_TOKEN;
              }

              const zapiResponse = await fetch(
                `https://api.z-api.io/instances/${Z_API_INSTANCE_ID}/token/${Z_API_TOKEN}/send-text`,
                {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ phone: phoneToSend, message: escalationMessage }),
                }
              );

              if (zapiResponse.ok) {
                console.log(`[AI-Assistant] Escalação enviada via WhatsApp para: ${phoneToSend.slice(-4)}`);
              } else {
                const errorText = await zapiResponse.text();
                console.error(`[AI-Assistant] Erro ao enviar escalação: ${zapiResponse.status} - ${errorText}`);
              }
            } catch (error) {
              console.error('[AI-Assistant] Erro ao enviar WhatsApp de escalação:', error);
            }
          } else {
            console.log('[AI-Assistant] Z-API não configurado, escalação não enviada via WhatsApp');
          }
        }
      }

      // Support both | and : separators for backward compatibility
      const waitlistMatchPipe = assistantMessage.match(/\[FILA_ESPERA\|([^|]+)\|([^|]+)\|([^\]]+)\]/);
      const waitlistMatchColon = assistantMessage.match(/\[FILA_ESPERA:([^:]+):([^:]+):([^\]]+)\]/);
      const waitlistMatch = waitlistMatchPipe || waitlistMatchColon;
      if (waitlistMatch) {
        waitlistData = {
          service: waitlistMatch[1].trim(),
          date: waitlistMatch[2].trim(),
          time: waitlistMatch[3].trim(),
        };
        assistantMessage = assistantMessage.replace(waitlistMatch[0], '').trim();
        console.log('[AI-Assistant] Fila de espera detectada:', waitlistData);
      }

      // Support both | and : separators for backward compatibility
      // IMPORTANT: | separator is preferred because : conflicts with time format (13:30)
      const scheduleMatchPipe = assistantMessage.match(/\[AGENDAR\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^\]]+)\]/);
      // For colon separator, be more careful with time format - capture HH:MM as a single group
      const scheduleMatchColon = assistantMessage.match(/\[AGENDAR:([^:]+):([^:]+):([^:]+):(\d{1,2}:\d{2}):([^:]+):([^\]]+)\]/);
      const scheduleMatch = scheduleMatchPipe || scheduleMatchColon;
      
      if (scheduleMatch) {
        scheduleData = {
          service: scheduleMatch[1].trim(),
          professional: scheduleMatch[2].trim(),
          date: scheduleMatch[3].trim(),
          time: scheduleMatch[4].trim(),
          name: scheduleMatch[5].trim(),
          phone: scheduleMatch[6].trim(),
        };
        assistantMessage = assistantMessage.replace(scheduleMatch[0], '').trim();

        // Actually create the appointment in the database
        try {
          console.log('[AI-Assistant] Tentando criar agendamento:', JSON.stringify(scheduleData));
          console.log('[AI-Assistant] Regex usado:', scheduleMatchPipe ? 'pipe (|)' : 'colon (:)');
          
          // Find service by name (case-insensitive partial match)
          const { data: serviceData } = await supabase
            .from('services')
            .select('id, name, price, duration_minutes')
            .eq('establishment_id', establishmentId)
            .ilike('name', `%${scheduleData.service.trim()}%`)
            .eq('is_active', true)
            .limit(1)
            .single();

          if (!serviceData) {
            console.error('[AI-Assistant] Serviço não encontrado:', scheduleData.service);
            scheduleData.error = 'Serviço não encontrado';
          } else {
            // Find professional by name (case-insensitive partial match)
            const { data: professionalData } = await supabase
              .from('professionals')
              .select('id, name')
              .eq('establishment_id', establishmentId)
              .ilike('name', `%${scheduleData.professional.trim()}%`)
              .eq('is_active', true)
              .limit(1)
              .single();

            if (!professionalData) {
              console.error('[AI-Assistant] Profissional não encontrado:', scheduleData.professional);
              scheduleData.error = 'Profissional não encontrado';
            } else {
              // Parse date using the robust function
              console.log('[AI-Assistant] Parseando data:', scheduleData.date, 'e horário:', scheduleData.time);
              const scheduledDateBrasilia = parseBrazilianDateLocal(scheduleData.date, scheduleData.time);
              
              if (!scheduledDateBrasilia) {
                console.error('[AI-Assistant] Erro ao parsear data/hora:', scheduleData.date, scheduleData.time);
                scheduleData.error = 'Data ou horário inválido';
              } else {
                // Check if the date is in the past
                const nowBrasilia = getBrazilNow();
                
                console.log('[AI-Assistant] Data parseada (Brasília wall-clock):', formatBrazilDateTime(scheduledDateBrasilia));
                console.log('[AI-Assistant] Agora (Brasília wall-clock):', formatBrazilDateTime(nowBrasilia));
                console.log('[AI-Assistant] scheduledDateBrasilia.getTime():', scheduledDateBrasilia.getTime());
                console.log('[AI-Assistant] nowBrasilia.getTime():', nowBrasilia.getTime());
                console.log('[AI-Assistant] É passado?:', scheduledDateBrasilia < nowBrasilia);
                
                if (scheduledDateBrasilia < nowBrasilia) {
                  console.error('[AI-Assistant] Data no passado:', formatBrazilDateTime(scheduledDateBrasilia));
                  scheduleData.error = 'Não é possível agendar para uma data/hora que já passou';
                } else {
                  // Convert to UTC for storage
                  const scheduledAtUTC = brazilToUtc(scheduledDateBrasilia);
                  
                  console.log('[AI-Assistant] Data agendada (Brasília):', formatBrazilDateTime(scheduledDateBrasilia));
                  console.log('[AI-Assistant] Data agendada (UTC):', scheduledAtUTC.toISOString());

                  // Check for scheduling conflicts
                  const conflictCheck = await checkSchedulingConflict(
                    establishmentId,
                    professionalData.id,
                    scheduledAtUTC,
                    serviceData.duration_minutes
                  );

                  if (conflictCheck.hasConflict) {
                    console.error('[AI-Assistant] Conflito de horário detectado');
                    scheduleData.error = `Horário já ocupado. ${professionalData.name} já tem um agendamento neste horário.`;
                    scheduleData.conflict = true;
                  } else {
                    // Find or create client
                    const phoneClean = (scheduleData.phone || clientPhone || '').replace(/\D/g, '');
                    let appointmentClientId = clientId;

                    // Validate clientId exists if provided
                    if (appointmentClientId) {
                      const { data: existingClientById } = await supabase
                        .from('clients')
                        .select('id')
                        .eq('id', appointmentClientId)
                        .eq('establishment_id', establishmentId)
                        .maybeSingle();
                      
                      if (!existingClientById) {
                        console.warn('[AI-Assistant] clientId fornecido não existe, tentando por telefone');
                        appointmentClientId = undefined;
                      }
                    }

                    if (!appointmentClientId && phoneClean) {
                      // Try to find existing client by phone
                      const { data: existingClient } = await supabase
                        .from('clients')
                        .select('id')
                        .eq('establishment_id', establishmentId)
                        .eq('phone', phoneClean)
                        .maybeSingle();

                      if (existingClient) {
                        appointmentClientId = existingClient.id;
                        console.log('[AI-Assistant] Cliente encontrado por telefone:', appointmentClientId);
                      } else if (phoneClean.length >= 10) {
                        // Create new client only if phone is valid
                        const { data: newClient, error: clientError } = await supabase
                          .from('clients')
                          .insert({
                            establishment_id: establishmentId,
                            name: scheduleData.name || clientName || 'Cliente',
                            phone: phoneClean,
                          })
                          .select('id')
                          .single();

                        if (clientError) {
                          console.error('[AI-Assistant] Erro ao criar cliente:', clientError);
                        } else if (newClient) {
                          appointmentClientId = newClient.id;
                          console.log('[AI-Assistant] Novo cliente criado:', appointmentClientId);
                        }
                      }
                    }

                    // Create the appointment
                    const { data: newAppointment, error: appointmentError } = await supabase
                      .from('appointments')
                      .insert({
                        establishment_id: establishmentId,
                        service_id: serviceData.id,
                        professional_id: professionalData.id,
                        client_id: appointmentClientId || null,
                        client_name: scheduleData.name || clientName || 'Cliente',
                        client_phone: phoneClean,
                        scheduled_at: scheduledAtUTC.toISOString(),
                        duration_minutes: serviceData.duration_minutes,
                        price: serviceData.price,
                        status: 'pending',
                      })
                      .select()
                      .single();

                    if (appointmentError) {
                      console.error('[AI-Assistant] Erro ao criar agendamento:', appointmentError);
                      scheduleData.error = 'Erro ao salvar agendamento no banco de dados';
                      
                      // Record failure for learning
                      await recordAppointmentOutcome(establishmentId, conversationId, message, assistantMessage, false);
                    } else {
                      console.log('[AI-Assistant] Agendamento criado com sucesso:', newAppointment.id);
                      scheduleData.appointmentId = newAppointment.id;
                      scheduleData.created = true;
                      
                      // Record success for learning - this helps improve future responses
                      await recordAppointmentOutcome(establishmentId, conversationId, message, assistantMessage, true);
                    }
                  }
                }
              }
            }
          }
        } catch (scheduleError) {
          console.error('[AI-Assistant] Erro no processo de agendamento:', scheduleError);
          scheduleData.error = 'Erro interno ao processar agendamento';
        }
      }

      // Save assistant message
      await supabase.from('ai_assistant_messages').insert({
        conversation_id: conversationId,
        sender_type: 'assistant',
        message_type: 'text',
        content: assistantMessage,
        metadata: { waitlistData, scheduleData, shouldEscalate, showAppointmentsList },
      });

      // Increment usage
      await incrementUsage(establishmentId);

      return new Response(
        JSON.stringify({
          message: assistantMessage,
          shouldEscalate,
          waitlistData,
          scheduleData,
          showAppointmentsList,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'transcribe_voice') {
      // This would integrate with a speech-to-text service
      // For now, return a placeholder
      return new Response(
        JSON.stringify({ 
          error: 'Transcrição de voz ainda não implementada. Use a Lovable AI diretamente.' 
        }),
        { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in AI assistant:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
