import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerBR } from "@/components/ui/date-picker-br";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Calendar, Loader2, Search, UserPlus, Sparkles, ArrowLeft, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, setHours, setMinutes, addMinutes, parseISO, isBefore, isAfter, getDay, addDays, startOfDay } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { NewClientDialog } from "@/components/clients/NewClientDialog";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { cn } from "@/lib/utils";

type Service = Tables<"services">;
type Professional = Tables<"professionals">;
type Client = Pick<Tables<"clients">, "id" | "name" | "phone" | "email"> & {
  source?: "local" | "network";
  origin_establishment?: string;
};

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  services: Service[];
  professionals: Professional[];
  defaultDate?: Date;
  defaultTime?: string;
  defaultProfessionalId?: string;
  onCreated?: () => void;
}

const ANY_PRO = "__any__";

interface WHDay { open: string; close: string; enabled: boolean }
type WH = Record<string, WHDay>;

interface Item {
  serviceId: string;
  professionalId: string; // ANY_PRO permitido apenas na 1ª seleção
}

const DEFAULT_WH: WH = {
  "0": { open: "09:00", close: "18:00", enabled: false },
  "1": { open: "09:00", close: "20:00", enabled: true },
  "2": { open: "09:00", close: "20:00", enabled: true },
  "3": { open: "09:00", close: "20:00", enabled: true },
  "4": { open: "09:00", close: "20:00", enabled: true },
  "5": { open: "09:00", close: "20:00", enabled: true },
  "6": { open: "09:00", close: "18:00", enabled: true },
};

export function NewAppointmentDialog({
  open,
  onOpenChange,
  establishmentId,
  services,
  professionals,
  defaultDate,
  defaultTime,
  defaultProfessionalId,
  onCreated,
}: NewAppointmentDialogProps) {
  const [localResults, setLocalResults] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [items, setItems] = useState<Item[]>([{ serviceId: "", professionalId: "" }]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allowOutsideHours, setAllowOutsideHours] = useState(false);
  type SeqMode = "sequential" | "gap" | "parallel";
  const [mode, setMode] = useState<SeqMode>("sequential");

  const [estabWH, setEstabWH] = useState<WH>(DEFAULT_WH);
  const [profsWH, setProfsWH] = useState<Record<string, WH>>({});
  const [appointments, setAppointments] = useState<Array<{ id: string; scheduled_at: string; duration_minutes: number; professional_id: string; status: string }>>([]);
  const [apptServices, setApptServices] = useState<Array<{ professional_id: string; starts_at: string; duration_minutes: number }>>([]);
  const [blocks, setBlocks] = useState<Array<{ professional_id: string; start_time: string; end_time: string }>>([]);
  const [closures, setClosures] = useState<Array<{ start_date: string; end_date: string; start_time: string | null; end_time: string | null }>>([]);
  const [profServices, setProfServices] = useState<Array<{ professional_id: string; service_id: string }>>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const reset = () => {
    setSearch("");
    setLocalResults([]);
    setHasSearched(false);
    setSelectedClient(null);
    setItems([{ serviceId: "", professionalId: defaultProfessionalId ?? "" }]);
    setDate(defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
    setTime(defaultTime ?? "");
    setNotes("");
    setConfirmOpen(false);
    setMode("sequential");
  };

  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate, defaultTime, defaultProfessionalId]);

  useEffect(() => {
    if (!open || !establishmentId) return;
    let cancelled = false;
    (async () => {
      setLoadingAvail(true);
      try {
        const profIds = professionals.map((p) => p.id);
        const today = format(new Date(), "yyyy-MM-dd");
        const horizonStart = new Date();
        const horizonEnd = addDays(horizonStart, 60);

        const [estRes, blkRes, clRes, apRes, psRes, asRes] = await Promise.all([
          supabase.from("establishments").select("working_hours").eq("id", establishmentId).maybeSingle(),
          profIds.length
            ? supabase
                .from("professional_blocked_times")
                .select("professional_id, start_time, end_time")
                .in("professional_id", profIds)
                .gte("end_time", new Date().toISOString())
            : Promise.resolve({ data: [] as any[] }),
          supabase
            .from("establishment_closures")
            .select("start_date, end_date, start_time, end_time")
            .eq("establishment_id", establishmentId)
            .gte("end_date", today),
          supabase
            .from("appointments")
            .select("id, scheduled_at, duration_minutes, professional_id, status")
            .eq("establishment_id", establishmentId)
            .gte("scheduled_at", horizonStart.toISOString())
            .lte("scheduled_at", horizonEnd.toISOString())
            .neq("status", "cancelled"),
          profIds.length
            ? supabase
                .from("professional_services")
                .select("professional_id, service_id")
                .in("professional_id", profIds)
            : Promise.resolve({ data: [] as any[] }),
          profIds.length
            ? supabase
                .from("appointment_services")
                .select("professional_id, starts_at, duration_minutes")
                .in("professional_id", profIds)
                .gte("starts_at", horizonStart.toISOString())
                .lte("starts_at", horizonEnd.toISOString())
            : Promise.resolve({ data: [] as any[] }),
        ]);

        if (cancelled) return;

        const wh = (estRes.data?.working_hours as unknown as WH) || DEFAULT_WH;
        setEstabWH(wh);

        const pwh: Record<string, WH> = {};
        for (const p of professionals) {
          if ((p as any).working_hours) pwh[p.id] = (p as any).working_hours as WH;
        }
        setProfsWH(pwh);

        setBlocks((blkRes.data || []) as any);
        setClosures((clRes.data || []) as any);
        setAppointments((apRes.data || []) as any);
        setProfServices((psRes.data || []) as any);
        setApptServices((asRes.data || []) as any);
      } catch (e) {
        console.error("availability load error", e);
      } finally {
        if (!cancelled) setLoadingAvail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, establishmentId, professionals]);

  const { getServiceCategory } = useCatalogCategories(establishmentId);

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
    [services],
  );

  const eligibleProfsFor = (serviceId: string) => {
    if (!serviceId) return professionals;
    const ids = new Set(profServices.filter((ps) => ps.service_id === serviceId).map((ps) => ps.professional_id));
    if (ids.size === 0) return professionals;
    return professionals.filter((p) => ids.has(p.id));
  };

  const totalDuration = useMemo(() => {
    return items.reduce((acc, it) => {
      const s = services.find((x) => x.id === it.serviceId);
      return acc + (s?.duration_minutes || 0);
    }, 0);
  }, [items, services]);

  const totalPrice = useMemo(() => {
    return items.reduce((acc, it) => {
      const s = services.find((x) => x.id === it.serviceId);
      return acc + Number(s?.price || 0);
    }, 0);
  }, [items, services]);

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

  // Verifica se um único bloco {profId, start, dur} cabe respeitando todas as regras
  const isBlockFree = (start: Date, dur: number, profId: string, ignoreWH = false) => {
    const end = addMinutes(start, dur);
    if (!ignoreWH) {
      const wh = getWHForDay(start, profId);
      if (!wh) return false;
      const timeStr = format(start, "HH:mm");
      const endStr = format(end, "HH:mm");
      if (timeStr < wh.open || endStr > wh.close) return false;
      if (isDateClosed(start, timeStr)) return false;
    }
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

  // Valida sequência contínua a partir de t1 — todos os blocos encadeados sem gap
  const fitsSequenceContinuous = (start: Date, ignoreWH: boolean) => {
    let cur = start;
    for (const it of items) {
      const svc = services.find((s) => s.id === it.serviceId);
      if (!svc) return false;
      const profId = it.professionalId && it.professionalId !== ANY_PRO ? it.professionalId : null;
      if (!profId) {
        // Auto-resolve: encontra qualquer profissional elegível livre para este bloco
        const elig = eligibleProfsFor(it.serviceId);
        const free = elig.find((p) => isBlockFree(cur, svc.duration_minutes, p.id, ignoreWH));
        if (!free) return false;
      } else {
        if (!isBlockFree(cur, svc.duration_minutes, profId, ignoreWH)) return false;
      }
      cur = addMinutes(cur, svc.duration_minutes);
    }
    return true;
  };

  // Avalia se um horário inicial cabe (contínuo ou com gap, dependendo do flag)
  const fitsSequence = (start: Date, ignoreWH: boolean): boolean => {
    if (!allowGap) return fitsSequenceContinuous(start, ignoreWH);
    // Modo com gap: para cada item, encontra o próximo slot livre >= cursor
    let cursor = start;
    for (const it of items) {
      const svc = services.find((s) => s.id === it.serviceId);
      if (!svc) return false;
      const profId = it.professionalId && it.professionalId !== ANY_PRO ? it.professionalId : null;
      let scheduled = false;
      for (let probe = cursor; isBefore(probe, addMinutes(start, 12 * 60)); probe = addMinutes(probe, 15)) {
        if (profId) {
          if (isBlockFree(probe, svc.duration_minutes, profId, ignoreWH)) {
            cursor = addMinutes(probe, svc.duration_minutes);
            scheduled = true;
            break;
          }
        } else {
          const elig = eligibleProfsFor(it.serviceId);
          const free = elig.find((p) => isBlockFree(probe, svc.duration_minutes, p.id, ignoreWH));
          if (free) {
            cursor = addMinutes(probe, svc.duration_minutes);
            scheduled = true;
            break;
          }
        }
      }
      if (!scheduled) return false;
    }
    return true;
  };

  // Resolve sequência final com horários por bloco (usado no submit e confirmação)
  const resolveSequence = (startStr: string, dateStr: string, ignoreWH: boolean):
    | { items: Array<{ serviceId: string; professionalId: string; startsAt: Date; duration: number; price: number }>; }
    | null => {
    if (!items.every((it) => it.serviceId && it.professionalId)) return null;
    const [yy, mm, dd] = dateStr.split("-").map(Number);
    const [h, m] = startStr.split(":").map(Number);
    const start = setMinutes(setHours(new Date(yy, mm - 1, dd), h), m);
    const out: Array<{ serviceId: string; professionalId: string; startsAt: Date; duration: number; price: number }> = [];

    let cursor = start;
    for (const it of items) {
      const svc = services.find((s) => s.id === it.serviceId);
      if (!svc) return null;
      let profId = it.professionalId;
      let placed: Date | null = null;

      if (!allowGap) {
        // contínuo
        if (profId === ANY_PRO) {
          const elig = eligibleProfsFor(it.serviceId);
          const free = elig.find((p) => isBlockFree(cursor, svc.duration_minutes, p.id, ignoreWH));
          if (!free) return null;
          profId = free.id;
        } else {
          if (!isBlockFree(cursor, svc.duration_minutes, profId, ignoreWH)) return null;
        }
        placed = cursor;
      } else {
        // com gap
        for (let probe = cursor; isBefore(probe, addMinutes(start, 12 * 60)); probe = addMinutes(probe, 15)) {
          if (profId === ANY_PRO) {
            const elig = eligibleProfsFor(it.serviceId);
            const free = elig.find((p) => isBlockFree(probe, svc.duration_minutes, p.id, ignoreWH));
            if (free) { profId = free.id; placed = probe; break; }
          } else {
            if (isBlockFree(probe, svc.duration_minutes, profId, ignoreWH)) { placed = probe; break; }
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
    return { items: out };
  };

  const itemsReady = items.length > 0 && items.every((it) => it.serviceId && it.professionalId);

  const slotsForDay = useMemo(() => {
    if (!itemsReady || !date || totalDuration === 0) return [] as Array<{ time: string; outside?: boolean }>;
    const [yy, mm, dd] = date.split("-").map(Number);
    const day = new Date(yy, mm - 1, dd);
    const now = new Date();
    const out: Array<{ time: string; outside?: boolean }> = [];

    // Usa expediente do salão como envelope
    const wh = getWHForDay(day);
    const startH = allowOutsideHours ? 0 : (wh ? Number(wh.open.split(":")[0]) : 0);
    const startM = allowOutsideHours ? 0 : (wh ? Number(wh.open.split(":")[1]) : 0);
    const endH = allowOutsideHours ? 24 : (wh ? Number(wh.close.split(":")[0]) : 0);

    if (!allowOutsideHours && !wh) return [];

    for (let hour = startH; hour < endH; hour++) {
      for (const minute of [0, 30]) {
        if (hour === startH && minute < startM) continue;
        const slotDate = setMinutes(setHours(day, hour), minute);
        if (isBefore(slotDate, now)) continue;
        const t = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        // Tenta primeiro respeitando WH; se allowOutsideHours, fallback
        const okNormal = fitsSequence(slotDate, false);
        if (okNormal) { out.push({ time: t }); continue; }
        if (allowOutsideHours && fitsSequence(slotDate, true)) {
          out.push({ time: t, outside: true });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsReady, date, items, totalDuration, appointments, apptServices, blocks, closures, estabWH, profsWH, professionals, allowOutsideHours, allowGap]);

  // Reset chosen time if it's no longer valid
  useEffect(() => {
    if (!time) return;
    if (!slotsForDay.find((s) => s.time === time)) setTime("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsForDay]);

  const handleSearch = async () => {
    const q = search.trim();
    if (q.length < 2) {
      toast.error("Digite ao menos 2 caracteres", { position: "top-center", duration: 2000 });
      return;
    }
    setSearching(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-clients-global", {
        body: { establishment_id: establishmentId, query: q },
      });
      if (error) throw error;
      setLocalResults((data?.local || []) as Client[]);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao buscar cliente", { position: "top-center", duration: 2000 });
    } finally {
      setSearching(false);
    }
  };

  const validateBeforeConfirm = () => {
    if (!selectedClient) {
      toast.error("Selecione um cliente", { position: "top-center", duration: 2000 });
      return false;
    }
    if (!itemsReady) {
      toast.error("Preencha serviço e profissional em cada item", { position: "top-center", duration: 2000 });
      return false;
    }
    if (!date || !time) {
      toast.error("Escolha data e horário", { position: "top-center", duration: 2000 });
      return false;
    }
    return true;
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBeforeConfirm()) return;
    setConfirmOpen(true);
  };

  const handleConfirmCreate = async () => {
    if (!selectedClient) return;
    const slot = slotsForDay.find((s) => s.time === time);
    const seq = resolveSequence(time, date, !!slot?.outside);
    if (!seq) {
      toast.error("Não foi possível encaixar a sequência neste horário", { position: "top-center", duration: 2500 });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        establishment_id: establishmentId,
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        client_phone: selectedClient.phone || "",
        client_email: selectedClient.email || null,
        notes: notes || null,
        status: "confirmed",
        items: seq.items.map((it, idx) => ({
          service_id: it.serviceId,
          professional_id: it.professionalId,
          position: idx + 1,
          starts_at: it.startsAt.toISOString(),
          duration_minutes: it.duration,
          price: it.price,
        })),
      };
      const { data, error } = await supabase.rpc("create_appointment_with_services", { _payload: payload as any });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        toast.error(result?.error || "Erro ao criar agendamento", { position: "top-center", duration: 3000 });
        return;
      }
      toast.success("Agendamento criado!", { position: "top-center", duration: 2000 });
      setConfirmOpen(false);
      onOpenChange(false);
      onCreated?.();
    } catch (err: any) {
      console.error("Erro ao criar agendamento", err);
      toast.error(err?.message || "Erro ao criar agendamento", { position: "top-center", duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setTime("");
  };

  const addItem = () => {
    setItems((prev) => [...prev, { serviceId: "", professionalId: "" }]);
    setTime("");
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setTime("");
  };

  const showConfirmView = confirmOpen;
  const previewSeq = useMemo(() => {
    if (!time || !date) return null;
    const slot = slotsForDay.find((s) => s.time === time);
    return resolveSequence(time, date, !!slot?.outside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, date, slotsForDay, items, allowGap]);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {showConfirmView ? "Confirmar agendamento" : "Novo agendamento"}
            </DialogTitle>
            <DialogDescription>
              {showConfirmView
                ? "Revise os blocos e confirme para registrar na agenda."
                : "Adicione um ou mais serviços. Cada serviço pode ser com um profissional diferente."}
            </DialogDescription>
          </DialogHeader>

          {showConfirmView ? (
            <div className="space-y-3 py-2">
              <SummaryRow label="Cliente" value={`${selectedClient?.name} • ${selectedClient?.phone || ""}`} />
              {previewSeq?.items.map((b, i) => {
                const svc = services.find((s) => s.id === b.serviceId);
                const prof = professionals.find((p) => p.id === b.professionalId);
                return (
                  <SummaryRow
                    key={i}
                    label={`${i + 1}. ${svc?.name || "Serviço"}`}
                    value={`${prof?.name || "—"} • ${format(b.startsAt, "HH:mm")} (${b.duration}min) • R$ ${b.price.toFixed(2)}`}
                  />
                );
              })}
              <SummaryRow label="Total" value={`R$ ${totalPrice.toFixed(2)} • ${totalDuration}min`} />
              {notes && <SummaryRow label="Observações" value={notes} />}
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button type="button" onClick={handleConfirmCreate} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleOpenConfirm} className="space-y-4 py-2">
              {/* Cliente */}
              <div className="space-y-2">
                <Label>Cliente *</Label>
                {selectedClient ? (
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{selectedClient.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{selectedClient.phone}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Nome, telefone ou e-mail"
                          className="pl-10"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSearch();
                            }
                          }}
                        />
                      </div>
                      <Button type="button" onClick={handleSearch} disabled={searching}>
                        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>

                    {hasSearched && (
                      <div className="rounded-md border max-h-64 overflow-y-auto">
                        {localResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum cliente encontrado neste salão
                          </p>
                        ) : (
                          <>
                            <div className="px-2 py-1 text-xs font-semibold bg-muted/50">Neste salão</div>
                            {localResults.map((c) => (
                              <button
                                key={`l-${c.id}`}
                                type="button"
                                onClick={() => setSelectedClient(c)}
                                className="w-full text-left p-2 hover:bg-accent border-b last:border-b-0"
                              >
                                <p className="text-sm font-medium">{c.name}</p>
                                <p className="text-xs text-muted-foreground">{c.phone}</p>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setNewClientOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Cadastrar novo cliente (balcão)
                    </Button>
                  </>
                )}
              </div>

              {/* Lista de itens */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Serviços *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar serviço
                  </Button>
                </div>
                {items.map((it, idx) => {
                  const elig = eligibleProfsFor(it.serviceId);
                  return (
                    <div key={idx} className="rounded-md border p-3 space-y-2 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Bloco {idx + 1}
                        </span>
                        {items.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <SearchableSelect
                        value={it.serviceId}
                        onValueChange={(v) => updateItem(idx, { serviceId: v, professionalId: "" })}
                        placeholder="Selecione o serviço"
                        searchPlaceholder="Buscar serviço..."
                        emptyText="Nenhum serviço encontrado."
                        options={sortedServices.map((s) => ({
                          value: s.id,
                          label: s.name,
                          hint: `${s.duration_minutes}min • R$ ${Number(s.price).toFixed(2)}`,
                          group: getServiceCategory((s as any).category_id),
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
                {items.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Total: {totalDuration}min • R$ {totalPrice.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Data */}
              <div className="space-y-2">
                <Label htmlFor="appt-date">Data *</Label>
                <DatePickerBR
                  id="appt-date"
                  value={date}
                  onChange={setDate}
                  min={format(new Date(), "yyyy-MM-dd")}
                  className="w-full"
                />
              </div>

              {/* Horários */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label>Horários disponíveis</Label>
                  <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowGap}
                        onChange={(e) => { setAllowGap(e.target.checked); setTime(""); }}
                        className="h-3.5 w-3.5"
                      />
                      Permitir intervalo entre serviços
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowOutsideHours}
                        onChange={(e) => { setAllowOutsideHours(e.target.checked); setTime(""); }}
                        className="h-3.5 w-3.5"
                      />
                      Permitir fora do expediente
                    </label>
                  </div>
                </div>
                {!itemsReady ? (
                  <p className="text-xs text-muted-foreground">
                    Preencha serviço e profissional em cada bloco para ver os horários.
                  </p>
                ) : loadingAvail ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando agenda...
                  </div>
                ) : slotsForDay.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sem horários disponíveis nesta data. {allowGap ? "" : "Tente ativar \u201CPermitir intervalo\u201D."}
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                      {slotsForDay.map((s) => (
                        <button
                          key={s.time}
                          type="button"
                          onClick={() => setTime(s.time)}
                          title={s.outside ? "Fora do horário de atendimento" : undefined}
                          className={cn(
                            "text-sm rounded-md border py-1.5 transition-colors",
                            time === s.time
                              ? "bg-primary text-primary-foreground border-primary"
                              : s.outside
                                ? "border-dashed border-amber-500/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                : "hover:bg-accent",
                          )}
                        >
                          {s.time}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {previewSeq && (
                  <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                    <p className="font-semibold">Sequência:</p>
                    {previewSeq.items.map((b, i) => {
                      const svc = services.find((s) => s.id === b.serviceId);
                      const prof = professionals.find((p) => p.id === b.professionalId);
                      return (
                        <p key={i}>
                          {format(b.startsAt, "HH:mm")} → {format(addMinutes(b.startsAt, b.duration), "HH:mm")} · {svc?.name} · {prof?.name}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label htmlFor="appt-notes">Observações</Label>
                <Textarea
                  id="appt-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  Criar agendamento
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <NewClientDialog
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        establishmentId={establishmentId}
        onCreated={(c) => {
          if (c) setSelectedClient(c as Client);
        }}
      />
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b pb-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
