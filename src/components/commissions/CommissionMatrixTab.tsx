import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Grid3X3 } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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

  useEffect(() => {
    fetchData();
  }, [establishmentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch services
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("establishment_id", establishmentId)
        .eq("is_active", true)
        .order("name");

      if (servicesError) throw servicesError;

      // Fetch professionals
      const { data: professionalsData, error: professionalsError } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", establishmentId)
        .eq("is_active", true)
        .order("name");

      if (professionalsError) throw professionalsError;

      // Fetch existing professional_services
      const { data: psData, error: psError } = await supabase
        .from("professional_services")
        .select("id, professional_id, service_id, commission_type, commission_value")
        .in("professional_id", (professionalsData || []).map(p => p.id));

      if (psError) throw psError;

      // Build matrix lookup
      const matrixMap: Record<string, ProfessionalService> = {};
      (psData || []).forEach((ps: ProfessionalService) => {
        const key = `${ps.professional_id}-${ps.service_id}`;
        matrixMap[key] = ps;
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
    field: "commission_type" | "commission_value",
    value: string | number
  ) => {
    const key = getMatrixKey(professionalId, serviceId);
    
    setMatrix(prev => {
      const existing = prev[key];
      
      if (existing) {
        return {
          ...prev,
          [key]: {
            ...existing,
            [field]: field === "commission_value" ? Number(value) : value,
          },
        };
      } else {
        // Create new entry if doesn't exist
        return {
          ...prev,
          [key]: {
            id: "", // Will be generated on save
            professional_id: professionalId,
            service_id: serviceId,
            commission_type: field === "commission_type" ? (value as "fixed" | "percentage") : "percentage",
            commission_value: field === "commission_value" ? Number(value) : 0,
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
        // Remove from professional_services
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
        // Add to professional_services
        const { data, error } = await supabase
          .from("professional_services")
          .insert({
            professional_id: professionalId,
            service_id: serviceId,
            commission_type: "percentage",
            commission_value: 0,
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
      
      const updates: { id: string; commission_type: string; commission_value: number }[] = [];
      
      Object.values(matrix).forEach(ps => {
        if (ps.id) {
          updates.push({
            id: ps.id,
            commission_type: ps.commission_type,
            commission_value: ps.commission_value,
          });
        }
      });

      // Update all in parallel
      const promises = updates.map(update =>
        supabase
          .from("professional_services")
          .update({
            commission_type: update.commission_type,
            commission_value: update.commission_value,
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

  // Mobile card view for each service-professional combination
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
                        <Select
                          value={cell.commission_type}
                          onValueChange={(value) => 
                            updateCell(professional.id, service.id, "commission_type", value)
                          }
                        >
                          <SelectTrigger className="h-8 w-16 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">%</SelectItem>
                            <SelectItem value="fixed">R$</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="0"
                          step={cell.commission_type === "percentage" ? "1" : "0.01"}
                          max={cell.commission_type === "percentage" ? "100" : undefined}
                          value={cell.commission_value}
                          onChange={(e) => 
                            updateCell(professional.id, service.id, "commission_value", e.target.value)
                          }
                          className="h-8 w-20 text-xs text-center"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => toggleServiceForProfessional(professional.id, service.id)}
                        >
                          ×
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
        <CardTitle className="text-lg">Serviços × Profissionais</CardTitle>
        <CardDescription>
          Clique em uma célula vazia para vincular o serviço ao profissional. 
          Edite os valores para definir comissões específicas.
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
                      className="text-center p-3 bg-muted font-medium min-w-[180px]"
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
                            isLinked ? "bg-primary/5" : "bg-muted/30"
                          }`}
                        >
                          {isLinked ? (
                            <div className="flex flex-col gap-2">
                              <Select
                                value={cell.commission_type}
                                onValueChange={(value) => 
                                  updateCell(professional.id, service.id, "commission_type", value)
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentage">%</SelectItem>
                                  <SelectItem value="fixed">R$</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  step={cell.commission_type === "percentage" ? "1" : "0.01"}
                                  max={cell.commission_type === "percentage" ? "100" : undefined}
                                  value={cell.commission_value}
                                  onChange={(e) => 
                                    updateCell(professional.id, service.id, "commission_value", e.target.value)
                                  }
                                  className="h-8 text-xs text-center"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-destructive hover:text-destructive"
                                onClick={() => toggleServiceForProfessional(professional.id, service.id)}
                              >
                                Desvincular
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
            Configure a comissão de cada profissional por serviço
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
            Vincule serviços aos profissionais e defina comissões específicas para cada combinação.
          </p>
        </CardContent>
      </Card>

      {renderMobileView()}
      {renderDesktopView()}
    </div>
  );
}
