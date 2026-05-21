import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, History } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";

type Client = Tables<"clients">;
type Professional = Tables<"professionals">;
type Service = Tables<"services">;

interface NewTabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    client_name: string;
    client_id?: string;
    professional_id?: string;
    service_id?: string;
    notes?: string;
    opened_at?: string;
    is_retroactive?: boolean;
  }) => Promise<void>;
  clients: Client[];
  professionals: Professional[];
  services?: Service[];
  loading?: boolean;
  /** If 'owner' or 'manager', allows retroactive opening (custom opened_at) */
  userRole?: "owner" | "manager" | "professional";
}

export function NewTabDialog({
  open,
  onOpenChange,
  onSubmit,
  clients,
  professionals,
  services = [],
  loading = false,
  userRole = "professional",
}: NewTabDialogProps) {
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [retroactive, setRetroactive] = useState(false);
  const [retroDate, setRetroDate] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const canRetroactive = userRole === "owner" || userRole === "manager";

  // Deriva o estabelecimento a partir dos dados recebidos (para buscar categorias)
  const establishmentId =
    services[0]?.establishment_id ||
    professionals[0]?.establishment_id ||
    clients[0]?.establishment_id ||
    null;
  const { getServiceCategory } = useCatalogCategories(establishmentId);

  const handleClientSelect = (id: string) => {
    setClientId(id);
    if (!id) return;
    const client = clients.find((c) => c.id === id);
    if (client) setClientName(client.name);
  };

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: c.name,
        hint: c.phone,
        keywords: c.phone,
      })),
    [clients],
  );

  const professionalOptions = useMemo(
    () => professionals.map((p) => ({ value: p.id, label: p.name })),
    [professionals],
  );

  const serviceOptions = useMemo(
    () =>
      services.map((s) => ({
        value: s.id,
        label: s.name,
        hint: `${s.duration_minutes}min`,
        group: getServiceCategory((s as any).category_id),
      })),
    [services, getServiceCategory],
  );

  const handleSubmit = async () => {
    let opened_at: string | undefined;
    if (retroactive && canRetroactive && retroDate) {
      opened_at = new Date(retroDate).toISOString();
    }
    await onSubmit({
      client_name: clientName,
      client_id: clientId || undefined,
      professional_id: professionalId || undefined,
      service_id: serviceId || undefined,
      notes: notes || undefined,
      opened_at,
      is_retroactive: retroactive && canRetroactive,
    });
    setClientName("");
    setClientId("");
    setProfessionalId("");
    setServiceId("");
    setNotes("");
    setRetroactive(false);
  };

  const isAvulsa = !clientId;
  const requiresService = professionalId.length > 0 || isAvulsa;
  const requiresProfessional = isAvulsa || serviceId.length > 0;
  const isValid =
    clientName.trim().length > 0 &&
    (!requiresProfessional || professionalId.length > 0) &&
    (!requiresService || serviceId.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abrir Nova Comanda</DialogTitle>
          <DialogDescription>
            Preencha os dados para iniciar uma nova comanda
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Cliente Cadastrado (opcional)</Label>
            <SearchableSelect
              value={clientId}
              onValueChange={handleClientSelect}
              placeholder="Selecionar cliente cadastrado"
              searchPlaceholder="Buscar por nome ou telefone..."
              emptyText="Nenhum cliente encontrado."
              options={clientOptions}
              allowClear
              clearLabel="Nenhum / cliente avulso"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientName">Nome do Cliente *</Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Digite o nome do cliente"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Profissional Responsável {requiresProfessional ? "*" : ""}
            </Label>
            <SearchableSelect
              value={professionalId}
              onValueChange={setProfessionalId}
              placeholder="Selecionar profissional"
              searchPlaceholder="Buscar profissional..."
              options={professionalOptions}
            />
            {requiresProfessional && (
              <p className="text-xs text-muted-foreground">
                {isAvulsa
                  ? "Obrigatório em comanda avulsa (sem cliente cadastrado)."
                  : "Obrigatório quando há serviço inicial — necessário para bloquear a agenda."}
              </p>
            )}
          </div>

          {services.length > 0 && (
            <div className="space-y-2">
              <Label>
                Serviço inicial {requiresService ? "*" : "(opcional)"}
              </Label>
              <SearchableSelect
                value={serviceId}
                onValueChange={setServiceId}
                placeholder="Selecionar serviço"
                searchPlaceholder="Buscar serviço..."
                options={serviceOptions}
                allowClear
                clearLabel="Sem serviço inicial"
              />
              <p className="text-xs text-muted-foreground">
                {requiresService
                  ? "Obrigatório quando há profissional selecionado — define a duração do bloqueio na agenda."
                  : "Selecione para bloquear automaticamente a agenda do profissional durante o atendimento."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre a comanda..."
              rows={2}
            />
          </div>

          {canRetroactive && (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="retroactive"
                  checked={retroactive}
                  onCheckedChange={(v) => setRetroactive(v === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="retroactive" className="flex items-center gap-1 cursor-pointer">
                    <History className="h-3.5 w-3.5" />
                    Lançamento retroativo
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use para regularizar atendimentos já realizados. A agenda do profissional NÃO será bloqueada e a comanda fica marcada como "Retroativa".
                  </p>
                </div>
              </div>
              {retroactive && (
                <div className="space-y-1 pl-6">
                  <Label htmlFor="retroDate" className="text-xs">Data e hora da abertura</Label>
                  <Input
                    id="retroDate"
                    type="datetime-local"
                    value={retroDate}
                    onChange={(e) => setRetroDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Abrir Comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
