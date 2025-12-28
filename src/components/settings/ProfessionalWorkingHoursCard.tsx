import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Users, Save, Loader2, Clock, RotateCcw } from "lucide-react";
import type { Tables, Json } from "@/integrations/supabase/types";

type Professional = Tables<"professionals">;

interface WorkingHoursDay {
  open: string;
  close: string;
  enabled: boolean;
}

interface WorkingHours {
  [key: string]: WorkingHoursDay;
}

const DEFAULT_WORKING_HOURS: WorkingHours = {
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

interface ProfessionalWorkingHoursCardProps {
  establishmentId: string;
}

export function ProfessionalWorkingHoursCard({ establishmentId }: ProfessionalWorkingHoursCardProps) {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("");
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfessionals();
  }, [establishmentId]);

  const fetchProfessionals = async () => {
    try {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("establishment_id", establishmentId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setProfessionals(data || []);
      
      if (data && data.length > 0) {
        setSelectedProfessionalId(data[0].id);
        loadProfessionalHours(data[0]);
      }
    } catch (error) {
      console.error("Error fetching professionals:", error);
      toast.error("Erro ao carregar profissionais");
    } finally {
      setLoading(false);
    }
  };

  const loadProfessionalHours = (professional: Professional) => {
    if (professional.working_hours) {
      const wh = professional.working_hours as unknown;
      if (typeof wh === "object" && wh !== null) {
        setWorkingHours({ ...DEFAULT_WORKING_HOURS, ...(wh as WorkingHours) });
        return;
      }
    }
    setWorkingHours(DEFAULT_WORKING_HOURS);
  };

  const handleProfessionalChange = (professionalId: string) => {
    setSelectedProfessionalId(professionalId);
    const professional = professionals.find(p => p.id === professionalId);
    if (professional) {
      loadProfessionalHours(professional);
    }
  };

  const handleWorkingHoursChange = (day: string, field: keyof WorkingHoursDay, value: string | boolean) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleResetToEstablishment = async () => {
    try {
      const { data, error } = await supabase
        .from("establishments")
        .select("working_hours")
        .eq("id", establishmentId)
        .single();

      if (error) throw error;

      if (data?.working_hours) {
        const wh = data.working_hours as unknown;
        if (typeof wh === "object" && wh !== null) {
          setWorkingHours(wh as WorkingHours);
          toast.success("Horários redefinidos para o padrão do estabelecimento");
          return;
        }
      }
      setWorkingHours(DEFAULT_WORKING_HOURS);
      toast.success("Horários redefinidos para o padrão");
    } catch (error) {
      console.error("Error resetting hours:", error);
      toast.error("Erro ao redefinir horários");
    }
  };

  const handleSave = async () => {
    if (!selectedProfessionalId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("professionals")
        .update({ working_hours: workingHours as unknown as Json })
        .eq("id", selectedProfessionalId);

      if (error) throw error;
      
      // Update local state
      setProfessionals(prev => 
        prev.map(p => 
          p.id === selectedProfessionalId 
            ? { ...p, working_hours: workingHours as unknown as Json }
            : p
        )
      );
      
      toast.success("Jornada do profissional atualizada!");
    } catch (error) {
      console.error("Error saving working hours:", error);
      toast.error("Erro ao salvar jornada");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (professionals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Jornada dos Profissionais
          </CardTitle>
          <CardDescription>
            Nenhum profissional cadastrado. Cadastre profissionais para configurar suas jornadas.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Jornada dos Profissionais
        </CardTitle>
        <CardDescription>
          Configure os dias e horários de trabalho de cada profissional. A agenda só exibirá horários disponíveis dentro da jornada configurada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 w-full sm:w-auto">
            <Label className="mb-2 block">Selecione o profissional</Label>
            <Select value={selectedProfessionalId} onValueChange={handleProfessionalChange}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={handleResetToEstablishment} className="mt-auto">
            <RotateCcw className="h-4 w-4 mr-2" />
            Usar horário do estabelecimento
          </Button>
        </div>

        <div className="space-y-3">
          {Object.entries(DAY_NAMES).map(([key, name]) => (
            <div 
              key={key} 
              className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border transition-colors ${
                workingHours[key]?.enabled 
                  ? "bg-primary/5 border-primary/20" 
                  : "bg-muted/50 border-border"
              }`}
            >
              <div className="flex items-center gap-3 min-w-[180px]">
                <Switch
                  checked={workingHours[key]?.enabled || false}
                  onCheckedChange={(checked) => handleWorkingHoursChange(key, "enabled", checked)}
                />
                <Label className={`font-medium ${!workingHours[key]?.enabled ? "text-muted-foreground" : ""}`}>
                  {name}
                </Label>
              </div>
              
              {workingHours[key]?.enabled && (
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={workingHours[key]?.open || "09:00"}
                      onChange={(e) => handleWorkingHoursChange(key, "open", e.target.value)}
                      className="w-28"
                    />
                  </div>
                  <span className="text-muted-foreground">até</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={workingHours[key]?.close || "20:00"}
                      onChange={(e) => handleWorkingHoursChange(key, "close", e.target.value)}
                      className="w-28"
                    />
                  </div>
                </div>
              )}
              
              {!workingHours[key]?.enabled && (
                <span className="text-sm text-muted-foreground italic">Folga</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving || !selectedProfessionalId}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Jornada
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
