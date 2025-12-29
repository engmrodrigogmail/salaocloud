import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Phone, MessageSquare, Calendar } from "lucide-react";

interface CancelledAppointment {
  id: string;
  client_name: string;
  client_phone: string;
  scheduled_at: string;
  cancelled_at: string;
  cancelled_via_whatsapp: boolean;
  cancelled_reason: string | null;
  service_name: string;
  professional_name: string;
}

interface CancelledHistoryDialogProps {
  establishmentId: string;
}

export function CancelledHistoryDialog({ establishmentId }: CancelledHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [appointments, setAppointments] = useState<CancelledAppointment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCancelledAppointments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          client_name,
          client_phone,
          scheduled_at,
          updated_at,
          cancelled_via_whatsapp,
          cancelled_reason,
          services:service_id (name),
          professionals:professional_id (name)
        `)
        .eq("establishment_id", establishmentId)
        .eq("status", "cancelled")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const formatted = (data || []).map((apt: any) => ({
        id: apt.id,
        client_name: apt.client_name,
        client_phone: apt.client_phone,
        scheduled_at: apt.scheduled_at,
        cancelled_at: apt.updated_at,
        cancelled_via_whatsapp: apt.cancelled_via_whatsapp || false,
        cancelled_reason: apt.cancelled_reason,
        service_name: apt.services?.name || "Serviço",
        professional_name: apt.professionals?.name || "Profissional"
      }));

      setAppointments(formatted);
    } catch (error) {
      console.error("Error fetching cancelled appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCancelledAppointments();
    }
  }, [open, establishmentId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          Histórico de Cancelamentos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Cancelamentos
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum agendamento cancelado encontrado.
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div 
                  key={apt.id} 
                  className="p-4 border rounded-lg bg-red-50/50 dark:bg-red-950/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{apt.client_name}</span>
                        {apt.cancelled_via_whatsapp && (
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Via WhatsApp
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {apt.client_phone}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(apt.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Serviço:</span> {apt.service_name}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Profissional:</span> {apt.professional_name}
                      </div>
                      {apt.cancelled_reason && (
                        <div className="text-sm mt-2 p-2 bg-muted rounded">
                          <span className="text-muted-foreground">Motivo:</span> {apt.cancelled_reason}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      Cancelado em<br />
                      {format(parseISO(apt.cancelled_at), "dd/MM/yyyy", { locale: ptBR })}
                      <br />
                      {format(parseISO(apt.cancelled_at), "HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
