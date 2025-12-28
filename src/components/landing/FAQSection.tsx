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
      question: "Funciona no celular?",
      answer: "100%! O Salão Cloud foi feito pensando em quem vive no celular. Tanto você quanto seus clientes podem usar pelo smartphone sem problema nenhum.",
    },
    {
      question: "Preciso instalar alguma coisa?",
      answer: "Não precisa instalar nada! É tudo online. Você acessa pelo navegador do computador ou celular. Simples assim.",
    },
    {
      question: "E se eu tiver dúvidas ou problemas?",
      answer: "Nossa equipe de suporte está aqui pra ajudar! Dependendo do seu plano, você tem atendimento por email, chat e até um gerente de conta dedicado.",
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
