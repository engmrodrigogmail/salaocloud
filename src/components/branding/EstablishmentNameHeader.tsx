import { cn } from "@/lib/utils";

interface EstablishmentNameHeaderProps {
  name: string;
  subtitle?: string;
  className?: string;
}

/**
 * Cabeçalho padronizado para identificação do salão nas telas das clientes.
 * - Fundo preto com placa branca levemente esfumaçada (backdrop-blur)
 * - Nome do salão em dourado, responsivo, com quebra controlada
 * - Sem dependência de logo ou cores customizadas do estabelecimento
 */
export function EstablishmentNameHeader({
  name,
  subtitle,
  className,
}: EstablishmentNameHeaderProps) {
  return (
    <header
      className={cn(
        "w-full bg-black",
        className,
      )}
    >
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="rounded-xl border border-white/10 bg-white/10 backdrop-blur-md px-4 py-4 sm:px-8 sm:py-6 shadow-lg">
          <h1
            className="font-display font-bold tracking-tight text-center break-words leading-tight text-[clamp(1.25rem,5vw,2.25rem)]"
            style={{ color: "hsl(45 85% 60%)" }}
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
