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
import { Briefcase, DollarSign, Building } from "lucide-react";
import { format } from "date-fns";
import { AvatarUpload } from "./AvatarUpload";

interface Service {
  id: string;
  name: string;
  price: number;
}

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialties: string[] | null;
  is_active: boolean;
}

interface ServiceCommission {
  service_id: string;
  commission_type: "fixed" | "percentage";
  commission_value: number;
  is_leasing: boolean;
  leasing_type: "fixed_monthly" | "proportional_time" | "proportional_space" | "per_service" | null;
  leasing_value: number;
}

interface ProfessionalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  editingProfessional: Professional | null;
  onSuccess: () => void;
}

export function ProfessionalFormDialog({
  open,
  onOpenChange,
  establishmentId,
  editingProfessional,
  onSuccess,
}: ProfessionalFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [serviceCommissions, setServiceCommissions] = useState<Record<string, ServiceCommission>>({});
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    specialties: "",
    is_active: true,
    leasing_type: "none" as "none" | "fixed_monthly" | "proportional",
    leasing_value: 0,
    leasing_base_date: "",
    avatar_url: null as string | null,
  });

  useEffect(() => {
    if (open) {
      fetchServices();
      if (editingProfessional) {
        loadProfessionalData();
      } else {
        resetForm();
      }
    }
  }, [open, editingProfessional]);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from("services")
      .select("id, name, price")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setServices(data);
    }
  };

  const loadProfessionalData = async () => {
    if (!editingProfessional) return;

    // Fetch full professional data including leasing fields
    const { data: fullProfessional } = await supabase
      .from("professionals")
      .select("*")
      .eq("id", editingProfessional.id)
      .single();

    if (fullProfessional) {
      setFormData({
        name: fullProfessional.name,
        email: fullProfessional.email || "",
        phone: fullProfessional.phone || "",
        specialties: fullProfessional.specialties?.join(", ") || "",
        is_active: fullProfessional.is_active,
        leasing_type: (fullProfessional.leasing_type as "none" | "fixed_monthly" | "proportional") || "none",
        leasing_value: fullProfessional.leasing_value || 0,
        leasing_base_date: fullProfessional.leasing_base_date || "",
        avatar_url: fullProfessional.avatar_url || null,
      });
    }

    // Fetch existing professional_services
    const { data: psData } = await supabase
      .from("professional_services")
      .select("*")
      .eq("professional_id", editingProfessional.id);

    if (psData) {
      const selected = new Set<string>();
      const commissions: Record<string, ServiceCommission> = {};
      
      psData.forEach((ps: any) => {
        selected.add(ps.service_id);
        commissions[ps.service_id] = {
          service_id: ps.service_id,
          commission_type: ps.commission_type || "percentage",
          commission_value: ps.commission_value || 0,
          is_leasing: ps.is_leasing || false,
          leasing_type: ps.leasing_type || null,
          leasing_value: ps.leasing_value || 0,
        };
      });
      
      setSelectedServices(selected);
      setServiceCommissions(commissions);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      specialties: "",
      is_active: true,
      leasing_type: "none",
      leasing_value: 0,
      leasing_base_date: "",
      avatar_url: null,
    });
    setSelectedServices(new Set());
    setServiceCommissions({});
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
        // Also remove from commissions
        setServiceCommissions(c => {
          const { [serviceId]: _, ...rest } = c;
          return rest;
        });
      } else {
        next.add(serviceId);
        // Add default commission
        setServiceCommissions(c => ({
          ...c,
          [serviceId]: {
            service_id: serviceId,
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

  const updateServiceCommission = (serviceId: string, field: keyof ServiceCommission, value: any) => {
    setServiceCommissions(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
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

    const specialtiesArray = formData.specialties
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      let professionalId = editingProfessional?.id;

      if (editingProfessional) {
        const { error } = await supabase
          .from("professionals")
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            specialties: specialtiesArray.length > 0 ? specialtiesArray : null,
            is_active: formData.is_active,
            leasing_type: formData.leasing_type,
            leasing_value: formData.leasing_type !== "none" ? formData.leasing_value : 0,
            leasing_base_date: formData.leasing_type === "fixed_monthly" && formData.leasing_base_date 
              ? formData.leasing_base_date 
              : null,
            avatar_url: formData.avatar_url,
          })
          .eq("id", editingProfessional.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("professionals")
          .insert({
            establishment_id: establishmentId,
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            specialties: specialtiesArray.length > 0 ? specialtiesArray : null,
            is_active: formData.is_active,
            leasing_type: formData.leasing_type,
            leasing_value: formData.leasing_type !== "none" ? formData.leasing_value : 0,
            leasing_base_date: formData.leasing_type === "fixed_monthly" && formData.leasing_base_date 
              ? formData.leasing_base_date 
              : null,
            avatar_url: formData.avatar_url,
          })
          .select()
          .single();

        if (error) throw error;
        professionalId = data.id;
      }

      // Update professional_services
      if (professionalId) {
        // Delete existing links
        await supabase
          .from("professional_services")
          .delete()
          .eq("professional_id", professionalId);

        // Insert new links
        const linksToInsert = Array.from(selectedServices).map(serviceId => {
          const commission = serviceCommissions[serviceId];
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

      toast.success(editingProfessional ? "Profissional atualizado!" : "Profissional adicionado!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar profissional");
    } finally {
      setLoading(false);
    }
  };

  const getLeasingTypeLabel = (type: string | null) => {
    switch (type) {
      case "fixed_monthly": return "Fixo Mensal";
      case "proportional_time": return "Proporcional ao Tempo";
      case "proportional_space": return "Proporcional ao Espaço";
      case "per_service": return "Por Serviço";
      default: return "Selecione...";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {editingProfessional ? "Editar Profissional" : "Novo Profissional"}
          </DialogTitle>
          <DialogDescription>
            {editingProfessional
              ? "Atualize as informações do profissional e suas regras de comissão"
              : "Adicione um novo membro à sua equipe e configure suas comissões"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              {/* Avatar Upload */}
              <div className="flex justify-center">
                <AvatarUpload
                  avatarUrl={formData.avatar_url}
                  professionalName={formData.name}
                  onAvatarChange={(url) => setFormData({ ...formData, avatar_url: url })}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Especialidades</Label>
                <Input
                  placeholder="Corte, Coloração, Manicure..."
                  value={formData.specialties}
                  onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Separe por vírgulas</p>
              </div>
              <div className="flex items-center justify-between">
                <Label>Profissional ativo</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>

            <Separator />

            {/* Professional-Level Leasing */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-semibold">Arrendamento Geral</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure o arrendamento do profissional independente dos serviços. O valor será descontado do total de comissões.
              </p>

              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label>Tipo de Arrendamento</Label>
                  <Select
                    value={formData.leasing_type}
                    onValueChange={(value: "none" | "fixed_monthly" | "proportional") => 
                      setFormData({ ...formData, leasing_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem Arrendamento</SelectItem>
                      <SelectItem value="fixed_monthly">Valor Fixo Mensal</SelectItem>
                      <SelectItem value="proportional">Proporcional aos Serviços (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.leasing_type !== "none" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>
                        {formData.leasing_type === "fixed_monthly" 
                          ? "Valor Mensal (R$)" 
                          : "Percentual (%)"}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max={formData.leasing_type === "proportional" ? 100 : undefined}
                        step={formData.leasing_type === "proportional" ? 1 : 0.01}
                        value={formData.leasing_value}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          leasing_value: parseFloat(e.target.value) || 0 
                        })}
                        placeholder={formData.leasing_type === "fixed_monthly" ? "1500.00" : "30"}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData.leasing_type === "fixed_monthly" 
                          ? "Valor fixo que o profissional paga mensalmente" 
                          : "Percentual sobre o valor total dos serviços realizados"}
                      </p>
                    </div>

                    {formData.leasing_type === "fixed_monthly" && (
                      <div className="space-y-2">
                        <Label>Data Base do Fechamento</Label>
                        <Input
                          type="date"
                          value={formData.leasing_base_date}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            leasing_base_date: e.target.value 
                          })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Dia do mês para contabilizar o fechamento (ex: dia 01 ou dia 15)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Services & Commissions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-semibold">Serviços e Comissões</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Selecione os serviços que este profissional realiza e configure as regras de comissão ou arrendamento.
              </p>

              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum serviço cadastrado
                </p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {services.map((service) => {
                    const isSelected = selectedServices.has(service.id);
                    const commission = serviceCommissions[service.id];

                    return (
                      <AccordionItem key={service.id} value={service.id} className="border rounded-lg mb-2">
                        <div className="flex items-center px-4 py-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleService(service.id)}
                            className="mr-3"
                          />
                          <AccordionTrigger className="flex-1 hover:no-underline py-2">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="font-medium">{service.name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  R$ {service.price.toFixed(2)}
                                </Badge>
                                {isSelected && commission?.is_leasing && (
                                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                                    Arrendamento
                                  </Badge>
                                )}
                              </div>
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
                                  onCheckedChange={(checked) => updateServiceCommission(service.id, "is_leasing", checked)}
                                />
                              </div>

                              {commission?.is_leasing ? (
                                /* Leasing Configuration */
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm">Tipo de Arrendamento</Label>
                                    <Select
                                      value={commission.leasing_type || ""}
                                      onValueChange={(value) => updateServiceCommission(service.id, "leasing_type", value)}
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
                                      onChange={(e) => updateServiceCommission(service.id, "leasing_value", parseFloat(e.target.value) || 0)}
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
                                      onValueChange={(value) => updateServiceCommission(service.id, "commission_type", value)}
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
                                      onChange={(e) => updateServiceCommission(service.id, "commission_value", parseFloat(e.target.value) || 0)}
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
        </div>

        <DialogFooter className="flex-shrink-0 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="bg-gradient-primary" disabled={loading}>
            {loading ? "Salvando..." : editingProfessional ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}