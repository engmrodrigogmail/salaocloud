import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTrialDays } from "@/hooks/useTrialDays";

export function FAQSection() {
  const { trialDays } = useTrialDays();

  const faqs = [
    {
      question: "Preciso pagar algo pra testar?",
      answer: `Nada! Você tem ${trialDays} dias grátis pra explorar todas as funcionalidades sem compromisso. Não pedimos cartão de crédito pra começar.`,
    },
    {
      question: "Consigo cancelar a qualquer momento?",
      answer: "Claro! Sem multa, sem burocracia. Você pode cancelar quando quiser direto pelo painel. A gente torce pra você ficar, mas entende se precisar ir.",
    },
    {
      question: "Meus clientes vão conseguir agendar sozinhos?",
      answer: "Com certeza! Você ganha uma página de agendamento exclusiva que pode compartilhar nas redes sociais, WhatsApp, onde quiser. Seus clientes agendam 24h por dia, sem você precisar atender telefone.",
    },
    {
      question: "Como funciona o sistema de comandas?",
      answer: "As comandas digitais permitem adicionar serviços e produtos durante o atendimento, aplicar descontos, dividir pagamentos em diferentes métodos e calcular comissões automaticamente. Tudo em tempo real!",
    },
    {
      question: "Posso controlar as comissões da minha equipe?",
      answer: "Sim! Você pode definir comissões por porcentagem ou valor fixo, criar regras específicas por serviço ou produto, e acompanhar os ganhos de cada profissional em relatórios detalhados.",
    },
    {
      question: "Como funciona o programa de fidelidade?",
      answer: "Você cria regras de pontos (ex: R$1 = 1 ponto) e define recompensas que os clientes podem resgatar. Tudo automático! O sistema acompanha os pontos de cada cliente.",
    },
    {
      question: "Funciona no celular?",
      answer: "100%! O Salão Cloud foi feito pensando em quem vive no celular. A área interna é otimizada para seus profissionais usarem no dia a dia, direto do smartphone.",
    },
    {
      question: "Preciso instalar alguma coisa?",
      answer: "Não precisa instalar nada! É tudo online. Você acessa pelo navegador do computador ou celular. Simples assim.",
    },
    {
      question: "E se eu tiver dúvidas ou problemas?",
      answer: "Nossa equipe de suporte está aqui pra ajudar! Você pode entrar em contato pelo chat de suporte ou WhatsApp. Além disso, o sistema tem tours guiados que ensinam a usar cada funcionalidade.",
    },
    {
      question: "Posso migrar meus dados de outro sistema?",
      answer: "Podemos te ajudar com isso! Entre em contato com nosso suporte que a gente vê a melhor forma de trazer seus dados pro Salão Cloud.",
    },
  ];

  return (
    <section id="faq" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">
            FAQ
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-6">
            Dúvidas? A gente responde!
          </h2>
          <p className="text-lg text-muted-foreground">
            Se não encontrar sua pergunta aqui, é só mandar pra gente.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card rounded-xl border border-border/50 px-6 data-[state=open]:shadow-md transition-shadow"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
