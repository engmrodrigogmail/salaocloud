import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarOff, Plus, Trash2, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format, setHours, setMinutes, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BlockedTime {
  id: string;
  professional_id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

interface Props {
  professionalId: string | null;
}

export function ProfessionalBlockedTimesSection({ professionalId }: Props) {
  const [blocks, setBlocks] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("20:00");
  const [reason, setReason] = useState("");

  const fetch = useCallback(async () => {
    if (!professionalId) {
      setBlocks([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("professional_blocked_times")
      .select("*")
      .eq("professional_id", professionalId)
      .gte("end_time", new Date().toISOString())
      .order("start_time");
    if (error) {
      console.error(error);
    } else {
      setBlocks(data || []);
    }
    setLoading(false);
  }, [professionalId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const toggleDate = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDates((prev) =>
      prev.some((d) => isSameDay(d, date))
        ? prev.filter((d) => !isSameDay(d, date))
        : [...prev, date]
    );
  };

  const handleAdd = async () => {
    if (!professionalId) {
      toast.error("Salve o profissional antes de adicionar bloqueios");
      return;
    }
    if (selectedDates.length === 0) {
      toast.error("Selecione pelo menos uma data");
      return;
    }
    setSaving(true);
    try {
      const inserts = selectedDates.map((date) => {
        const [sh, sm] = (allDay ? "00:00" : startTime).split(":").map(Number);
        const [eh, em] = (allDay ? "23:59" : endTime).split(":").map(Number);
        return {
          professional_id: professionalId,
          start_time: setMinutes(setHours(date, sh), sm).toISOString(),
          end_time: setMinutes(setHours(date, eh), em).toISOString(),
          reason: reason.trim() || null,
        };
      });
      const { error } = await supabase.from("professional_blocked_times").insert(inserts);
      if (error) throw error;
      toast.success(`${inserts.length} indisponibilidade(s) adicionada(s)`);
      setSelectedDates([]);
      setReason("");
      setAllDay(true);
      setStartTime("08:00");
      setEndTime("20:00");
      await fetch();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao adicionar indisponibilidade");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("professional_blocked_times").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Indisponibilidade removida");
    await fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarOff className="h-5 w-5 text-muted-foreground" />
        <Label className="text-base font-semibold">Indisponibilidades / Bloqueios</Label>
      </div>
      <p className="text-sm text-muted-foreground">
        Bloqueie períodos em que este profissional não estará disponível (férias, folgas extras, compromissos). Você pode escolher dias não sequenciais.
      </p>

      {!professionalId ? (
        <div className="text-sm text-muted-foreground italic p-3 border rounded-lg bg-muted/30">
          Salve o profissional primeiro para gerenciar indisponibilidades.
        </div>
      ) : (
        <>
          {/* Form */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label className="text-sm">Datas indisponíveis</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDates.length === 0
                      ? "Selecione uma ou mais datas"
                      : `${selectedDates.length} data(s) selecionada(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={undefined}
                    onSelect={toggleDate}
                    locale={ptBR}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    modifiers={{ selected: selectedDates }}
                    modifiersStyles={{
                      selected: {
                        backgroundColor: "hsl(var(--primary))",
                        color: "hsl(var(--primary-foreground))",
                      },
                    }}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {selectedDates.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {selectedDates
                    .slice()
                    .sort((a, b) => a.getTime() - b.getTime())
                    .map((d) => (
                      <Badge key={d.toISOString()} variant="secondary" className="text-xs">
                        {format(d, "dd/MM/yyyy", { locale: ptBR })}
                      </Badge>
                    ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={allDay} onCheckedChange={setAllDay} />
              <Label className="text-sm">Dia inteiro</Label>
            </div>

            {!allDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Motivo (opcional)</Label>
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Férias, curso, atestado..."
              />
            </div>

            <Button type="button" onClick={handleAdd} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar indisponibilidade
            </Button>
          </div>

          {/* List */}
          <div className="space-y-2">
            <Label className="text-sm">Indisponibilidades agendadas</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : blocks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma indisponibilidade futura.</p>
            ) : (
              <div className="space-y-2">
                {blocks.map((b) => {
                  const start = parseISO(b.start_time);
                  const end = parseISO(b.end_time);
                  const sameDay = isSameDay(start, end);
                  const isAllDay =
                    start.getHours() === 0 &&
                    start.getMinutes() === 0 &&
                    end.getHours() === 23 &&
                    end.getMinutes() === 59;

                  return (
                    <div
                      key={b.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-background"
                    >
                      <div className="flex-1 text-sm">
                        <div className="font-medium">
                          {sameDay
                            ? format(start, "EEEE, dd/MM/yyyy", { locale: ptBR })
                            : `${format(start, "dd/MM/yyyy", { locale: ptBR })} → ${format(end, "dd/MM/yyyy", { locale: ptBR })}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isAllDay
                            ? "Dia inteiro"
                            : `${format(start, "HH:mm")} às ${format(end, "HH:mm")}`}
                        </div>
                        {b.reason && (
                          <div className="text-xs text-muted-foreground mt-0.5 italic">{b.reason}</div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(b.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
