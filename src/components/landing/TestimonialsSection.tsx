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
    content: "Gente, que maravilha! Agendo meus horários pelo celular em segundos e nunca mais perdi um compromisso. O salão que frequento virou outro depois que começou a usar!",
    highlight: "Agendamento rápido e prático"
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
    content: "As comandas ficaram muito mais organizadas e consigo acompanhar o faturamento em tempo real. Investimento que se paga no primeiro mês!",
    highlight: "Controle financeiro em tempo real"
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
    <Card className="h-full bg-card border border-border hover:border-primary/40 transition-all duration-300 rounded-sm shadow-none">
      <CardContent className="p-6 flex flex-col h-full">
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h4 className="font-semibold text-foreground">{testimonial.name}</h4>
            <p className="text-xs text-muted-foreground mb-1">{testimonial.role}</p>
            <StarRating rating={testimonial.rating} />
          </div>
        </div>

        <blockquote className="flex-1 text-muted-foreground italic text-sm leading-relaxed">
          "{testimonial.content}"
        </blockquote>

        <div className="pt-4 mt-4 border-t border-border">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
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
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-semibold text-primary uppercase tracking-premium">
            Depoimentos
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mt-5 mb-5 text-foreground">
            Quem usa, <span className="text-primary">recomenda</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            Veja o que clientes e donos de estabelecimentos falam sobre nossa plataforma.
          </p>
        </div>

        {/* Clientes */}
        <div className="mb-14">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-premium mb-6 text-center">
            Clientes dos Estabelecimentos
          </h3>
          <div className="grid md:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {clientTestimonials.map((testimonial, index) => (
              <TestimonialCard key={index} testimonial={testimonial} />
            ))}
          </div>
        </div>

        {/* Estabelecimentos */}
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-premium mb-6 text-center">
            Donos de Estabelecimentos
          </h3>
          <div className="grid md:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {businessTestimonials.map((testimonial, index) => (
              <TestimonialCard key={index} testimonial={testimonial} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
