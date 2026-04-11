import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Download, Smartphone, Loader2, UserPlus, AlertCircle, Info, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Contact {
  name: string;
  phone: string;
  email?: string;
}

interface ImportContactsDialogProps {
  establishmentId: string;
  onImportComplete: () => void;
}

// Check if Contact Picker API is supported
const isContactPickerSupported = () => {
  return "contacts" in navigator && "ContactsManager" in window;
};

export function ImportContactsDialog({ establishmentId, onImportComplete }: ImportContactsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"initial" | "instructions" | "select" | "importing">("initial");

  const handleSelectContacts = async () => {
    if (!isContactPickerSupported()) {
      toast.error("Seu navegador não suporta a importação de contatos. Use o Chrome no Android.");
      return;
    }

    setLoading(true);

    try {
      const props = ["name", "tel", "email"];
      const opts = { multiple: true };

      // @ts-ignore - Contact Picker API types
      const selectedContacts = await navigator.contacts.select(props, opts);

      if (!selectedContacts || selectedContacts.length === 0) {
        toast.info("Nenhum contato selecionado");
        setLoading(false);
        return;
      }

      const formattedContacts: Contact[] = selectedContacts
        .filter((contact: any) => contact.tel && contact.tel.length > 0)
        .map((contact: any) => ({
          name: contact.name?.[0] || "Sem nome",
          phone: contact.tel[0].replace(/\D/g, ""),
          email: contact.email?.[0] || undefined,
        }));

      if (formattedContacts.length === 0) {
        toast.error("Nenhum contato com telefone válido encontrado");
        setLoading(false);
        return;
      }

      setContacts(formattedContacts);
      setSelectedContacts(new Set(formattedContacts.map((_, i) => i)));
      setStep("select");
    } catch (error: any) {
      if (error.name === "InvalidStateError") {
        toast.error("A seleção de contatos foi cancelada");
      } else {
        console.error("Error selecting contacts:", error);
        toast.error("Erro ao selecionar contatos");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleContact = (index: number) => {
    setSelectedContacts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    if (selectedContacts.size === 0) {
      toast.error("Selecione pelo menos um contato");
      return;
    }

    setImporting(true);
    setStep("importing");

    try {
      const contactsToImport = contacts.filter((_, i) => selectedContacts.has(i));
      
      // Get all existing phones in one query
      const phones = contactsToImport.map(c => c.phone);
      const BATCH = 500;
      const existingPhones = new Set<string>();

      for (let i = 0; i < phones.length; i += BATCH) {
        const batch = phones.slice(i, i + BATCH);
        const { data } = await supabase
          .from("clients")
          .select("phone")
          .eq("establishment_id", establishmentId)
          .in("phone", batch);
        data?.forEach(r => existingPhones.add(r.phone));
      }

      const newContacts = contactsToImport
        .filter(c => !existingPhones.has(c.phone))
        .map(c => ({
          establishment_id: establishmentId,
          name: c.name,
          phone: c.phone,
          email: c.email || null,
        }));

      const skipped = contactsToImport.length - newContacts.length;
      let imported = 0;

      // Insert in batches
      for (let i = 0; i < newContacts.length; i += BATCH) {
        const batch = newContacts.slice(i, i + BATCH);
        const { error, data } = await supabase.from("clients").insert(batch).select("id");
        if (!error && data) {
          imported += data.length;
        }
      }

      if (imported > 0) {
        toast.success(`${imported} contato${imported > 1 ? "s" : ""} importado${imported > 1 ? "s" : ""} com sucesso!`);
      }
      if (skipped > 0) {
        toast.info(`${skipped} contato${skipped > 1 ? "s" : ""} já existente${skipped > 1 ? "s" : ""}`);
      }
      if (imported === 0 && skipped === 0) {
        toast.info("Nenhum contato para importar");
      }

      onImportComplete();
      handleClose();
    } catch (error) {
      console.error("Error importing contacts:", error);
      toast.error("Erro ao importar contatos");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setContacts([]);
    setSelectedContacts(new Set());
    setStep("initial");
  };

  const formatPhone = (phone: string) => {
    if (phone.length === 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    if (phone.length === 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return phone;
  };

  const supported = isContactPickerSupported();

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Importar Contatos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Importar Contatos
          </DialogTitle>
          <DialogDescription>
            Importe contatos diretamente do seu celular para a base de clientes
          </DialogDescription>
        </DialogHeader>

        {step === "initial" && (
          <div className="space-y-4 py-4">
            {supported ? (
              <>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <Smartphone className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Importar do Celular</p>
                    <p className="text-sm text-muted-foreground">
                      Selecione contatos da sua agenda e importe-os como clientes
                    </p>
                  </div>
                </div>

                <Button onClick={() => setStep("instructions")} className="w-full">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Selecionar Contatos
                </Button>
              </>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Não suportado</p>
                  <p className="text-sm text-muted-foreground">
                    A importação de contatos funciona apenas no <strong>Chrome para Android</strong>. 
                    Acesse esta página pelo seu celular Android para usar esta funcionalidade.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "instructions" && (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="font-medium text-blue-600 dark:text-blue-400">Como funciona:</p>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Na próxima tela, <strong>selecione os contatos desejados</strong> tocando em cada um</li>
                  <li>Toque em <strong>"Concluído"</strong> quando terminar</li>
                  <li>Depois você poderá revisar e usar <strong>"Selecionar todos"</strong> se precisar</li>
                </ol>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("initial")} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleSelectContacts} disabled={loading} className="flex-1">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                {loading ? "Aguardando..." : "Continuar"}
              </Button>
            </div>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div 
                className="flex items-center gap-3 cursor-pointer flex-1"
                onClick={toggleAll}
              >
                <Checkbox
                  checked={selectedContacts.size === contacts.length && contacts.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="font-medium">Selecionar todos</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedContacts.size}/{contacts.length}
              </span>
            </div>

            <ScrollArea className="h-[300px] rounded-lg border p-2">
              <div className="space-y-2">
                {contacts.map((contact, index) => (
                  <div
                    key={index}
                    onClick={() => toggleContact(index)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedContacts.has(index)
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-muted/50 border border-transparent hover:bg-muted"
                    }`}
                  >
                    <Checkbox
                      checked={selectedContacts.has(index)}
                      onCheckedChange={() => toggleContact(index)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{formatPhone(contact.phone)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={selectedContacts.size === 0} className="flex-1">
                Importar {selectedContacts.size > 0 && `(${selectedContacts.size})`}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Importando contatos...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
