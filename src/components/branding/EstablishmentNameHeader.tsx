import { cn } from "@/lib/utils";
import salonBg from "@/assets/salon-dark-bg.png";

interface EstablishmentNameHeaderProps {
  name: string;
  subtitle?: string;
  className?: string;
}

/**
 * Cabeçalho padronizado para identificação do salão nas telas das clientes.
 * Tema Dark Premium: fundo fotográfico do salão com véu escuro, placa
 * translúcida com borda bronze e nome do salão em dourado responsivo.
 */
export function EstablishmentNameHeader({
  name,
  subtitle,
  className,
}: EstablishmentNameHeaderProps) {
  return (
    <header
      className={cn("w-full salon-photo-bg", className)}
      style={{ ['--salon-bg-image' as any]: `url(${salonBg})` }}
    >
      <div className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-7">
        <div className="rounded-xl border border-brand-copper/40 bg-black/55 backdrop-blur-md px-4 py-4 sm:px-8 sm:py-6 shadow-lg">
          <h1
            className="font-display font-bold tracking-tight text-center break-words leading-tight text-[clamp(1.25rem,5vw,2.25rem)]"
            style={{
              color: "hsl(var(--brand-gold))",
              textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            }}
          >
            {name}
          </h1>
          {subtitle && (
            <p className="mt-1 text-center text-xs sm:text-sm text-white/80 break-words">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
