import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabId: string;
  clientName: string;
  onRecovered: () => void | Promise<void>;
}

export function RecoverTabDialog({ open, onOpenChange, tabId, clientName, onRecovered }: Props) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("recover-deleted-tab", {
        body: { tab_id: tabId },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string };
      if (!result?.ok) {
        toast.error(result?.error || "Erro ao recuperar");
        return;
      }
      toast.success("Comanda recuperada");
      onOpenChange(false);
      await onRecovered();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao recuperar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Recuperar comanda
          </DialogTitle>
          <DialogDescription>
            A comanda de <span className="font-medium text-foreground">{clientName}</span> voltará
            para a lista e ficará marcada como <b>"Recuperada pelo dono"</b> para fins de auditoria.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Recuperar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
