import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Loader2, Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, setHours, setMinutes } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { NewClientDialog } from "@/components/clients/NewClientDialog";

type Service = Tables<"services">;
type Professional = Tables<"professionals">;
type Client = Pick<Tables<"clients">, "id" | "name" | "phone" | "email">;

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  services: Service[];
  professionals: Professional[];
  defaultDate?: Date;
  defaultTime?: string; // "HH:mm"
  defaultProfessionalId?: string;
  onCreated?: () => void;
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  establishmentId,
  services,
  professionals,
  defaultDate,
  defaultTime,
  defaultProfessionalId,
  onCreated,
}: NewAppointmentDialogProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);

  const reset = () => {
    setSearch("");
    setSelectedClient(null);
    setServiceId("");
    setProfessionalId(defaultProfessionalId ?? "");
    setDate(defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
    setTime(defaultTime ?? "");
    setNotes("");
  };

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, phone, email")
      .eq("establishment_id", establishmentId)
      .order("name");
    if (!error && data) setClients(data);
  };

  useEffect(() => {
    if (open) {
      reset();
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate, defaultTime, defaultProfessionalId]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone || "").includes(q) ||
          (c.email || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [clients, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      toast.error("Selecione um cliente", { position: "top-center", duration: 2000 });
      return;
    }
    if (!serviceId || !professionalId || !date || !time) {
      toast.error("Preencha todos os campos", { position: "top-center", duration: 2000 });
      return;
    }
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    setSaving(true);
    try {
      const [h, m] = time.split(":").map(Number);
      const [yy, mm, dd] = date.split("-").map(Number);
      const scheduledAt = setMinutes(setHours(new Date(yy, mm - 1, dd), h), m);

      const { error } = await supabase.from("appointments").insert({
        establishment_id: establishmentId,
        service_id: serviceId,
        professional_id: professionalId,
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        client_phone: selectedClient.phone,
        client_email: selectedClient.email || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: service.duration_minutes,
        price: service.price,
        notes: notes || null,
        status: "confirmed",
      });

      if (error) throw error;

      toast.success("Agendamento criado!", { position: "top-center", duration: 2000 });
      onOpenChange(false);
      onCreated?.();
    } catch (err: any) {
      console.error("Erro ao criar agendamento", err);
      toast.error(err?.message || "Erro ao criar agendamento", {
        position: "top-center",
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Novo agendamento
            </DialogTitle>
            <DialogDescription>
              Lance manualmente um agendamento (modo balcão / recepção).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Cliente */}
            <div className="space-y-2">
              <Label>Cliente *</Label>
              {selectedClient ? (
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{selectedClient.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedClient.phone}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedClient(null)}
                  >
                    Trocar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, telefone ou e-mail"
                      className="pl-10"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="rounded-md border max-h-48 overflow-y-auto">
                    {filteredClients.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum cliente encontrado
                      </p>
                    ) : (
                      filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedClient(c)}
                          className="w-full text-left p-2 hover:bg-accent border-b last:border-b-0"
                        >
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.phone}</p>
                        </button>
                      ))
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setNewClientOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Cadastrar novo cliente (balcão)
                  </Button>
                </>
              )}
            </div>

            {/* Profissional */}
            <div className="space-y-2">
              <Label>Profissional *</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Serviço */}
            <div className="space-y-2">
              <Label>Serviço *</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.duration_minutes}min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data + Hora */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="appt-date">Data *</Label>
                <Input
                  id="appt-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt-time">Hora *</Label>
                <Input
                  id="appt-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="appt-notes">Observações</Label>
              <Textarea
                id="appt-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                  </>
                ) : (
                  "Criar agendamento"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <NewClientDialog
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        establishmentId={establishmentId}
        onCreated={() => {
          fetchClients();
        }}
      />
    </>
  );
}
