import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  User,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  format,
  addDays,
  setHours,
  setMinutes,
  startOfDay,
  addMinutes,
  parseISO,
  isBefore,
  isAfter,
  getDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { EstablishmentAIChat } from "@/components/ai-assistant/EstablishmentAIChat";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { EstablishmentNameHeader } from "@/components/branding/EstablishmentNameHeader";
import { cn } from "@/lib/utils";

type Service = Tables<"services">;
type Professional = Tables<"professionals">;
type Establishment = Tables<"establishments">;

const ANY_PRO = "__any__";

interface Item {
  serviceId: string;
  professionalId: string; // ANY_PRO ou id
}

interface WHDay {
  open: string;
  close: string;
  enabled: boolean;
}
type WH = Record<string, WHDay>;

const DEFAULT_WH: WH = {
  "0": { open: "09:00", close: "18:00", enabled: false },
  "1": { open: "09:00", close: "20:00", enabled: true },
  "2": { open: "09:00", close: "20:00", enabled: true },
  "3": { open: "09:00", close: "20:00", enabled: true },
  "4": { open: "09:00", close: "20:00", enabled: true },
  "5": { open: "09:00", close: "20:00", enabled: true },
  "6": { open: "09:00", close: "18:00", enabled: true },
};

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
  const [profServices, setProfServices] = useState<
    Array<{ professional_id: string; service_id: string }>
  >([]);

  const [estabWH, setEstabWH] = useState<WH>(DEFAULT_WH);
  const [profsWH, setProfsWH] = useState<Record<string, WH>>({});
  const [appointments, setAppointments] = useState<
    Array<{ id: string; scheduled_at: string; duration_minutes: number; professional_id: string }>
  >([]);
  const [apptServices, setApptServices] = useState<
    Array<{ professional_id: string; starts_at: string; duration_minutes: number }>
  >([]);
  const [blocks, setBlocks] = useState<
    Array<{ professional_id: string; start_time: string; end_time: string }>
  >([]);
  const [closures, setClosures] = useState<
    Array<{ start_date: string; end_date: string; start_time: string | null; end_time: string | null }>
  >([]);

  const [items, setItems] = useState<Item[]>([{ serviceId: "", professionalId: "" }]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  type SeqMode = "sequential" | "gap" | "parallel";
  const [mode, setMode] = useState<SeqMode>("sequential");

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCpf, setClientCpf] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (slug) fetchEstablishmentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setEstabWH(((est.working_hours as unknown) as WH) || DEFAULT_WH);

      const [svcRes, profRes, clRes] = await Promise.all([
        supabase
          .from("services")
          .select("*")
          .eq("establishment_id", est.id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("professionals")
          .select("*")
          .eq("establishment_id", est.id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("establishment_closures")
          .select("start_date, end_date, start_time, end_time")
          .eq("establishment_id", est.id)
          .gte("end_date", format(new Date(), "yyyy-MM-dd")),
      ]);

      const profs = (profRes.data || []) as Professional[];
      setServices(((svcRes.data as Service[]) || []));
      setProfessionals(profs);
      setClosures((clRes.data || []) as any);

      const pwh: Record<string, WH> = {};
      for (const p of profs) {
        if ((p as any).working_hours) pwh[p.id] = (p as any).working_hours as WH;
      }
      setProfsWH(pwh);

      const profIds = profs.map((p) => p.id);
      if (profIds.length) {
        const horizonStart = new Date();
        const horizonEnd = addDays(horizonStart, 30);
        const [psRes, apRes, asRes, blkRes] = await Promise.all([
          supabase
            .from("professional_services")
            .select("professional_id, service_id")
            .in("professional_id", profIds),
          supabase
            .from("appointments")
            .select("id, scheduled_at, duration_minutes, professional_id")
            .eq("establishment_id", est.id)
            .gte("scheduled_at", horizonStart.toISOString())
            .lte("scheduled_at", horizonEnd.toISOString())
            .neq("status", "cancelled"),
          supabase
            .from("appointment_services")
            .select("professional_id, starts_at, duration_minutes")
            .in("professional_id", profIds)
            .gte("starts_at", horizonStart.toISOString())
            .lte("starts_at", horizonEnd.toISOString()),
          supabase
            .from("professional_blocked_times")
            .select("professional_id, start_time, end_time")
            .in("professional_id", profIds)
            .gte("end_time", horizonStart.toISOString()),
        ]);
        setProfServices((psRes.data || []) as any);
        setAppointments((apRes.data || []) as any);
        setApptServices((asRes.data || []) as any);
        setBlocks((blkRes.data || []) as any);
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

  const sortedServices = useMemo(
    () =>
      [...services].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
      ),
    [services]
  );

  const eligibleProfsFor = (serviceId: string) => {
    if (!serviceId) return professionals;
    const ids = new Set(
      profServices.filter((ps) => ps.service_id === serviceId).map((ps) => ps.professional_id)
    );
    if (ids.size === 0) return professionals;
    return professionals.filter((p) => ids.has(p.id));
  };

  const totalDuration = useMemo(
    () =>
      items.reduce((acc, it) => {
        const s = services.find((x) => x.id === it.serviceId);
        return acc + (s?.duration_minutes || 0);
      }, 0),
    [items, services]
  );

  const totalPrice = useMemo(
    () =>
      items.reduce((acc, it) => {
        const s = services.find((x) => x.id === it.serviceId);
        return acc + Number(s?.price || 0);
      }, 0),
    [items, services]
  );

  // === Availability helpers ===
  const getWHForDay = (d: Date, profId?: string) => {
    const day = getDay(d).toString();
    if (profId) {
      const pwh = profsWH[profId];
      if (pwh && pwh[day]) {
        if (!pwh[day].enabled) return null;
        return { open: pwh[day].open, close: pwh[day].close };
      }
    }
    const ed = estabWH[day];
    if (!ed || !ed.enabled) return null;
    return { open: ed.open, close: ed.close };
  };

  const isDateClosed = (d: Date, time?: string) => {
    const ds = format(d, "yyyy-MM-dd");
    return closures.some((c) => {
      if (ds < c.start_date || ds > c.end_date) return false;
      if (!c.start_time || !c.end_time) return true;
      if (time) return time >= c.start_time && time < c.end_time;
      return true;
    });
  };

  const isBlockFree = (start: Date, dur: number, profId: string) => {
    const end = addMinutes(start, dur);
    const wh = getWHForDay(start, profId);
    if (!wh) return false;
    const timeStr = format(start, "HH:mm");
    const endStr = format(end, "HH:mm");
    if (timeStr < wh.open || endStr > wh.close) return false;
    if (isDateClosed(start, timeStr)) return false;
    for (const b of blocks) {
      if (b.professional_id !== profId) continue;
      const bs = parseISO(b.start_time);
      const be = parseISO(b.end_time);
      if (isBefore(start, be) && isAfter(end, bs)) return false;
    }
    for (const a of appointments) {
      if (a.professional_id !== profId) continue;
      const as = parseISO(a.scheduled_at);
      const ae = addMinutes(as, a.duration_minutes);
      if (isBefore(start, ae) && isAfter(end, as)) return false;
    }
    for (const s of apptServices) {
      if (s.professional_id !== profId) continue;
      const ss = parseISO(s.starts_at);
      const se = addMinutes(ss, s.duration_minutes);
      if (isBefore(start, se) && isAfter(end, ss)) return false;
    }
    return true;
  };

  const fitsSequence = (start: Date): boolean => {
    let cursor = start;
    for (const it of items) {
      const svc = services.find((s) => s.id === it.serviceId);
      if (!svc) return false;
      const profId =
        it.professionalId && it.professionalId !== ANY_PRO ? it.professionalId : null;
      if (!allowGap) {
        if (profId) {
          if (!isBlockFree(cursor, svc.duration_minutes, profId)) return false;
        } else {
          const elig = eligibleProfsFor(it.serviceId);
          const free = elig.find((p) => isBlockFree(cursor, svc.duration_minutes, p.id));
          if (!free) return false;
        }
        cursor = addMinutes(cursor, svc.duration_minutes);
      } else {
        let placed = false;
        for (
          let probe = cursor;
          isBefore(probe, addMinutes(start, 12 * 60));
          probe = addMinutes(probe, 15)
        ) {
          if (profId) {
            if (isBlockFree(probe, svc.duration_minutes, profId)) {
              cursor = addMinutes(probe, svc.duration_minutes);
              placed = true;
              break;
            }
          } else {
            const elig = eligibleProfsFor(it.serviceId);
            const free = elig.find((p) => isBlockFree(probe, svc.duration_minutes, p.id));
            if (free) {
              cursor = addMinutes(probe, svc.duration_minutes);
              placed = true;
              break;
            }
          }
        }
        if (!placed) return false;
      }
    }
    return true;
  };

  const resolveSequence = (start: Date) => {
    if (!items.every((it) => it.serviceId && it.professionalId)) return null;
    const out: Array<{
      serviceId: string;
      professionalId: string;
      startsAt: Date;
      duration: number;
      price: number;
    }> = [];
    let cursor = start;
    for (const it of items) {
      const svc = services.find((s) => s.id === it.serviceId);
      if (!svc) return null;
      let profId = it.professionalId;
      let placed: Date | null = null;
      if (!allowGap) {
        if (profId === ANY_PRO) {
          const elig = eligibleProfsFor(it.serviceId);
          const free = elig.find((p) => isBlockFree(cursor, svc.duration_minutes, p.id));
          if (!free) return null;
          profId = free.id;
        } else if (!isBlockFree(cursor, svc.duration_minutes, profId)) {
          return null;
        }
        placed = cursor;
      } else {
        for (
          let probe = cursor;
          isBefore(probe, addMinutes(start, 12 * 60));
          probe = addMinutes(probe, 15)
        ) {
          if (profId === ANY_PRO) {
            const elig = eligibleProfsFor(it.serviceId);
            const free = elig.find((p) => isBlockFree(probe, svc.duration_minutes, p.id));
            if (free) {
              profId = free.id;
              placed = probe;
              break;
            }
          } else if (isBlockFree(probe, svc.duration_minutes, profId)) {
            placed = probe;
            break;
          }
        }
        if (!placed) return null;
      }
      out.push({
        serviceId: it.serviceId,
        professionalId: profId,
        startsAt: placed,
        duration: svc.duration_minutes,
        price: Number(svc.price || 0),
      });
      cursor = addMinutes(placed, svc.duration_minutes);
    }
    return out;
  };

  const itemsReady = items.length > 0 && items.every((it) => it.serviceId && it.professionalId);

  const slotsForDay = useMemo(() => {
    if (!itemsReady || !selectedDate || totalDuration === 0) return [] as string[];
    const wh = getWHForDay(selectedDate);
    if (!wh) return [];
    const startH = Number(wh.open.split(":")[0]);
    const startM = Number(wh.open.split(":")[1]);
    const endH = Number(wh.close.split(":")[0]);
    const now = new Date();
    const out: string[] = [];
    for (let hour = startH; hour < endH; hour++) {
      for (const minute of [0, 30]) {
        if (hour === startH && minute < startM) continue;
        const slotDate = setMinutes(setHours(selectedDate, hour), minute);
        if (isBefore(slotDate, now)) continue;
        if (fitsSequence(slotDate)) out.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    itemsReady,
    selectedDate,
    items,
    totalDuration,
    appointments,
    apptServices,
    blocks,
    closures,
    estabWH,
    profsWH,
    allowGap,
  ]);

  useEffect(() => {
    if (selectedTime && !slotsForDay.includes(selectedTime)) setSelectedTime(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsForDay]);

  const generateDates = () => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 14; i++) dates.push(addDays(today, i));
    return dates;
  };

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setSelectedTime(null);
  };
  const addItem = () => {
    setItems((prev) => [...prev, { serviceId: "", professionalId: "" }]);
    setSelectedTime(null);
  };
  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setSelectedTime(null);
  };

  const previewSeq = useMemo(() => {
    if (!selectedTime || !selectedDate) return null;
    const [h, m] = selectedTime.split(":").map(Number);
    const start = setMinutes(setHours(selectedDate, h), m);
    return resolveSequence(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTime, selectedDate, items, allowGap]);

  const handleSubmit = async () => {
    if (!establishment || !selectedDate || !selectedTime || !itemsReady) {
      toast.error("Complete todas as etapas");
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

    const [h, m] = selectedTime.split(":").map(Number);
    const start = setMinutes(setHours(selectedDate, h), m);
    const seq = resolveSequence(start);
    if (!seq) {
      toast.error("Não foi possível encaixar a sequência neste horário");
      return;
    }

    setSubmitting(true);
    try {
      let clientId: string | null = null;
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("establishment_id", establishment.id)
        .eq("cpf", cpfClean)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
        await supabase
          .from("clients")
          .update({
            name: clientName.trim(),
            phone: phoneClean,
            email: clientEmail || null,
          })
          .eq("id", existingClient.id);
      } else {
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
        if (!clientError && newClient) clientId = newClient.id;
      }

      const payload = {
        establishment_id: establishment.id,
        client_id: clientId,
        client_name: clientName.trim(),
        client_phone: phoneClean,
        client_email: clientEmail || null,
        notes: notes || null,
        status: "pending",
        items: seq.map((it, idx) => ({
          service_id: it.serviceId,
          professional_id: it.professionalId,
          position: idx + 1,
          starts_at: it.startsAt.toISOString(),
          duration_minutes: it.duration,
          price: it.price,
        })),
      };

      const { data, error } = await supabase.rpc("create_appointment_with_services", {
        _payload: payload as any,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        toast.error(result?.error || "Erro ao criar agendamento");
        return;
      }
      toast.success("Agendamento realizado com sucesso!");
      setStep(5);
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      toast.error(error?.message || "Erro ao criar agendamento");
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
            <p className="text-muted-foreground mb-4">
              O link pode estar incorreto ou o estabelecimento não está ativo.
            </p>
            <Button onClick={() => navigate("/")}>Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stepsTotal = 4;

  return (
    <>
      <ImpersonationBanner />
      <div
        className="min-h-screen bg-background"
        style={{ paddingTop: isImpersonating ? "2.5rem" : undefined }}
      >
        <EstablishmentNameHeader name={establishment.name} subtitle="Agende seu horário online" />

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

          {/* Step 1: Services + Professionals (multi) */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Escolha os Serviços
                </CardTitle>
                <CardDescription>
                  Adicione um ou mais serviços. Cada serviço pode ter um profissional diferente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((it, idx) => {
                  const elig = eligibleProfsFor(it.serviceId);
                  return (
                    <div key={idx} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Serviço {idx + 1}
                        </span>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(idx)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <SearchableSelect
                        value={it.serviceId}
                        onValueChange={(v) =>
                          updateItem(idx, { serviceId: v, professionalId: "" })
                        }
                        placeholder="Selecione o serviço"
                        searchPlaceholder="Buscar serviço..."
                        emptyText="Nenhum serviço encontrado."
                        options={sortedServices.map((s) => ({
                          value: s.id,
                          label: s.name,
                          hint: `${s.duration_minutes}min • R$ ${Number(s.price).toFixed(2)}`,
                        }))}
                      />
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <SearchableSelect
                            value={it.professionalId === ANY_PRO ? "" : it.professionalId}
                            onValueChange={(v) => updateItem(idx, { professionalId: v })}
                            placeholder="Profissional"
                            searchPlaceholder="Buscar profissional..."
                            options={elig.map((p) => ({ value: p.id, label: p.name }))}
                          />
                        </div>
                        <Button
                          type="button"
                          variant={it.professionalId === ANY_PRO ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateItem(idx, { professionalId: ANY_PRO })}
                          disabled={!it.serviceId}
                          title="Qualquer profissional disponível"
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1" /> Qualquer
                        </Button>
                      </div>
                      {it.serviceId && elig.length === 0 && (
                        <p className="text-xs text-destructive">
                          Nenhum profissional possui este serviço.
                        </p>
                      )}
                    </div>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={addItem}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar outro serviço
                </Button>

                {totalDuration > 0 && (
                  <p className="text-xs text-muted-foreground text-right">
                    Total: {totalDuration}min • R$ {totalPrice.toFixed(2)}
                  </p>
                )}

                <div className="flex justify-end mt-6">
                  <Button onClick={() => setStep(2)} disabled={!itemsReady}>
                    Próximo <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: (consolidated into Step 1) — skipped, go straight to date/time */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Escolha a Data e Horário
                </CardTitle>
                <CardDescription>Selecione quando deseja ser atendido</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-base font-semibold mb-3 block">Data</Label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {generateDates().map((date) => {
                      const isSelected = selectedDate?.toDateString() === date.toDateString();
                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedTime(null);
                          }}
                          className={`p-2 rounded-lg border text-center transition-all ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <p className="text-xs uppercase">{format(date, "EEE", { locale: ptBR })}</p>
                          <p className="text-lg font-bold">{format(date, "dd")}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedDate && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Label className="text-base font-semibold">Horário</Label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowGap}
                          onChange={(e) => {
                            setAllowGap(e.target.checked);
                            setSelectedTime(null);
                          }}
                          className="h-3.5 w-3.5"
                        />
                        Permitir intervalo entre serviços
                      </label>
                    </div>
                    {slotsForDay.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Sem horários disponíveis nesta data.
                        {!allowGap && " Tente ativar “Permitir intervalo”."}
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {slotsForDay.map((time) => {
                          const isSelected = selectedTime === time;
                          return (
                            <button
                              key={time}
                              onClick={() => setSelectedTime(time)}
                              className={cn(
                                "p-2 rounded-lg border text-center transition-all",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border hover:border-primary/40"
                              )}
                            >
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {previewSeq && (
                      <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                        <p className="font-semibold">Sequência:</p>
                        {previewSeq.map((b, i) => {
                          const svc = services.find((s) => s.id === b.serviceId);
                          const prof = professionals.find((p) => p.id === b.professionalId);
                          return (
                            <p key={i}>
                              {format(b.startsAt, "HH:mm")} →{" "}
                              {format(addMinutes(b.startsAt, b.duration), "HH:mm")} · {svc?.name} ·{" "}
                              {prof?.name}
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  <Button onClick={() => setStep(3)} disabled={!selectedDate || !selectedTime}>
                    Próximo <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Client info */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Seus Dados
                </CardTitle>
                <CardDescription>
                  Preencha suas informações para confirmar o agendamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg space-y-2 bg-primary/5 border border-primary/20">
                  <p>
                    <strong>Data:</strong>{" "}
                    {selectedDate &&
                      format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <p>
                    <strong>Início:</strong> {selectedTime}
                  </p>
                  {previewSeq?.map((b, i) => {
                    const svc = services.find((s) => s.id === b.serviceId);
                    const prof = professionals.find((p) => p.id === b.professionalId);
                    return (
                      <p key={i} className="text-sm">
                        {i + 1}. {svc?.name} • {prof?.name} • {format(b.startsAt, "HH:mm")} (
                        {b.duration}min)
                      </p>
                    );
                  })}
                  <p>
                    <strong>Total:</strong>{" "}
                    <span className="font-bold text-accent">R$ {totalPrice.toFixed(2)}</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      value={clientCpf}
                      onChange={(e) => setClientCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Celular *</Label>
                    <Input
                      id="phone"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">E-mail (opcional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Observações (opcional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Alguma observação para o atendimento?"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  <Button onClick={() => setStep(4)} disabled={!clientName.trim() || !clientPhone.trim() || !clientCpf.trim()}>
                    Próximo <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-primary" />
                  Confirmar Agendamento
                </CardTitle>
                <CardDescription>Revise as informações antes de confirmar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/30 border space-y-2 text-sm">
                  <p>
                    <strong>Cliente:</strong> {clientName} • {clientPhone}
                  </p>
                  <p>
                    <strong>Data:</strong>{" "}
                    {selectedDate &&
                      format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  {previewSeq?.map((b, i) => {
                    const svc = services.find((s) => s.id === b.serviceId);
                    const prof = professionals.find((p) => p.id === b.professionalId);
                    return (
                      <p key={i}>
                        {i + 1}. {format(b.startsAt, "HH:mm")} • {svc?.name} • {prof?.name} • R${" "}
                        {b.price.toFixed(2)}
                      </p>
                    );
                  })}
                  <p className="font-bold">Total: R$ {totalPrice.toFixed(2)}</p>
                </div>
                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={() => setStep(3)} disabled={submitting}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Confirmar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Success */}
          {step === 5 && (
            <Card className="border-accent/20">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
                  <Check className="h-10 w-10 text-accent" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Agendamento Confirmado!</h2>
                <p className="text-muted-foreground mb-6">
                  Seu agendamento foi realizado com sucesso. Você receberá uma confirmação em breve.
                </p>
                <div className="bg-muted/50 p-4 rounded-lg text-left space-y-2 mb-6">
                  <p>
                    <strong>Data:</strong>{" "}
                    {selectedDate &&
                      format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  {previewSeq?.map((b, i) => {
                    const svc = services.find((s) => s.id === b.serviceId);
                    const prof = professionals.find((p) => p.id === b.professionalId);
                    return (
                      <p key={i} className="text-sm">
                        {i + 1}. {format(b.startsAt, "HH:mm")} • {svc?.name} • {prof?.name}
                      </p>
                    );
                  })}
                </div>
                <Button onClick={() => navigate("/")}>Voltar ao Início</Button>
              </CardContent>
            </Card>
          )}
        </div>

        {establishment && (
          <EstablishmentAIChat
            establishmentId={establishment.id}
            establishmentName={establishment.name}
          />
        )}
      </div>
    </>
  );
};

export default BookingPage;
