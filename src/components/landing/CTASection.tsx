import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-sm border border-primary/20 bg-card p-12 md:p-16 text-center">
          <div className="relative z-10 max-w-3xl mx-auto">
            <span className="text-xs font-semibold text-primary uppercase tracking-premium">
              Pronto para começar?
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mt-5 mb-5">
              Bora transformar seu <span className="text-primary">salão</span>?
            </h2>
            <p className="text-base md:text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Você e um sistema feito sob medida para facilitar a sua rotina e encantar seus clientes.
            </p>
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold uppercase tracking-premium px-10 h-12 rounded-sm text-xs group"
              asChild
            >
              <Link to="/auth?mode=signup">
                Contratar Agora
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
