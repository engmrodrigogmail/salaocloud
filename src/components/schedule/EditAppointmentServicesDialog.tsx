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
import { Label } from "@/components/ui/label";
import { DatePickerBR } from "@/components/ui/date-picker-br";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Calendar, Loader2, Plus, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  format,
  setHours,
  setMinutes,
  addMinutes,
  parseISO,
  isBefore,
  isAfter,
  getDay,
  addDays,
} from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Service = Tables<"services">;
type Professional = Tables<"professionals">;

const ANY_PRO = "__any__";

interface WHDay { open: string; close: string; enabled: boolean }
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

interface Item {
  serviceId: string;
  professionalId: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointmentId: string | null;
  establishmentId: string;
  services: Service[];
  professionals: Professional[];
  onSaved?: () => void;
}

export function EditAppointmentServicesDialog({
  open,
  onOpenChange,
  appointmentId,
  establishmentId,
  services,
  professionals,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  type SeqMode = "sequential" | "gap" | "parallel";
  const [mode, setMode] = useState<SeqMode>("sequential");
  const [allowOverlap, setAllowOverlap] = useState(true);


  const [estabWH, setEstabWH] = useState<WH>(DEFAULT_WH);
  const [profsWH, setProfsWH] = useState<Record<string, WH>>({});
  const [appointments, setAppointments] = useState<Array<{ id: string; scheduled_at: string; duration_minutes: number; professional_id: string }>>([]);
  const [apptServices, setApptServices] = useState<Array<{ appointment_id: string; professional_id: string; starts_at: string; duration_minutes: number }>>([]);
  const [blocks, setBlocks] = useState<Array<{ professional_id: string; start_time: string; end_time: string }>>([]);
  const [closures, setClosures] = useState<Array<{ start_date: string; end_date: string; start_time: string | null; end_time: string | null }>>([]);
  const [profServices, setProfServices] = useState<Array<{ professional_id: string; service_id: string }>>([]);

  useEffect(() => {
    if (!open || !appointmentId || !establishmentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const profIds = professionals.map((p) => p.id);
        const horizonStart = new Date();
        const horizonEnd = addDays(horizonStart, 60);
        const today = format(new Date(), "yyyy-MM-dd");

        const [apptRes, asRes, estRes, blkRes, clRes, apRes, asAllRes, psRes] = await Promise.all([
          supabase.from("appointments").select("*").eq("id", appointmentId).maybeSingle(),
          supabase.from("appointment_services").select("*").eq("appointment_id", appointmentId).order("position"),
          supabase.from("establishments").select("working_hours").eq("id", establishmentId).maybeSingle(),
          profIds.length
            ? supabase.from("professional_blocked_times").select("professional_id, start_time, end_time").in("professional_id", profIds).gte("end_time", new Date().toISOString())
            : Promise.resolve({ data: [] as any[] }),
          supabase.from("establishment_closures").select("start_date, end_date, start_time, end_time").eq("establishment_id", establishmentId).gte("end_date", today),
          supabase.from("appointments").select("id, scheduled_at, duration_minutes, professional_id, status").eq("establishment_id", establishmentId).gte("scheduled_at", horizonStart.toISOString()).lte("scheduled_at", horizonEnd.toISOString()).neq("status", "cancelled"),
          profIds.length
            ? supabase.from("appointment_services").select("appointment_id, professional_id, starts_at, duration_minutes").in("professional_id", profIds).gte("starts_at", horizonStart.toISOString()).lte("starts_at", horizonEnd.toISOString())
            : Promise.resolve({ data: [] as any[] }),
          profIds.length
            ? supabase.from("professional_services").select("professional_id, service_id").in("professional_id", profIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        if (cancelled) return;

        const appt = apptRes.data as any;
        const svcs = (asRes.data || []) as any[];
        setEstabWH(((estRes.data?.working_hours as unknown) as WH) || DEFAULT_WH);
        const pwh: Record<string, WH> = {};
        for (const p of professionals) {
          if ((p as any).working_hours) pwh[p.id] = (p as any).working_hours as WH;
        }
        setProfsWH(pwh);

        setBlocks((blkRes.data || []) as any);
        setClosures((clRes.data || []) as any);
        // Excluir o próprio agendamento das listas de conflito
        setAppointments(((apRes.data || []) as any[]).filter((a) => a.id !== appointmentId));
        setApptServices(((asAllRes.data || []) as any[]).filter((s) => s.appointment_id !== appointmentId));
        setProfServices((psRes.data || []) as any);

        if (svcs.length > 0) {
          const sorted = [...svcs].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
          setItems(sorted.map((s) => ({ serviceId: s.service_id, professionalId: s.professional_id })));
          const first = sorted[0];
          setDate(format(parseISO(first.starts_at), "yyyy-MM-dd"));
          setTime(format(parseISO(first.starts_at), "HH:mm"));
          // Detecta o modo a partir dos dados
          if (sorted.length >= 2) {
            const allParallel = sorted.every((s) => s.starts_at === first.starts_at);
            if (allParallel) {
              setMode("parallel");
            } else {
              const hasGap = sorted.some((s, i) => {
                if (i === 0) return false;
                const prev = sorted[i - 1];
                const prevEnd = new Date(prev.starts_at).getTime() + prev.duration_minutes * 60000;
                return new Date(s.starts_at).getTime() > prevEnd;
              });
              setMode(hasGap ? "gap" : "sequential");
            }
          } else {
            setMode("sequential");
          }
        } else if (appt) {
          // legacy: 1 serviço
          setItems([{ serviceId: appt.service_id, professionalId: appt.professional_id }]);
          setDate(format(parseISO(appt.scheduled_at), "yyyy-MM-dd"));
          setTime(format(parseISO(appt.scheduled_at), "HH:mm"));
          setMode("sequential");
        }
        setNotes(appt?.notes || "");
      } catch (e) {
        console.error("load edit dialog", e);
        toast.error("Erro ao carregar agendamento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, appointmentId, establishmentId, professionals]);

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

  const totalDuration = useMemo(
    () => items.reduce((acc, it) => acc + (services.find((x) => x.id === it.serviceId)?.duration_minutes || 0), 0),
    [items, services],
  );
  const totalPrice = useMemo(
    () => items.reduce((acc, it) => acc + Number(services.find((x) => x.id === it.serviceId)?.price || 0), 0),
    [items, services],
  );

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
    const t = format(start, "HH:mm");
    const e = format(end, "HH:mm");
    if (t < wh.open || e > wh.close) return false;
    if (isDateClosed(start, t)) return false;
    for (const b of blocks) {
      if (b.professional_id !== profId) continue;
      const bs = parseISO(b.start_time);
      const be = parseISO(b.end_time);
      if (isBefore(start, be) && isAfter(end, bs)) return false;
    }
    if (!allowOverlap) {
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
    }

    return true;
  };

  const fitsSequence = (start: Date): boolean => {
    if (mode === "parallel") {
      for (const it of items) {
        const svc = services.find((s) => s.id === it.serviceId);
        if (!svc) return false;
        const profId = it.professionalId && it.professionalId !== ANY_PRO ? it.professionalId : null;
        if (!profId) return false;
        if (!isBlockFree(start, svc.duration_minutes, profId)) return false;
      }
      return true;
    }
    let cursor = start;
    for (const it of items) {
      const svc = services.find((s) => s.id === it.serviceId);
      if (!svc) return false;
      const profId = it.professionalId && it.professionalId !== ANY_PRO ? it.professionalId : null;
      if (mode === "sequential") {
        if (profId) {
          if (!isBlockFree(cursor, svc.duration_minutes, profId)) return false;
        } else {
          const elig = eligibleProfsFor(it.serviceId);
          if (!elig.find((p) => isBlockFree(cursor, svc.duration_minutes, p.id))) return false;
        }
        cursor = addMinutes(cursor, svc.duration_minutes);
      } else {
        let placed = false;
        for (let probe = cursor; isBefore(probe, addMinutes(start, 12 * 60)); probe = addMinutes(probe, 15)) {
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
    const out: Array<{ serviceId: string; professionalId: string; startsAt: Date; duration: number; price: number }> = [];
    let cursor = start;
    for (const it of items) {
      const svc = services.find((s) => s.id === it.serviceId);
      if (!svc) return null;
      let profId = it.professionalId;
      let placed: Date | null = null;
      if (mode === "parallel") {
        if (profId === ANY_PRO) return null;
        if (!isBlockFree(start, svc.duration_minutes, profId)) return null;
        placed = start;
      } else if (mode === "sequential") {
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
        for (let probe = cursor; isBefore(probe, addMinutes(start, 12 * 60)); probe = addMinutes(probe, 15)) {
          if (profId === ANY_PRO) {
            const elig = eligibleProfsFor(it.serviceId);
            const free = elig.find((p) => isBlockFree(probe, svc.duration_minutes, p.id));
            if (free) { profId = free.id; placed = probe; break; }
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
      if (mode !== "parallel") cursor = addMinutes(placed, svc.duration_minutes);
    }
    return out;
  };

  const itemsReady = items.length > 0 && items.every((it) => it.serviceId && it.professionalId);

  const slotsForDay = useMemo(() => {
    if (!itemsReady || !date || totalDuration === 0) return [] as string[];
    const [yy, mm, dd] = date.split("-").map(Number);
    const day = new Date(yy, mm - 1, dd);
    const wh = getWHForDay(day);
    if (!wh) return [];
    const startH = Number(wh.open.split(":")[0]);
    const startM = Number(wh.open.split(":")[1]);
    const endH = Number(wh.close.split(":")[0]);
    const out: string[] = [];
    for (let hour = startH; hour < endH; hour++) {
      for (const minute of [0, 30]) {
        if (hour === startH && minute < startM) continue;
        const slotDate = setMinutes(setHours(day, hour), minute);
        if (fitsSequence(slotDate)) out.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsReady, date, items, totalDuration, appointments, apptServices, blocks, closures, estabWH, profsWH, mode, allowOverlap]);


  const previewSeq = useMemo(() => {
    if (!time || !date) return null;
    const [yy, mm, dd] = date.split("-").map(Number);
    const [h, m] = time.split(":").map(Number);
    return resolveSequence(setMinutes(setHours(new Date(yy, mm - 1, dd), h), m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, date, items, mode]);

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setTime("");
  };
  const addItem = () => { setItems((prev) => [...prev, { serviceId: "", professionalId: "" }]); setTime(""); };
  const removeItem = (idx: number) => { setItems((prev) => prev.filter((_, i) => i !== idx)); setTime(""); };

  const handleSave = async () => {
    if (!appointmentId) return;
    if (!itemsReady) {
      toast.error("Preencha serviço e profissional em cada bloco");
      return;
    }
    if (!date || !time) {
      toast.error("Escolha data e horário");
      return;
    }
    const [yy, mm, dd] = date.split("-").map(Number);
    const [h, m] = time.split(":").map(Number);
    const start = setMinutes(setHours(new Date(yy, mm - 1, dd), h), m);
    const seq = resolveSequence(start);
    if (!seq) {
      toast.error("Não foi possível encaixar a sequência neste horário");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("update_appointment_services", {
        _appointment_id: appointmentId,
        _payload: {
          notes,
          items: seq.map((it, idx) => ({
            service_id: it.serviceId,
            professional_id: it.professionalId,
            position: idx + 1,
            starts_at: it.startsAt.toISOString(),
            duration_minutes: it.duration,
            price: it.price,
          })),
        } as any,
      });
      if (error) throw error;
      const r = data as { success: boolean; error?: string };
      if (!r?.success) {
        toast.error(r?.error || "Erro ao salvar");
        return;
      }
      toast.success("Agendamento atualizado");
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Editar agendamento
          </DialogTitle>
          <DialogDescription>
            Altere os serviços, profissionais e horários da sequência.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Serviços *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              {items.map((it, idx) => {
                const elig = eligibleProfsFor(it.serviceId);
                return (
                  <div key={idx} className="rounded-md border p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Bloco {idx + 1}</span>
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
                          options={elig.map((p) => ({ value: p.id, label: p.name }))}
                        />
                      </div>
                      <Button
                        type="button"
                        variant={it.professionalId === ANY_PRO ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateItem(idx, { professionalId: ANY_PRO })}
                        disabled={!it.serviceId}
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1" /> Qualquer
                      </Button>
                    </div>
                  </div>
                );
              })}
              {items.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total: {totalDuration}min • R$ {totalPrice.toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Data *</Label>
              <DatePickerBR value={date} onChange={setDate} className="w-full" />
            </div>

            <div className="space-y-2">
              <Label>Horários disponíveis</Label>
              {items.length >= 2 && (
                <div className="rounded-md border bg-muted/20 p-2 space-y-1">
                  <p className="text-xs font-semibold">Como organizar a sequência?</p>
                  <div className="flex flex-col gap-1 text-xs">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="radio" name="seq-mode-edit" checked={mode === "sequential"} onChange={() => { setMode("sequential"); setTime(""); }} className="mt-0.5" />
                      <span><strong>Em sequência</strong> — um após o outro, sem pausa.</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="radio" name="seq-mode-edit" checked={mode === "gap"} onChange={() => { setMode("gap"); setTime(""); }} className="mt-0.5" />
                      <span><strong>Em sequência com pausa</strong> — aceita intervalo entre os blocos.</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="radio" name="seq-mode-edit" checked={mode === "parallel"} onChange={() => { setMode("parallel"); setTime(""); }} className="mt-0.5" />
                      <span><strong>Em paralelo</strong> — todos no mesmo horário, com profissionais diferentes.</span>
                    </label>
                  </div>
                  {mode === "parallel" && (() => {
                    const profIds = items.map((it) => it.professionalId).filter((v) => v && v !== ANY_PRO);
                    const distinct = new Set(profIds).size === items.length && profIds.length === items.length;
                    if (!distinct) {
                      return (
                        <p className="text-xs text-destructive mt-1">
                          No modo paralelo cada bloco precisa ter um profissional específico e diferente dos demais.
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
              {!itemsReady ? (
                <p className="text-xs text-muted-foreground">Preencha os blocos.</p>
              ) : slotsForDay.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem horários disponíveis.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                  {slotsForDay.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTime(s)}
                      className={cn(
                        "text-sm rounded-md border py-1.5",
                        time === s ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
                      )}
                    >
                      {s}
                    </button>
                  ))}
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
                        {format(b.startsAt, "HH:mm")} → {format(addMinutes(b.startsAt, b.duration), "HH:mm")} · {svc?.name} · {prof?.name}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
