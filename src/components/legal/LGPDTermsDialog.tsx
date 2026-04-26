import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface LGPDTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept?: () => void;
}

export function LGPDTermsDialog({ open, onOpenChange, onAccept }: LGPDTermsDialogProps) {
  const handleAccept = () => {
    onAccept?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Termos de Uso e Política de Privacidade
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
            <p className="font-semibold text-foreground">
              Salão Cloud — Plataforma de Gestão para Salões de Beleza
            </p>

            <p>
              Ao realizar seu cadastro na plataforma Salão Cloud, você concorda com os
              presentes Termos de Uso e com nossa Política de Privacidade, elaborados em
              conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº
              13.709/2018).
            </p>

            <h3 className="font-semibold text-foreground pt-2">1. Quem Somos</h3>
            <p>
              O Salão Cloud é uma plataforma tecnológica que conecta clientes a salões de
              beleza e profissionais parceiros. Atuamos como operador dos dados pessoais
              coletados em nome dos estabelecimentos que utilizam nossa plataforma.
            </p>

            <h3 className="font-semibold text-foreground pt-2">2. Dados Coletados e Finalidade</h3>
            <p>Coletamos os seguintes dados estritamente necessários para a prestação dos serviços:</p>
            <p>
              — <strong>E-mail:</strong> utilizado como chave de identidade para unificar
              seu acesso em diferentes salões parceiros da plataforma e para envio de
              confirmações de agendamento e comunicações essenciais.
            </p>
            <p>
              — <strong>Nome completo e telefone:</strong> necessários para sua
              identificação pelo salão e para comunicação operacional, como lembretes de
              agendamento.
            </p>
            <p>
              — <strong>CPF (opcional):</strong> coletado exclusivamente para fins de
              emissão de nota fiscal pelo salão parceiro, quando aplicável.
            </p>
            <p>
              A base legal para esta coleta é o consentimento expresso da titular e a
              necessidade para execução de contrato, conforme o Art. 7º, incisos I e V da LGPD.
            </p>

            <h3 className="font-semibold text-foreground pt-2">3. Autonomia dos Salões Parceiros</h3>
            <p>
              Cada salão parceiro mantém um registro local e autônomo da cliente para fins
              operacionais de atendimento. Alterações realizadas por um salão em seus
              dados locais não afetam os registros de outros salões. Seu e-mail, utilizado
              como chave de identidade global, não pode ser alterado unilateralmente por
              nenhum salão.
            </p>

            <h3 className="font-semibold text-foreground pt-2">
              4. Compartilhamento de Histórico de Procedimentos
            </h3>
            <p>
              Se você autorizar expressamente por meio do checkbox específico no cadastro,
              seu histórico de procedimentos estéticos poderá ser visualizado por outros
              salões parceiros da plataforma Salão Cloud que você vier a visitar.
            </p>
            <p>
              Este compartilhamento é limitado a: nome do serviço realizado e data de
              execução. <strong>Nenhum dado financeiro é compartilhado</strong>, incluindo
              valores pagos, descontos ou formas de pagamento.{" "}
              <strong>
                O nome do estabelecimento onde o procedimento foi realizado também não é
                divulgado
              </strong>
              , preservando a confidencialidade comercial dos salões parceiros.
            </p>
            <p>
              O objetivo exclusivo deste compartilhamento é permitir que os profissionais
              calculem a frequência dos seus procedimentos e ofereçam um atendimento mais
              seguro e personalizado ao seu histórico capilar e estético.
            </p>
            <p>
              Você pode revogar este consentimento a qualquer momento através das opções
              de privacidade no seu perfil.
            </p>

            <h3 className="font-semibold text-foreground pt-2">5. Segurança e Armazenamento</h3>
            <p>
              Seus dados são armazenados em infraestrutura de nuvem segura, com
              criptografia em trânsito e em repouso. Adotamos medidas técnicas e
              administrativas para proteger seus dados pessoais contra acessos não
              autorizados e situações acidentais de perda, alteração ou divulgação.
            </p>

            <h3 className="font-semibold text-foreground pt-2">
              6. Seus Direitos como Titular dos Dados
            </h3>
            <p>Conforme o Art. 18 da LGPD, você tem direito de solicitar a qualquer momento:</p>
            <p>— Confirmação da existência de tratamento dos seus dados;</p>
            <p>— Acesso aos dados que mantém sobre você;</p>
            <p>— Correção de dados incompletos, inexatos ou desatualizados;</p>
            <p>
              — Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados
              em desconformidade com a lei;
            </p>
            <p>— Revogação do consentimento para o compartilhamento do histórico entre salões.</p>
            <p>
              As solicitações podem ser encaminhadas através das opções de privacidade
              disponíveis no seu perfil ou diretamente ao salão parceiro responsável pelo
              seu atendimento.
            </p>

            <h3 className="font-semibold text-foreground pt-2">7. Alterações nestes Termos</h3>
            <p>
              O Salão Cloud pode atualizar estes Termos periodicamente. Em caso de
              alterações relevantes, você será notificada por e-mail ou por aviso na
              plataforma. O uso continuado dos serviços após a notificação implica
              aceitação dos novos termos.
            </p>
          </div>
        </ScrollArea>

        {onAccept && (
          <div className="pt-4 border-t">
            <Button onClick={handleAccept} className="w-full bg-gradient-primary">
              Entendi e Aceito
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
