import { 
  Calendar, 
  Users, 
  Scissors, 
  BarChart3, 
  Clock, 
  Smartphone,
  CreditCard,
  MessageSquare,
  Gift,
  Percent,
  Receipt,
  HelpCircle
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Agenda Inteligente",
    description: "Visualize e gerencie todos os agendamentos em um calendário visual e intuitivo. Bloqueie horários, confirme atendimentos e evite conflitos.",
  },
  {
    icon: Smartphone,
    title: "Agendamento Online",
    description: "Seus clientes agendam pelo celular, 24 horas por dia. Compartilhe seu link exclusivo nas redes sociais e WhatsApp!",
  },
  {
    icon: Users,
    title: "Gestão de Profissionais",
    description: "Cadastre sua equipe, defina especialidades, horários de trabalho individuais e acompanhe a performance de cada um.",
  },
  {
    icon: Scissors,
    title: "Catálogo de Serviços",
    description: "Monte seu cardápio de serviços com categorias, preços e duração. Organize por especialidade para facilitar a escolha.",
  },
  {
    icon: Receipt,
    title: "Comandas Digitais",
    description: "Controle total das comandas! Adicione serviços, produtos, aplique descontos e finalize pagamentos de forma rápida e organizada.",
  },
  {
    icon: CreditCard,
    title: "Comissões Automáticas",
    description: "Comissões calculadas automaticamente por serviço ou produto. Configure regras personalizadas e acompanhe os ganhos da equipe.",
  },
  {
    icon: Gift,
    title: "Programa de Fidelidade",
    description: "Crie programas de pontos e recompensas para seus clientes. Aumente a retenção e transforme clientes em fãs!",
  },
  {
    icon: Percent,
    title: "Promoções e Cupons",
    description: "Crie promoções por período e cupons de desconto. Atraia novos clientes e incentive retornos com ofertas especiais.",
  },
  {
    icon: MessageSquare,
    title: "Lembretes por WhatsApp",
    description: "Envie lembretes automáticos de agendamento por WhatsApp. Reduza faltas e mantenha sua agenda sempre cheia!",
  },
  {
    icon: Clock,
    title: "Histórico Completo",
    description: "Acompanhe todo o histórico de cada cliente: serviços realizados, preferências, gastos e frequência de visitas.",
  },
  {
    icon: BarChart3,
    title: "Relatórios e Métricas",
    description: "Acompanhe faturamento, serviços mais procurados, performance da equipe e métricas importantes do seu negócio.",
  },
  {
    icon: HelpCircle,
    title: "Tour Guiado",
    description: "Sistema intuitivo com tour interativo para novos usuários. Sua equipe aprende a usar em minutos, sem treinamento complicado.",
  },
];

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">
            Funcionalidades
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-6">
            Tudo que você precisa pra{" "}
            <span className="text-gradient-primary">bombar seu salão</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Ferramentas poderosas, interface amigável. Feito por quem entende do ramo.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title + index}
              className="group p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="text-white" size={24} />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
