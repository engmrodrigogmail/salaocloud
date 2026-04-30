import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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
  }) => Promise<void>;
  clients: Client[];
  professionals: Professional[];
  services?: Service[];
  loading?: boolean;
}

export function NewTabDialog({
  open,
  onOpenChange,
  onSubmit,
  clients,
  professionals,
  services = [],
  loading = false,
}: NewTabDialogProps) {
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [searchClient, setSearchClient] = useState("");

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchClient.toLowerCase()) ||
    c.phone.includes(searchClient)
  );

  const handleClientSelect = (id: string) => {
    setClientId(id);
    const client = clients.find(c => c.id === id);
    if (client) setClientName(client.name);
  };

  const handleSubmit = async () => {
    await onSubmit({
      client_name: clientName,
      client_id: clientId || undefined,
      professional_id: professionalId || undefined,
      service_id: serviceId || undefined,
      notes: notes || undefined,
    });
    setClientName(""); setClientId(""); setProfessionalId(""); setServiceId(""); setNotes(""); setSearchClient("");
  };

  // "Avulsa" mode: no registered client selected. In this mode, both professional and service
  // are mandatory to ensure the agenda is properly blocked and the operation is auditable.
  const isAvulsa = !clientId;
  // Service is also required whenever a professional is selected (to know how long to block the agenda).
  const requiresService = professionalId.length > 0 || isAvulsa;
  // Professional is required whenever there is an initial service (otherwise we can't block the agenda)
  // or in "avulsa" mode.
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
            <Input
              placeholder="Buscar cliente..."
              value={searchClient}
              onChange={(e) => setSearchClient(e.target.value)}
            />
            {searchClient && filteredClients.length > 0 && (
              <div className="max-h-32 overflow-y-auto border rounded-md">
                {filteredClients.slice(0, 5).map(client => (
                  <button
                    key={client.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                    onClick={() => { handleClientSelect(client.id); setSearchClient(""); }}
                  >
                    <span className="font-medium">{client.name}</span>
                    <span className="text-muted-foreground ml-2">{client.phone}</span>
                  </button>
                ))}
              </div>
            )}
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
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map(prof => (
                  <SelectItem key={prof.id} value={prof.id}>{prof.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {requiresProfessional && (
              <p className="text-xs text-muted-foreground">
                Obrigatório em comanda avulsa (sem cliente cadastrado).
              </p>
            )}
          </div>

          {services.length > 0 && (
            <div className="space-y-2">
              <Label>
                Serviço inicial {requiresService ? "*" : "(opcional)"}
              </Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes}min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
