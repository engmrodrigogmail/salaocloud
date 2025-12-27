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

interface NewTabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    client_name: string;
    client_id?: string;
    professional_id?: string;
    notes?: string;
  }) => Promise<void>;
  clients: Client[];
  professionals: Professional[];
  loading?: boolean;
}

export function NewTabDialog({
  open,
  onOpenChange,
  onSubmit,
  clients,
  professionals,
  loading = false,
}: NewTabDialogProps) {
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [searchClient, setSearchClient] = useState("");

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchClient.toLowerCase()) ||
    c.phone.includes(searchClient)
  );

  const handleClientSelect = (id: string) => {
    setClientId(id);
    const client = clients.find(c => c.id === id);
    if (client) {
      setClientName(client.name);
    }
  };

  const handleSubmit = async () => {
    await onSubmit({
      client_name: clientName,
      client_id: clientId || undefined,
      professional_id: professionalId || undefined,
      notes: notes || undefined,
    });
    
    // Reset form
    setClientName("");
    setClientId("");
    setProfessionalId("");
    setNotes("");
    setSearchClient("");
  };

  const isValid = clientName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
                    onClick={() => {
                      handleClientSelect(client.id);
                      setSearchClient("");
                    }}
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
            <Label>Profissional Responsável</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {professionals.map(prof => (
                  <SelectItem key={prof.id} value={prof.id}>
                    {prof.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
