import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Grid3X3, Settings2, X, Check } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Service {
  id: string;
  name: string;
  price: number;
}

interface Professional {
  id: string;
  name: string;
}

interface ProfessionalService {
  id: string;
  professional_id: string;
  service_id: string;
  commission_type: "fixed" | "percentage";
  commission_value: number;
  is_leasing: boolean;
  leasing_type: "fixed_monthly" | "proportional_time" | "proportional_space" | "per_service" | null;
  leasing_value: number;
}

interface CommissionMatrixTabProps {
  establishmentId: string;
}

export function CommissionMatrixTab({ establishmentId }: CommissionMatrixTabProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [matrix, setMatrix] = useState<Record<string, ProfessionalService>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingCell, setEditingCell] = useState<{ professionalId: string; serviceId: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [establishmentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("establishment_id", establishmentId)
        .eq("is_active", true)
        .order("name");

      if (servicesError) throw servicesError;

      const { data: professionalsData, error: professionalsError } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", establishmentId)
        .eq("is_active", true)
        .order("name");

      if (professionalsError) throw professionalsError;

      const { data: psData, error: psError } = await supabase
        .from("professional_services")
        .select("id, professional_id, service_id, commission_type, commission_value, is_leasing, leasing_type, leasing_value")
        .in("professional_id", (professionalsData || []).map(p => p.id));

      if (psError) throw psError;

      const matrixMap: Record<string, ProfessionalService> = {};
      (psData || []).forEach((ps: any) => {
        const key = `${ps.professional_id}-${ps.service_id}`;
        matrixMap[key] = {
          ...ps,
          is_leasing: ps.is_leasing || false,
          leasing_type: ps.leasing_type || null,
          leasing_value: ps.leasing_value || 0,
        };
      });

      setServices(servicesData || []);
      setProfessionals(professionalsData || []);
      setMatrix(matrixMap);
      setHasChanges(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const getMatrixKey = (professionalId: string, serviceId: string) => 
    `${professionalId}-${serviceId}`;

  const updateCell = (
    professionalId: string, 
    serviceId: string, 
    updates: Partial<ProfessionalService>
  ) => {
    const key = getMatrixKey(professionalId, serviceId);
    
    setMatrix(prev => {
      const existing = prev[key];
      
      if (existing) {
        return {
          ...prev,
          [key]: {
            ...existing,
            ...updates,
          },
        };
      } else {
        return {
          ...prev,
          [key]: {
            id: "",
            professional_id: professionalId,
            service_id: serviceId,
            commission_type: "percentage",
            commission_value: 0,
            is_leasing: false,
            leasing_type: null,
            leasing_value: 0,
            ...updates,
          },
        };
      }
    });
    
    setHasChanges(true);
  };

  const toggleServiceForProfessional = async (professionalId: string, serviceId: string) => {
    const key = getMatrixKey(professionalId, serviceId);
    const existing = matrix[key];

    try {
      if (existing && existing.id) {
        const { error } = await supabase
          .from("professional_services")
          .delete()
          .eq("id", existing.id);

        if (error) throw error;

        setMatrix(prev => {
          const newMatrix = { ...prev };
          delete newMatrix[key];
          return newMatrix;
        });
        
        toast.success("Serviço removido do profissional");
      } else {
        const { data, error } = await supabase
          .from("professional_services")
          .insert({
            professional_id: professionalId,
            service_id: serviceId,
            commission_type: "percentage",
            commission_value: 0,
            is_leasing: false,
          })
          .select()
          .single();

        if (error) throw error;

        setMatrix(prev => ({
          ...prev,
          [key]: {
            id: data.id,
            professional_id: data.professional_id,
            service_id: data.service_id,
            commission_type: data.commission_type as "fixed" | "percentage",
            commission_value: data.commission_value,
            is_leasing: data.is_leasing || false,
            leasing_type: (data.leasing_type as ProfessionalService["leasing_type"]) || null,
            leasing_value: data.leasing_value || 0,
          },
        }));
        
        toast.success("Serviço adicionado ao profissional");
      }
    } catch (error) {
      console.error("Error toggling service:", error);
      toast.error("Erro ao atualizar vínculo");
    }
  };

  const saveAllChanges = async () => {
    try {
      setSaving(true);
      
      const updates = Object.values(matrix).filter(ps => ps.id);

      const promises = updates.map(update =>
        supabase
          .from("professional_services")
          .update({
            commission_type: update.commission_type,
            commission_value: update.commission_value,
            is_leasing: update.is_leasing,
            leasing_type: update.is_leasing ? update.leasing_type : null,
            leasing_value: update.is_leasing ? update.leasing_value : 0,
          })
          .eq("id", update.id)
      );

      await Promise.all(promises);
      
      setHasChanges(false);
      toast.success("Comissões salvas com sucesso!");
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar comissões");
    } finally {
      setSaving(false);
    }
  };

  const getLeasingTypeLabel = (type: string | null) => {
    switch (type) {
      case "fixed_monthly": return "Mensal";
      case "proportional_time": return "Tempo";
      case "proportional_space": return "Espaço";
      case "per_service": return "Serviço";
      default: return "";
    }
  };

  const getCellSummary = (cell: ProfessionalService) => {
    if (cell.is_leasing) {
      return `Arrend. R$ ${cell.leasing_value.toFixed(0)}`;
    }
    return cell.commission_type === "percentage" 
      ? `${cell.commission_value}%` 
      : `R$ ${cell.commission_value.toFixed(2)}`;
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando matriz...</div>;
  }

  if (services.length === 0 || professionals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground">
            {services.length === 0 
              ? "Cadastre serviços primeiro para configurar a matriz"
              : "Cadastre profissionais primeiro para configurar a matriz"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentEditingCell = editingCell 
    ? matrix[getMatrixKey(editingCell.professionalId, editingCell.serviceId)]
    : null;

  const currentEditingService = editingCell 
    ? services.find(s => s.id === editingCell.serviceId)
    : null;

  const currentEditingProfessional = editingCell
    ? professionals.find(p => p.id === editingCell.professionalId)
    : null;

  // Mobile card view
  const renderMobileView = () => (
    <div className="space-y-4 md:hidden">
      {services.map(service => (
        <Card key={service.id} className="overflow-hidden">
          <CardHeader className="py-3 px-4 bg-muted/50">
            <div className="flex flex-col">
              <span className="font-medium text-sm">{service.name}</span>
              <span className="text-xs text-muted-foreground">
                R$ {service.price.toFixed(2)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {professionals.map(professional => {
              const key = getMatrixKey(professional.id, service.id);
              const cell = matrix[key];
              const isLinked = !!cell;

              return (
                <div key={professional.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{professional.name}</span>
                    {isLinked ? (
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={cell.is_leasing ? "outline" : "secondary"}
                          className={`text-xs cursor-pointer ${cell.is_leasing ? "text-orange-600 border-orange-600" : ""}`}
                          onClick={() => setEditingCell({ professionalId: professional.id, serviceId: service.id })}
                        >
                          {getCellSummary(cell)}
                          <Settings2 className="h-3 w-3 ml-1" />
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => toggleServiceForProfessional(professional.id, service.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => toggleServiceForProfessional(professional.id, service.id)}
                      >
                        + Vincular
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Desktop table view
  const renderDesktopView = () => (
    <Card className="hidden md:block">
      <CardHeader>
        <CardTitle className="text-lg">Matriz de Comissões</CardTitle>
        <CardDescription>
          Clique em uma célula para editar detalhes. 
          <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-600">
            Laranja = Arrendamento
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-max">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-3 bg-muted font-medium min-w-[200px] sticky left-0 z-10">
                    Serviço
                  </th>
                  {professionals.map(professional => (
                    <th 
                      key={professional.id} 
                      className="text-center p-3 bg-muted font-medium min-w-[140px]"
                    >
                      {professional.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {services.map(service => (
                  <tr key={service.id} className="border-t">
                    <td className="p-3 font-medium sticky left-0 bg-background z-10">
                      <div>
                        <span>{service.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          (R$ {service.price.toFixed(2)})
                        </span>
                      </div>
                    </td>
                    {professionals.map(professional => {
                      const key = getMatrixKey(professional.id, service.id);
                      const cell = matrix[key];
                      const isLinked = !!cell;

                      return (
                        <td 
                          key={professional.id} 
                          className={`p-2 text-center border-l ${
                            isLinked 
                              ? cell.is_leasing 
                                ? "bg-orange-50 dark:bg-orange-950/20" 
                                : "bg-primary/5" 
                              : "bg-muted/30"
                          }`}
                        >
                          {isLinked ? (
                            <div className="flex flex-col items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-auto py-1 px-2 text-xs font-medium ${
                                  cell.is_leasing ? "text-orange-600" : ""
                                }`}
                                onClick={() => setEditingCell({ professionalId: professional.id, serviceId: service.id })}
                              >
                                {getCellSummary(cell)}
                                <Settings2 className="h-3 w-3 ml-1 opacity-50" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-xs text-destructive hover:text-destructive px-2"
                                onClick={() => toggleServiceForProfessional(professional.id, service.id)}
                              >
                                Remover
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-muted-foreground"
                              onClick={() => toggleServiceForProfessional(professional.id, service.id)}
                            >
                              + Vincular
                            </Button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Matriz de Comissões</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Configure comissões e arrendamentos por serviço/profissional
          </p>
        </div>
        <Button 
          onClick={saveAllChanges} 
          disabled={!hasChanges || saving}
          className="w-full sm:w-auto"
          size="sm"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      {/* Mobile description card */}
      <Card className="md:hidden">
        <CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">
            Vincule serviços aos profissionais. 
            <Badge variant="outline" className="ml-1 text-xs text-orange-600 border-orange-600">
              Laranja = Arrendamento
            </Badge>
          </p>
        </CardContent>
      </Card>

      {renderMobileView()}
      {renderDesktopView()}

      {/* Edit Cell Dialog */}
      <Dialog open={!!editingCell} onOpenChange={(open) => !open && setEditingCell(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Comissão</DialogTitle>
            <DialogDescription>
              {currentEditingProfessional?.name} - {currentEditingService?.name}
            </DialogDescription>
          </DialogHeader>

          {currentEditingCell && editingCell && (
            <div className="space-y-6 py-4">
              {/* Leasing Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="font-medium">Arrendamento</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Profissional paga ao salão
                  </p>
                </div>
                <Switch
                  checked={currentEditingCell.is_leasing}
                  onCheckedChange={(checked) => 
                    updateCell(editingCell.professionalId, editingCell.serviceId, { is_leasing: checked })
                  }
                />
              </div>

              {currentEditingCell.is_leasing ? (
                /* Leasing Configuration */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Arrendamento</Label>
                    <Select
                      value={currentEditingCell.leasing_type || ""}
                      onValueChange={(value) => 
                        updateCell(editingCell.professionalId, editingCell.serviceId, { leasing_type: value as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed_monthly">Fixo Mensal</SelectItem>
                        <SelectItem value="proportional_time">Proporcional ao Tempo</SelectItem>
                        <SelectItem value="proportional_space">Proporcional ao Espaço</SelectItem>
                        <SelectItem value="per_service">Por Serviço Realizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor do Arrendamento (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentEditingCell.leasing_value}
                      onChange={(e) => 
                        updateCell(editingCell.professionalId, editingCell.serviceId, { 
                          leasing_value: parseFloat(e.target.value) || 0 
                        })
                      }
                    />
                  </div>
                </div>
              ) : (
                /* Commission Configuration */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Comissão</Label>
                    <Select
                      value={currentEditingCell.commission_type}
                      onValueChange={(value) => 
                        updateCell(editingCell.professionalId, editingCell.serviceId, { 
                          commission_type: value as "fixed" | "percentage" 
                        })
                      }
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
                    <Label>
                      Valor {currentEditingCell.commission_type === "percentage" ? "(%)" : "(R$)"}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max={currentEditingCell.commission_type === "percentage" ? 100 : undefined}
                      step={currentEditingCell.commission_type === "percentage" ? 1 : 0.01}
                      value={currentEditingCell.commission_value}
                      onChange={(e) => 
                        updateCell(editingCell.professionalId, editingCell.serviceId, { 
                          commission_value: parseFloat(e.target.value) || 0 
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCell(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}