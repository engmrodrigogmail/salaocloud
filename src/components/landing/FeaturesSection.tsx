import { 
  Calendar, 
  Users, 
  Scissors, 
  BarChart3, 
  Clock, 
  Smartphone,
  CreditCard,
  Bell
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Agenda Inteligente",
    description: "Visualize e gerencie todos os agendamentos em um calendário visual e intuitivo. Nada de papel ou confusão!",
  },
  {
    icon: Users,
    title: "Gestão de Profissionais",
    description: "Cadastre sua equipe, defina especialidades e horários de trabalho de cada um. Tudo organizado!",
  },
  {
    icon: Scissors,
    title: "Catálogo de Serviços",
    description: "Monte seu cardápio de serviços com preços e duração. Seus clientes vão adorar a clareza!",
  },
  {
    icon: Smartphone,
    title: "Agendamento Online",
    description: "Seus clientes agendam pelo celular, 24 horas por dia. Você relaxa enquanto a agenda lota!",
  },
  {
    icon: Clock,
    title: "Histórico de Atendimentos",
    description: "Acompanhe todo o histórico de cada cliente. Preferências, serviços realizados e muito mais!",
  },
  {
    icon: BarChart3,
    title: "Relatórios Completos",
    description: "Acompanhe faturamento, serviços mais procurados e performance da equipe em tempo real.",
  },
  {
    icon: CreditCard,
    title: "Controle Financeiro",
    description: "Saiba quanto entra e sai. Comissões calculadas automaticamente para cada profissional.",
  },
  {
    icon: Bell,
    title: "Notificações",
    description: "Fique por dentro de novos agendamentos, cancelamentos e tudo que importa pro seu negócio.",
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
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
