import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, PartyPopper, ArrowRight } from "lucide-react";
import silviaAvatar from "@/assets/silvia-avatar.png";

const KEY_PREFIX = "portal_welcome_shown_v1_";

interface Props {
  slug?: string;
  establishmentName?: string;
}

/**
 * Boas-vindas de primeiro acesso ao Portal do dono.
 * Etapa 1: mensagem de boas-vindas.
 * Etapa 2: convite para conversar com a Silvia (assistente virtual)
 * que conduz o passo a passo dos cadastros básicos.
 * Aparece UMA única vez por salão (chave por slug em localStorage).
 */
export function FirstAccessWelcome({ slug, establishmentName }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const storageKey = slug ? `${KEY_PREFIX}${slug}` : null;

  useEffect(() => {
    if (!storageKey) return;
    if (localStorage.getItem(storageKey) === "true") return;
    // pequeno delay para o layout montar
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [storageKey]);

  const markDone = () => {
    if (storageKey) localStorage.setItem(storageKey, "true");
    setOpen(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) markDone();
    setOpen(next);
  };

  const openSilvia = () => {
    markDone();
    // pequeno delay para garantir que o modal fechou antes do painel da Silvia abrir
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("silvia:open-onboarding"));
    }, 150);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 overflow-hidden">
        {step === 1 ? (
          <div className="p-6 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <PartyPopper className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">
                Seja bem-vindo(a) ao Salão Cloud!
              </h2>
              <p className="text-sm text-muted-foreground">
                {establishmentName
                  ? `Que bom ter você e a equipe do ${establishmentName} por aqui.`
                  : "Que bom ter você por aqui."}{" "}
                Este é o painel onde você organiza agenda, equipe, financeiro e
                tudo que o seu salão precisa para operar.
              </p>
            </div>
            <p className="text-sm">
              Em poucos minutos seu sistema já estará pronto para receber os
              primeiros agendamentos. Vamos juntos?
            </p>
            <Button onClick={() => setStep(2)} className="w-full" size="lg">
              Vamos começar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <button
              onClick={markDone}
              className="text-xs text-muted-foreground hover:underline"
            >
              Prefiro explorar sozinho(a)
            </button>
          </div>
        ) : (
          <div className="p-6 text-center space-y-4">
            <img
              src={silviaAvatar}
              alt="Silvia"
              className="mx-auto h-20 w-20 rounded-full object-cover ring-4 ring-primary/15"
            />
            <div className="space-y-1">
              <h2 className="text-xl font-semibold flex items-center justify-center gap-1">
                Conheça a Silvia
                <Sparkles className="h-4 w-4 text-primary" />
              </h2>
              <p className="text-sm text-muted-foreground">
                Sua assistente virtual do Salão Cloud. Ela te guia, tela a
                tela, nos cadastros básicos para o sistema funcionar:
                profissionais, serviços, horários, formas de pagamento e os
                primeiros ajustes.
              </p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3 text-left text-sm">
              <p className="font-medium mb-1">A Silvia vai te ajudar a:</p>
              <ul className="space-y-1 text-muted-foreground list-disc pl-5">
                <li>Cadastrar profissionais e horários</li>
                <li>Cadastrar serviços e preços</li>
                <li>Configurar formas de pagamento</li>
                <li>Personalizar a página pública do salão</li>
              </ul>
            </div>
            <Button onClick={openSilvia} className="w-full" size="lg">
              Falar com a Silvia agora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <button
              onClick={markDone}
              className="text-xs text-muted-foreground hover:underline"
            >
              Depois, quero explorar sozinho(a)
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
