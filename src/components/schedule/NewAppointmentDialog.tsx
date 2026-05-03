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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Loader2, Search, UserPlus, Sparkles, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, setHours, setMinutes, addMinutes, parseISO, isBefore, isAfter, getDay, addDays, startOfDay } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { NewClientDialog } from "@/components/clients/NewClientDialog";
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
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // availability data
  const [estabWH, setEstabWH] = useState<WH>(DEFAULT_WH);
  const [profsWH, setProfsWH] = useState<Record<string, WH>>({});
  const [appointments, setAppointments] = useState<Array<{ id: string; scheduled_at: string; duration_minutes: number; professional_id: string; status: string }>>([]);
  const [blocks, setBlocks] = useState<Array<{ professional_id: string; start_time: string; end_time: string }>>([]);
  const [closures, setClosures] = useState<Array<{ start_date: string; end_date: string; start_time: string | null; end_time: string | null }>>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const reset = () => {
    setSearch("");
    setLocalResults([]);
    
    setHasSearched(false);
    setSelectedClient(null);
    setServiceId("");
    setProfessionalId(defaultProfessionalId ?? "");
    setDate(defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
    setTime(defaultTime ?? "");
    setNotes("");
    setConfirmOpen(false);
  };

  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate, defaultTime, defaultProfessionalId]);

  // Load availability data when dialog opens
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

        const [estRes, blkRes, clRes, apRes] = await Promise.all([
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

  const selectedService = useMemo(() => services.find((s) => s.id === serviceId), [serviceId, services]);
  const selectedProfessional = useMemo(
    () => (professionalId && professionalId !== ANY_PRO ? professionals.find((p) => p.id === professionalId) : null),
    [professionalId, professionals],
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

  const isProfFree = (d: Date, time: string, profId: string, dur: number) => {
    const wh = getWHForDay(d, profId);
    if (!wh) return false;
    const [h, m] = time.split(":").map(Number);
    const start = setMinutes(setHours(d, h), m);
    const end = addMinutes(start, dur);
    const endStr = format(end, "HH:mm");
    if (time < wh.open || endStr > wh.close) return false;
    if (isDateClosed(d, time)) return false;
    // blocks
    for (const b of blocks) {
      if (b.professional_id !== profId) continue;
      const bs = parseISO(b.start_time);
      const be = parseISO(b.end_time);
      if (isBefore(start, be) && isAfter(end, bs)) return false;
    }
    // appointments
    for (const a of appointments) {
      if (a.professional_id !== profId) continue;
      const as = parseISO(a.scheduled_at);
      const ae = addMinutes(as, a.duration_minutes);
      if (isBefore(start, ae) && isAfter(end, as)) return false;
    }
    return true;
  };

  const slotsForDay = useMemo(() => {
    if (!serviceId || !date || !selectedService) return [] as Array<{ time: string; profId: string | null }>;
    const [yy, mm, dd] = date.split("-").map(Number);
    const day = new Date(yy, mm - 1, dd);
    const wh = getWHForDay(day, professionalId && professionalId !== ANY_PRO ? professionalId : undefined);
    if (!wh) return [];
    const dur = selectedService.duration_minutes;
    const [oh, om] = wh.open.split(":").map(Number);
    const [ch] = wh.close.split(":").map(Number);
    const now = new Date();
    const out: Array<{ time: string; profId: string | null }> = [];
    for (let hour = oh; hour < ch; hour++) {
      for (const minute of [0, 30]) {
        if (hour === oh && minute < om) continue;
        const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const slotDate = setMinutes(setHours(day, hour), minute);
        if (isBefore(slotDate, now)) continue;
        const endStr = format(addMinutes(slotDate, dur), "HH:mm");
        if (endStr > wh.close) continue;

        if (professionalId && professionalId !== ANY_PRO) {
          if (isProfFree(day, time, professionalId, dur)) out.push({ time, profId: professionalId });
        } else {
          // any professional
          const free = professionals.find((p) => isProfFree(day, time, p.id, dur));
          if (free) out.push({ time, profId: free.id });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, date, professionalId, selectedService, appointments, blocks, closures, estabWH, profsWH, professionals]);

  // Auto-pick first available when "any" is chosen
  useEffect(() => {
    if (professionalId !== ANY_PRO || !serviceId || !selectedService) return;
    if (loadingAvail) return;
    // Try today's slots first; if none, search forward up to 30 days
    if (slotsForDay.length > 0) {
      const first = slotsForDay[0];
      setTime(first.time);
      return;
    }
    const [yy, mm, dd] = date.split("-").map(Number);
    let probe = new Date(yy, mm - 1, dd);
    const now = new Date();
    for (let i = 1; i <= 30; i++) {
      probe = addDays(startOfDay(probe), 1);
      const wh = getWHForDay(probe);
      if (!wh) continue;
      const [oh, om] = wh.open.split(":").map(Number);
      const [ch] = wh.close.split(":").map(Number);
      for (let hour = oh; hour < ch; hour++) {
        for (const minute of [0, 30]) {
          if (hour === oh && minute < om) continue;
          const t = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
          const sd = setMinutes(setHours(probe, hour), minute);
          if (isBefore(sd, now)) continue;
          const endStr = format(addMinutes(sd, selectedService.duration_minutes), "HH:mm");
          if (endStr > wh.close) continue;
          const free = professionals.find((p) => isProfFree(probe, t, p.id, selectedService.duration_minutes));
          if (free) {
            setDate(format(probe, "yyyy-MM-dd"));
            setTime(t);
            setProfessionalId(free.id);
            toast.success(`Próximo horário: ${format(probe, "dd/MM")} às ${t} com ${free.name}`, {
              position: "top-center",
              duration: 2500,
            });
            return;
          }
        }
      }
    }
    toast.error("Nenhum horário disponível nos próximos 30 dias", { position: "top-center", duration: 2500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId, serviceId, loadingAvail]);

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
      setNetworkResults((data?.network || []) as Client[]);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao buscar cliente", { position: "top-center", duration: 2000 });
    } finally {
      setSearching(false);
    }
  };

  const pickNetworkClient = async (c: any) => {
    try {
      const { data: existing } = await supabase
        .from("clients")
        .select("id, name, phone, email")
        .eq("establishment_id", establishmentId)
        .or(`email.eq.${(c.email || "").toLowerCase()},phone.eq.${c.phone}`)
        .maybeSingle();
      if (existing) {
        setSelectedClient(existing as Client);
        return;
      }
      const { data: created, error } = await supabase
        .from("clients")
        .insert({
          establishment_id: establishmentId,
          name: c.name,
          phone: c.phone,
          email: c.email,
          global_identity_email: (c.email || "").toLowerCase() || null,
        })
        .select("id, name, phone, email")
        .single();
      if (error) throw error;
      toast.success("Cliente vinculado ao salão", { position: "top-center", duration: 2000 });
      setSelectedClient(created as Client);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao vincular cliente", { position: "top-center", duration: 2500 });
    }
  };

  const validateBeforeConfirm = () => {
    if (!selectedClient) {
      toast.error("Selecione um cliente", { position: "top-center", duration: 2000 });
      return false;
    }
    if (!serviceId) {
      toast.error("Selecione um serviço", { position: "top-center", duration: 2000 });
      return false;
    }
    if (!professionalId) {
      toast.error("Selecione um profissional", { position: "top-center", duration: 2000 });
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
    // If "any" is still set somehow, resolve to a real prof
    if (professionalId === ANY_PRO) {
      const slot = slotsForDay.find((s) => s.time === time);
      if (slot?.profId) setProfessionalId(slot.profId);
      else {
        toast.error("Sem profissional disponível", { position: "top-center", duration: 2000 });
        return;
      }
    }
    setConfirmOpen(true);
  };

  const handleConfirmCreate = async () => {
    if (!selectedClient || !selectedService) return;
    setSaving(true);
    try {
      const [h, m] = time.split(":").map(Number);
      const [yy, mm, dd] = date.split("-").map(Number);
      const scheduledAt = setMinutes(setHours(new Date(yy, mm - 1, dd), h), m);

      const { error } = await supabase.from("appointments").insert({
        establishment_id: establishmentId,
        service_id: serviceId,
        professional_id: professionalId,
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        client_phone: selectedClient.phone,
        client_email: selectedClient.email || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: selectedService.duration_minutes,
        price: selectedService.price,
        notes: notes || null,
        status: "confirmed",
      });
      if (error) throw error;

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

  const showConfirmView = confirmOpen;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {showConfirmView ? "Confirmar agendamento" : "Novo agendamento"}
            </DialogTitle>
            <DialogDescription>
              {showConfirmView
                ? "Revise os detalhes e confirme para registrar na agenda."
                : "Lance manualmente um agendamento (modo balcão / recepção)."}
            </DialogDescription>
          </DialogHeader>

          {showConfirmView ? (
            <div className="space-y-3 py-2">
              <SummaryRow label="Cliente" value={`${selectedClient?.name} • ${selectedClient?.phone}`} />
              <SummaryRow label="Profissional" value={selectedProfessional?.name || "—"} />
              <SummaryRow
                label="Serviço"
                value={`${selectedService?.name} — ${selectedService?.duration_minutes}min`}
              />
              <SummaryRow
                label="Data e hora"
                value={`${format(parseISO(date), "dd/MM/yyyy")} às ${time}`}
              />
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
                        {localResults.length === 0 && networkResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente encontrado</p>
                        ) : (
                          <>
                            {localResults.length > 0 && (
                              <div className="px-2 py-1 text-xs font-semibold bg-muted/50">Neste salão</div>
                            )}
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
                            {networkResults.length > 0 && (
                              <div className="px-2 py-1 text-xs font-semibold bg-muted/50 flex items-center gap-1">
                                <Globe className="h-3 w-3" /> Rede Salão Cloud
                              </div>
                            )}
                            {networkResults.map((c: any) => (
                              <button
                                key={`n-${c.id}`}
                                type="button"
                                onClick={() => pickNetworkClient(c)}
                                className="w-full text-left p-2 hover:bg-accent border-b last:border-b-0"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{c.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {c.phone}
                                      {c.establishments?.name ? ` • ${c.establishments.name}` : ""}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="shrink-0 text-[10px]">
                                    Importar
                                  </Badge>
                                </div>
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

              {/* Serviço */}
              <div className="space-y-2">
                <Label>Serviço *</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.duration_minutes}min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Profissional + Qualquer um */}
              <div className="space-y-2">
                <Label>Profissional *</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select value={professionalId} onValueChange={setProfessionalId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {professionals.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant={professionalId === ANY_PRO ? "default" : "outline"}
                    onClick={() => setProfessionalId(ANY_PRO)}
                    disabled={!serviceId}
                    className="whitespace-nowrap"
                    title={!serviceId ? "Escolha um serviço primeiro" : "Primeiro horário disponível"}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    Qualquer um
                  </Button>
                </div>
              </div>

              {/* Data */}
              <div className="space-y-2">
                <Label htmlFor="appt-date">Data *</Label>
                <Input
                  id="appt-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                  required
                />
              </div>

              {/* Horários disponíveis (calendário dinâmico) */}
              <div className="space-y-2">
                <Label>Horários disponíveis</Label>
                {!serviceId || !professionalId ? (
                  <p className="text-xs text-muted-foreground">
                    Escolha o serviço e o profissional para ver os horários.
                  </p>
                ) : loadingAvail ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando agenda...
                  </div>
                ) : slotsForDay.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sem horários nesta data. Tente outro dia ou use “Qualquer um”.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                    {slotsForDay.map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        onClick={() => {
                          setTime(s.time);
                          if (professionalId === ANY_PRO && s.profId) setProfessionalId(s.profId);
                        }}
                        className={cn(
                          "text-sm rounded-md border py-1.5 transition-colors",
                          time === s.time
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-accent",
                        )}
                      >
                        {s.time}
                      </button>
                    ))}
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
