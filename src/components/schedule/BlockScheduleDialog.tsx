import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, setHours, setMinutes, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Loader2, X, Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Professional = Tables<"professionals">;

interface BlockScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  professionals: Professional[];
  onSuccess: () => void;
}

interface BlockRange {
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  allDay: boolean;
}

export function BlockScheduleDialog({
  open,
  onOpenChange,
  establishmentId,
  professionals,
  onSuccess,
}: BlockScheduleDialogProps) {
  const [saving, setSaving] = useState(false);
  const [blockType, setBlockType] = useState<"professional" | "establishment">("professional");
  const [selectedProfessional, setSelectedProfessional] = useState<string>("all");
  const [reason, setReason] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [blockRange, setBlockRange] = useState<BlockRange>({
    startDate: new Date(),
    endDate: new Date(),
    startTime: "08:00",
    endTime: "20:00",
    allDay: true,
  });
  const [mode, setMode] = useState<"calendar" | "range">("calendar");

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    setSelectedDates(prev => {
      const exists = prev.some(d => isSameDay(d, date));
      if (exists) {
        return prev.filter(d => !isSameDay(d, date));
      }
      return [...prev, date];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const datesToBlock = mode === "calendar" 
        ? selectedDates 
        : eachDayOfInterval({ start: blockRange.startDate, end: blockRange.endDate });

      if (datesToBlock.length === 0) {
        toast.error("Selecione pelo menos uma data");
        setSaving(false);
        return;
      }

      if (blockType === "establishment") {
        // Create establishment closures
        const closures = datesToBlock.map(date => ({
          establishment_id: establishmentId,
          start_date: format(date, "yyyy-MM-dd"),
          end_date: format(date, "yyyy-MM-dd"),
          start_time: blockRange.allDay ? null : blockRange.startTime,
          end_time: blockRange.allDay ? null : blockRange.endTime,
          reason: reason || null,
          is_recurring: false,
        }));

        const { error } = await supabase
          .from("establishment_closures")
          .insert(closures);

        if (error) throw error;
        toast.success(`${closures.length} fechamento(s) adicionado(s)`);
      } else {
        // Create professional blocked times
        const professionalsToBlock = selectedProfessional === "all" 
          ? professionals 
          : professionals.filter(p => p.id === selectedProfessional);

        const blocks: {
          professional_id: string;
          start_time: string;
          end_time: string;
          reason: string | null;
        }[] = [];

        for (const date of datesToBlock) {
          for (const prof of professionalsToBlock) {
            const startHour = blockRange.allDay ? 0 : parseInt(blockRange.startTime.split(":")[0]);
            const startMin = blockRange.allDay ? 0 : parseInt(blockRange.startTime.split(":")[1]);
            const endHour = blockRange.allDay ? 23 : parseInt(blockRange.endTime.split(":")[0]);
            const endMin = blockRange.allDay ? 59 : parseInt(blockRange.endTime.split(":")[1]);

            const startDateTime = setMinutes(setHours(date, startHour), startMin);
            const endDateTime = setMinutes(setHours(date, endHour), endMin);

            blocks.push({
              professional_id: prof.id,
              start_time: startDateTime.toISOString(),
              end_time: endDateTime.toISOString(),
              reason: reason || null,
            });
          }
        }

        const { error } = await supabase
          .from("professional_blocked_times")
          .insert(blocks);

        if (error) throw error;
        toast.success(`${blocks.length} bloqueio(s) adicionado(s)`);
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error saving blocks:", error);
      toast.error("Erro ao salvar bloqueios");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedDates([]);
    setReason("");
    setSelectedProfessional("all");
    setBlockRange({
      startDate: new Date(),
      endDate: new Date(),
      startTime: "08:00",
      endTime: "20:00",
      allDay: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bloquear Agenda</DialogTitle>
          <DialogDescription>
            Bloqueie horários para profissionais ou feche o estabelecimento em datas específicas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Block Type */}
          <div className="space-y-2">
            <Label>Tipo de Bloqueio</Label>
            <Select value={blockType} onValueChange={(v) => setBlockType(v as "professional" | "establishment")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Bloquear Profissional</SelectItem>
                <SelectItem value="establishment">Fechar Estabelecimento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Professional Selection (only for professional blocks) */}
          {blockType === "professional" && (
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Profissionais</SelectItem>
                  {professionals.map(prof => (
                    <SelectItem key={prof.id} value={prof.id}>{prof.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Selection Mode */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as "calendar" | "range")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calendar">Selecionar Dias</TabsTrigger>
              <TabsTrigger value="range">Período</TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-4">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={undefined}
                  onSelect={handleDateSelect}
                  locale={ptBR}
                  disabled={(date) => date < new Date()}
                  modifiers={{
                    selected: selectedDates,
                  }}
                  modifiersStyles={{
                    selected: {
                      backgroundColor: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                    },
                  }}
                />
              </div>
              
              {selectedDates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedDates.map(date => (
                    <Badge key={date.toISOString()} variant="secondary" className="flex items-center gap-1">
                      {format(date, "dd/MM", { locale: ptBR })}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setSelectedDates(prev => prev.filter(d => !isSameDay(d, date)))}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="range" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(blockRange.startDate, "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={blockRange.startDate}
                        onSelect={(date) => date && setBlockRange(prev => ({ ...prev, startDate: date }))}
                        locale={ptBR}
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(blockRange.endDate, "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={blockRange.endDate}
                        onSelect={(date) => date && setBlockRange(prev => ({ ...prev, endDate: date }))}
                        locale={ptBR}
                        disabled={(date) => date < blockRange.startDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Time Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={blockRange.allDay}
                onCheckedChange={(checked) => setBlockRange(prev => ({ ...prev, allDay: checked }))}
              />
              <Label>Dia inteiro</Label>
            </div>

            {!blockRange.allDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horário Início</Label>
                  <Input
                    type="time"
                    value={blockRange.startTime}
                    onChange={(e) => setBlockRange(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário Fim</Label>
                  <Input
                    type="time"
                    value={blockRange.endTime}
                    onChange={(e) => setBlockRange(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Feriado, Curso, Férias..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Bloquear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
