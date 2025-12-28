import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, Save, Loader2 } from "lucide-react";
import type { Tables, Json } from "@/integrations/supabase/types";

type Establishment = Tables<"establishments">;

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

export default function PortalSettings() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);

  useEffect(() => {
    if (user && slug) {
      fetchEstablishment();
    }
  }, [user, slug]);

  const fetchEstablishment = async () => {
    try {
      const { data, error } = await supabase
        .from("establishments")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw error;

      setEstablishment(data);
      
      // Parse working hours
      if (data.working_hours) {
        const wh = data.working_hours as unknown;
        if (typeof wh === "object" && wh !== null) {
          setWorkingHours({ ...DEFAULT_WORKING_HOURS, ...(wh as WorkingHours) });
        }
      }
    } catch (error) {
      console.error("Error fetching establishment:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
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

  const handleSaveWorkingHours = async () => {
    if (!establishment) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("establishments")
        .update({ working_hours: workingHours as unknown as Json })
        .eq("id", establishment.id);

      if (error) throw error;
      
      toast.success("Horário de funcionamento atualizado!");
    } catch (error) {
      console.error("Error saving working hours:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Configurações do estabelecimento
          </p>
        </div>

        <Tabs defaultValue="working-hours" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="working-hours" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horário de Funcionamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="working-hours">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Horário de Funcionamento
                </CardTitle>
                <CardDescription>
                  Configure os dias e horários em que seu estabelecimento está aberto para agendamentos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">Abre às</Label>
                          <Input
                            type="time"
                            value={workingHours[key]?.open || "09:00"}
                            onChange={(e) => handleWorkingHoursChange(key, "open", e.target.value)}
                            className="w-28"
                          />
                        </div>
                        <span className="text-muted-foreground">—</span>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">Fecha às</Label>
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
                      <span className="text-sm text-muted-foreground italic">Fechado</span>
                    )}
                  </div>
                ))}

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveWorkingHours} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Horários
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
