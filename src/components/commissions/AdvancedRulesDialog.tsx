import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, Clock, Tag, Users, Sparkles } from "lucide-react";

interface Client {
  id: string;
  name: string;
}

interface AdvancedRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleId: string | null;
  establishmentId: string;
  onSuccess: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

export function AdvancedRulesDialog({
  open,
  onOpenChange,
  ruleId,
  establishmentId,
  onSuccess,
}: AdvancedRulesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    product_brand: "",
    days_of_week: [] as number[],
    time_start: "",
    time_end: "",
    client_ids: [] as string[],
    priority: 0,
  });

  useEffect(() => {
    if (open && ruleId) {
      fetchRuleData();
      fetchClients();
    }
  }, [open, ruleId]);

  const fetchRuleData = async () => {
    if (!ruleId) return;

    const { data, error } = await supabase
      .from("commission_rules")
      .select("product_brand, days_of_week, time_start, time_end, client_ids, priority")
      .eq("id", ruleId)
      .single();

    if (error) {
      console.error("Error fetching rule:", error);
      return;
    }

    setFormData({
      product_brand: data.product_brand || "",
      days_of_week: data.days_of_week || [],
      time_start: data.time_start || "",
      time_end: data.time_end || "",
      client_ids: data.client_ids || [],
      priority: data.priority || 0,
    });
  };

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, name")
      .eq("establishment_id", establishmentId)
      .order("name")
      .limit(100);

    setClients(data || []);
  };

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  };

  const handleClientToggle = (clientId: string) => {
    setFormData(prev => ({
      ...prev,
      client_ids: prev.client_ids.includes(clientId)
        ? prev.client_ids.filter(id => id !== clientId)
        : [...prev.client_ids, clientId],
    }));
  };

  const handleSave = async () => {
    if (!ruleId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("commission_rules")
        .update({
          product_brand: formData.product_brand || null,
          days_of_week: formData.days_of_week.length > 0 ? formData.days_of_week : null,
          time_start: formData.time_start || null,
          time_end: formData.time_end || null,
          client_ids: formData.client_ids.length > 0 ? formData.client_ids : null,
          priority: formData.priority,
        })
        .eq("id", ruleId);

      if (error) throw error;

      toast.success("Regras avançadas salvas!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving rules:", error);
      toast.error("Erro ao salvar regras");
    } finally {
      setLoading(false);
    }
  };

  const hasAnyAdvancedRule = 
    formData.product_brand || 
    formData.days_of_week.length > 0 || 
    formData.time_start || 
    formData.time_end || 
    formData.client_ids.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Regras Avançadas de Comissão
          </DialogTitle>
          <DialogDescription>
            Configure condições específicas para aplicação desta regra
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Priority */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Prioridade
                <Badge variant="outline" className="text-xs">Maior = mais específico</Badge>
              </Label>
              <Input
                type="number"
                min={0}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Regras com maior prioridade são aplicadas primeiro quando há conflito
              </p>
            </div>

            {/* Product Brand */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Marca do Produto
              </Label>
              <Input
                value={formData.product_brand}
                onChange={(e) => setFormData({ ...formData, product_brand: e.target.value })}
                placeholder="Ex: L'Oréal, Kerastase..."
              />
              <p className="text-xs text-muted-foreground">
                Aplica comissão diferenciada quando o produto usado é desta marca
              </p>
            </div>

            {/* Days of Week */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Dias da Semana
              </Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={formData.days_of_week.includes(day.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleDayToggle(day.value)}
                  >
                    {day.label.slice(0, 3)}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Aplica apenas nos dias selecionados (vazio = todos os dias)
              </p>
            </div>

            {/* Time Range */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horário do Serviço
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input
                    type="time"
                    value={formData.time_start}
                    onChange={(e) => setFormData({ ...formData, time_start: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input
                    type="time"
                    value={formData.time_end}
                    onChange={(e) => setFormData({ ...formData, time_end: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Aplica para serviços realizados neste intervalo de horário
              </p>
            </div>

            {/* Specific Clients */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Clientes Específicos
              </Label>
              {formData.client_ids.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {formData.client_ids.map((clientId) => {
                    const client = clients.find(c => c.id === clientId);
                    return client ? (
                      <Badge
                        key={clientId}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => handleClientToggle(clientId)}
                      >
                        {client.name} ×
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <Select
                value=""
                onValueChange={(value) => {
                  if (value && !formData.client_ids.includes(value)) {
                    handleClientToggle(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Adicionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients
                    .filter(c => !formData.client_ids.includes(c.id))
                    .map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Aplica comissão diferenciada para clientes selecionados
              </p>
            </div>

            {/* Summary */}
            {hasAnyAdvancedRule && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <Label className="text-sm font-medium">Resumo das Regras:</Label>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  {formData.product_brand && (
                    <li>• Marca: {formData.product_brand}</li>
                  )}
                  {formData.days_of_week.length > 0 && (
                    <li>
                      • Dias: {formData.days_of_week.map(d => 
                        DAYS_OF_WEEK.find(day => day.value === d)?.label.slice(0, 3)
                      ).join(", ")}
                    </li>
                  )}
                  {(formData.time_start || formData.time_end) && (
                    <li>• Horário: {formData.time_start || "00:00"} - {formData.time_end || "23:59"}</li>
                  )}
                  {formData.client_ids.length > 0 && (
                    <li>• {formData.client_ids.length} cliente(s) específico(s)</li>
                  )}
                  <li>• Prioridade: {formData.priority}</li>
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Regras"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
