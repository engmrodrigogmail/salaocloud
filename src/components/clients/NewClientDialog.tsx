import { useState } from "react";
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
import { UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  onCreated?: (client?: { id: string; name: string; phone: string; email: string | null }) => void;
}

function formatPhoneBR(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function NewClientDialog({
  open,
  onOpenChange,
  establishmentId,
  onCreated,
}: NewClientDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const phoneDigits = phone.replace(/\D/g, "");

    if (!trimmedName) {
      toast.error("Informe o nome do cliente", { position: "top-center", duration: 2000 });
      return;
    }
    if (phoneDigits.length < 10) {
      toast.error("Telefone inválido (DDD + número)", { position: "top-center", duration: 2000 });
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("E-mail inválido", { position: "top-center", duration: 2000 });
      return;
    }

    setSaving(true);
    try {
      // Check duplicates within this establishment (email or phone)
      const { data: existing } = await supabase
        .from("clients")
        .select("id, name")
        .eq("establishment_id", establishmentId)
        .or(`email.eq.${trimmedEmail},phone.eq.${formatPhoneBR(phone)}`)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error(`Já existe um cliente cadastrado (${existing[0].name})`, {
          position: "top-center",
          duration: 3000,
        });
        setSaving(false);
        return;
      }

      const { data: created, error } = await supabase
        .from("clients")
        .insert({
          establishment_id: establishmentId,
          name: trimmedName,
          phone: formatPhoneBR(phone),
          email: trimmedEmail,
        })
        .select("id, name, phone, email")
        .single();

      if (error) throw error;

      toast.success("Cliente cadastrado!", { position: "top-center", duration: 2000 });
      reset();
      onOpenChange(false);
      onCreated?.(created as any);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao cadastrar cliente", {
        position: "top-center",
        duration: 2500,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!saving) {
          onOpenChange(o);
          if (!o) reset();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Novo cliente (modo balcão)
          </DialogTitle>
          <DialogDescription>
            Cadastro rápido. O cliente poderá completar CPF, senha e termos no primeiro
            acesso ao portal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-client-name">Nome completo *</Label>
            <Input
              id="new-client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-client-phone">Telefone *</Label>
            <Input
              id="new-client-phone"
              value={phone}
              onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
              inputMode="tel"
              placeholder="(11) 91234-5678"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-client-email">E-mail *</Label>
            <Input
              id="new-client-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@exemplo.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              Necessário para que o cliente acesse o portal e complete o cadastro.
            </p>
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
                "Cadastrar cliente"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
