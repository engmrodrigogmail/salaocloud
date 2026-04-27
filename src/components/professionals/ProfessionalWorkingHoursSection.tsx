import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Clock, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WorkingHoursDay {
  open: string;
  close: string;
  enabled: boolean;
}

export interface WorkingHours {
  [key: string]: WorkingHoursDay;
}

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  "0": { open: "09:00", close: "18:00", enabled: false },
  "1": { open: "09:00", close: "20:00", enabled: true },
  "2": { open: "09:00", close: "20:00", enabled: true },
  "3": { open: "09:00", close: "20:00", enabled: true },
  "4": { open: "09:00", close: "20:00", enabled: true },
  "5": { open: "09:00", close: "20:00", enabled: true },
  "6": { open: "09:00", close: "18:00", enabled: true },
};

const DAY_NAMES: Record<string, string> = {
  "0": "Domingo",
  "1": "Segunda-feira",
  "2": "Terça-feira",
  "3": "Quarta-feira",
  "4": "Quinta-feira",
  "5": "Sexta-feira",
  "6": "Sábado",
};

interface Props {
  establishmentId: string;
  workingHours: WorkingHours;
  onChange: (wh: WorkingHours) => void;
}

export function ProfessionalWorkingHoursSection({ establishmentId, workingHours, onChange }: Props) {
  const handleChange = (day: string, field: keyof WorkingHoursDay, value: string | boolean) => {
    onChange({
      ...workingHours,
      [day]: { ...workingHours[day], [field]: value },
    });
  };

  const handleResetToEstablishment = async () => {
    try {
      const { data, error } = await supabase
        .from("establishments")
        .select("working_hours")
        .eq("id", establishmentId)
        .single();
      if (error) throw error;
      if (data?.working_hours && typeof data.working_hours === "object") {
        onChange({ ...DEFAULT_WORKING_HOURS, ...(data.working_hours as unknown as WorkingHours) });
        toast.success("Horários redefinidos para o padrão do estabelecimento");
        return;
      }
      onChange(DEFAULT_WORKING_HOURS);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao redefinir horários");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <Label className="text-base font-semibold">Jornada de Trabalho</Label>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleResetToEstablishment}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Usar horário do estabelecimento
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure os dias e horários em que este profissional atende. A agenda só permitirá agendamentos dentro destes horários.
      </p>

      <div className="space-y-2">
        {Object.entries(DAY_NAMES).map(([key, name]) => (
          <div
            key={key}
            className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-colors ${
              workingHours[key]?.enabled ? "bg-primary/5 border-primary/20" : "bg-muted/40 border-border"
            }`}
          >
            <div className="flex items-center gap-3 sm:min-w-[170px]">
              <Switch
                checked={workingHours[key]?.enabled || false}
                onCheckedChange={(checked) => handleChange(key, "enabled", checked)}
              />
              <Label className={`font-medium ${!workingHours[key]?.enabled ? "text-muted-foreground" : ""}`}>
                {name}
              </Label>
            </div>
            {workingHours[key]?.enabled ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  value={workingHours[key]?.open || "09:00"}
                  onChange={(e) => handleChange(key, "open", e.target.value)}
                  className="w-28"
                />
                <span className="text-muted-foreground text-sm">até</span>
                <Input
                  type="time"
                  value={workingHours[key]?.close || "20:00"}
                  onChange={(e) => handleChange(key, "close", e.target.value)}
                  className="w-28"
                />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground italic">Folga</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
