import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Testimonial {
  name: string;
  role: string;
  type: "client" | "business";
  rating: number;
  content: string;
  highlight: string;
}

const testimonials: Testimonial[] = [
  // Clientes de estabelecimentos
  {
    name: "Fernanda Oliveira",
    role: "Cliente há 2 anos",
    type: "client",
    rating: 5,
    content: "Gente, que maravilha! Agendo meus horários pelo celular em segundos, recebo lembrete no WhatsApp e nunca mais esqueci um compromisso. O salão que frequento virou outro depois que começou a usar!",
    highlight: "Agendamento rápido e lembretes automáticos"
  },
  {
    name: "Ricardo Santos",
    role: "Cliente frequente",
    type: "client",
    rating: 5,
    content: "A experiência de agendamento online transformou minha rotina. Consigo verificar a disponibilidade do meu barbeiro preferido e reservar o horário ideal sem precisar ligar. Extremamente prático e eficiente.",
    highlight: "Praticidade e controle total"
  },
  {
    name: "Juliana Mendes",
    role: "Cliente fidelizada",
    type: "client",
    rating: 5,
    content: "Adoro o programa de fidelidade! Junto pontos a cada visita e já resgatei várias hidratações grátis. Super vale a pena! Recomendo pra todas as minhas amigas.",
    highlight: "Programa de fidelidade que recompensa"
  },
  // Representantes de estabelecimentos
  {
    name: "Marcos Almeida",
    role: "Proprietário - Barbearia Premium",
    type: "business",
    rating: 5,
    content: "Cara, mudou TUDO no meu negócio! Antes eu vivia no telefone agendando cliente, agora eles marcam sozinhos e eu foco no que importa: atender bem. Minha agenda tá sempre cheia e organizada!",
    highlight: "Mais tempo para focar no atendimento"
  },
  {
    name: "Camila Rodrigues",
    role: "Gerente - Espaço Beleza & Bem-estar",
    type: "business",
    rating: 5,
    content: "A implementação do sistema proporcionou uma visão completa das operações do nosso estabelecimento. O controle de comissões é transparente, os relatórios são precisos e nossa equipe está muito mais motivada.",
    highlight: "Gestão profissional e equipe motivada"
  },
  {
    name: "André Nascimento",
    role: "Dono - Studio Hair Design",
    type: "business",
    rating: 5,
    content: "Reduzi 70% das faltas com os lembretes automáticos! As comandas ficaram muito mais organizadas e consigo acompanhar o faturamento em tempo real. Investimento que se paga no primeiro mês!",
    highlight: "Redução de faltas e controle financeiro"
  }
];

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating 
            ? "fill-yellow-400 text-yellow-400" 
            : "fill-muted text-muted"
        }`}
      />
    ))}
  </div>
);

const TestimonialCard = ({ testimonial }: { testimonial: Testimonial }) => {
  const initials = testimonial.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <Card className="h-full bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="p-6 flex flex-col h-full">
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h4 className="font-semibold text-foreground">{testimonial.name}</h4>
            <p className="text-sm text-muted-foreground">{testimonial.role}</p>
            <StarRating rating={testimonial.rating} />
          </div>
        </div>
        
        <blockquote className="flex-1 text-muted-foreground italic mb-4">
          "{testimonial.content}"
        </blockquote>
        
        <div className="pt-4 border-t border-border/50">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            <Star className="h-4 w-4 fill-primary" />
            {testimonial.highlight}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export const TestimonialsSection = () => {
  const clientTestimonials = testimonials.filter((t) => t.type === "client");
  const businessTestimonials = testimonials.filter((t) => t.type === "business");

  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 mb-4 text-sm font-medium bg-primary/10 text-primary rounded-full">
            Depoimentos
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Quem usa, <span className="text-primary">recomenda</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Veja o que clientes e donos de estabelecimentos falam sobre a experiência com nossa plataforma
          </p>
        </div>

        {/* Clientes */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <h3 className="text-xl font-semibold text-foreground whitespace-nowrap">
              💇 Clientes dos Estabelecimentos
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {clientTestimonials.map((testimonial, index) => (
              <TestimonialCard key={index} testimonial={testimonial} />
            ))}
          </div>
        </div>

        {/* Estabelecimentos */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <h3 className="text-xl font-semibold text-foreground whitespace-nowrap">
              🏪 Donos de Estabelecimentos
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {businessTestimonials.map((testimonial, index) => (
              <TestimonialCard key={index} testimonial={testimonial} />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl md:text-4xl font-bold text-primary mb-2">4.9</div>
            <div className="text-sm text-muted-foreground">Nota média</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-primary mb-2">+5.000</div>
            <div className="text-sm text-muted-foreground">Avaliações</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-primary mb-2">98%</div>
            <div className="text-sm text-muted-foreground">Satisfação</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-primary mb-2">+1.200</div>
            <div className="text-sm text-muted-foreground">Estabelecimentos</div>
          </div>
        </div>
      </div>
    </section>
  );
};
