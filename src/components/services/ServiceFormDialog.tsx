import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { Users, DollarSign } from "lucide-react";

interface Professional {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

interface ProfessionalCommission {
  professional_id: string;
  commission_type: "fixed" | "percentage";
  commission_value: number;
  is_leasing: boolean;
  leasing_type: "fixed_monthly" | "proportional_time" | "proportional_space" | "per_service" | null;
  leasing_value: number;
}

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  editingService: Service | null;
  onSuccess: () => void;
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  establishmentId,
  editingService,
  onSuccess,
}: ServiceFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessionals, setSelectedProfessionals] = useState<Set<string>>(new Set());
  const [professionalCommissions, setProfessionalCommissions] = useState<Record<string, ProfessionalCommission>>({});

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_minutes: 30,
    price: 0,
    is_active: true,
  });

  useEffect(() => {
    if (open) {
      fetchProfessionals();
      if (editingService) {
        loadServiceData();
      } else {
        resetForm();
      }
    }
  }, [open, editingService]);

  const fetchProfessionals = async () => {
    const { data, error } = await supabase
      .from("professionals")
      .select("id, name")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setProfessionals(data);
    }
  };

  const loadServiceData = async () => {
    if (!editingService) return;

    setFormData({
      name: editingService.name,
      description: editingService.description || "",
      duration_minutes: editingService.duration_minutes,
      price: editingService.price,
      is_active: editingService.is_active,
    });

    // Fetch existing professional_services
    const { data: psData } = await supabase
      .from("professional_services")
      .select("*")
      .eq("service_id", editingService.id);

    if (psData) {
      const selected = new Set<string>();
      const commissions: Record<string, ProfessionalCommission> = {};

      psData.forEach((ps: any) => {
        selected.add(ps.professional_id);
        commissions[ps.professional_id] = {
          professional_id: ps.professional_id,
          commission_type: ps.commission_type || "percentage",
          commission_value: ps.commission_value || 0,
          is_leasing: ps.is_leasing || false,
          leasing_type: ps.leasing_type || null,
          leasing_value: ps.leasing_value || 0,
        };
      });

      setSelectedProfessionals(selected);
      setProfessionalCommissions(commissions);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      duration_minutes: 30,
      price: 0,
      is_active: true,
    });
    setSelectedProfessionals(new Set());
    setProfessionalCommissions({});
  };

  const toggleProfessional = (professionalId: string) => {
    setSelectedProfessionals(prev => {
      const next = new Set(prev);
      if (next.has(professionalId)) {
        next.delete(professionalId);
        setProfessionalCommissions(c => {
          const { [professionalId]: _, ...rest } = c;
          return rest;
        });
      } else {
        next.add(professionalId);
        setProfessionalCommissions(c => ({
          ...c,
          [professionalId]: {
            professional_id: professionalId,
            commission_type: "percentage",
            commission_value: 0,
            is_leasing: false,
            leasing_type: null,
            leasing_value: 0,
          },
        }));
      }
      return next;
    });
  };

  const updateProfessionalCommission = (professionalId: string, field: keyof ProfessionalCommission, value: any) => {
    setProfessionalCommissions(prev => ({
      ...prev,
      [professionalId]: {
        ...prev[professionalId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setLoading(true);

    try {
      let serviceId = editingService?.id;

      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update({
            name: formData.name,
            description: formData.description || null,
            duration_minutes: formData.duration_minutes,
            price: formData.price,
            is_active: formData.is_active,
          })
          .eq("id", editingService.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("services")
          .insert({
            establishment_id: establishmentId,
            name: formData.name,
            description: formData.description || null,
            duration_minutes: formData.duration_minutes,
            price: formData.price,
            is_active: formData.is_active,
          })
          .select()
          .single();

        if (error) throw error;
        serviceId = data.id;
      }

      // Update professional_services
      if (serviceId) {
        // Delete existing links for this service
        await supabase
          .from("professional_services")
          .delete()
          .eq("service_id", serviceId);

        // Insert new links
        const linksToInsert = Array.from(selectedProfessionals).map(professionalId => {
          const commission = professionalCommissions[professionalId];
          return {
            professional_id: professionalId,
            service_id: serviceId,
            commission_type: commission?.commission_type || "percentage",
            commission_value: commission?.commission_value || 0,
            is_leasing: commission?.is_leasing || false,
            leasing_type: commission?.is_leasing ? commission?.leasing_type : null,
            leasing_value: commission?.is_leasing ? commission?.leasing_value : 0,
          };
        });

        if (linksToInsert.length > 0) {
          const { error: linkError } = await supabase
            .from("professional_services")
            .insert(linksToInsert);

          if (linkError) throw linkError;
        }
      }

      toast.success(editingService ? "Serviço atualizado!" : "Serviço criado!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar serviço");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {editingService ? "Editar Serviço" : "Novo Serviço"}
          </DialogTitle>
          <DialogDescription>
            {editingService
              ? "Atualize as informações do serviço e profissionais vinculados"
              : "Adicione um novo serviço e configure os profissionais"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="Ex: Corte feminino"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  placeholder="Descrição do serviço"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duração (min) *</Label>
                  <Input
                    type="number"
                    min={5}
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 30 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço (R$) *</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Serviço ativo</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>

            <Separator />

            {/* Professionals & Commissions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-semibold">Profissionais e Comissões</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Selecione os profissionais que realizam este serviço e configure as regras de comissão ou arrendamento.
              </p>

              {professionals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum profissional cadastrado
                </p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {professionals.map((professional) => {
                    const isSelected = selectedProfessionals.has(professional.id);
                    const commission = professionalCommissions[professional.id];

                    return (
                      <AccordionItem key={professional.id} value={professional.id} className="border rounded-lg mb-2">
                        <div className="flex items-center px-4 py-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleProfessional(professional.id)}
                            className="mr-3"
                          />
                          <AccordionTrigger className="flex-1 hover:no-underline py-2">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="font-medium">{professional.name}</span>
                              {isSelected && commission?.is_leasing && (
                                <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                                  Arrendamento
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                        </div>

                        <AccordionContent className="px-4 pb-4">
                          {isSelected ? (
                            <div className="space-y-4 pt-2">
                              {/* Leasing Toggle */}
                              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <Label className="font-medium">Arrendamento</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Profissional paga ao salão para usar o espaço
                                  </p>
                                </div>
                                <Switch
                                  checked={commission?.is_leasing || false}
                                  onCheckedChange={(checked) => updateProfessionalCommission(professional.id, "is_leasing", checked)}
                                />
                              </div>

                              {commission?.is_leasing ? (
                                /* Leasing Configuration */
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm">Tipo de Arrendamento</Label>
                                    <Select
                                      value={commission.leasing_type || ""}
                                      onValueChange={(value) => updateProfessionalCommission(professional.id, "leasing_type", value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="fixed_monthly">Fixo Mensal</SelectItem>
                                        <SelectItem value="proportional_time">Proporcional ao Tempo</SelectItem>
                                        <SelectItem value="proportional_space">Proporcional ao Espaço</SelectItem>
                                        <SelectItem value="per_service">Por Serviço</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm">Valor (R$)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={commission.leasing_value}
                                      onChange={(e) => updateProfessionalCommission(professional.id, "leasing_value", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                              ) : (
                                /* Commission Configuration */
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm">Tipo de Comissão</Label>
                                    <Select
                                      value={commission?.commission_type || "percentage"}
                                      onValueChange={(value) => updateProfessionalCommission(professional.id, "commission_type", value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="percentage">Percentual (%)</SelectItem>
                                        <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm">
                                      Valor {commission?.commission_type === "percentage" ? "(%)" : "(R$)"}
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={commission?.commission_type === "percentage" ? 100 : undefined}
                                      step={commission?.commission_type === "percentage" ? 1 : 0.01}
                                      value={commission?.commission_value || 0}
                                      onChange={(e) => updateProfessionalCommission(professional.id, "commission_value", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">
                              Marque a caixa acima para configurar comissão ou arrendamento
                            </p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="bg-gradient-primary" disabled={loading}>
            {loading ? "Salvando..." : editingService ? "Salvar" : "Criar Serviço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}