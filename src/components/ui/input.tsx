import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, inputMode, ...props }, ref) => {
    const isNumeric =
      type === "number" ||
      inputMode === "decimal" ||
      inputMode === "numeric";

    const handleFocus: React.FocusEventHandler<HTMLInputElement> = (e) => {
      // Para inputs numéricos, seleciona o conteúdo ao focar para que o
      // valor pré-preenchido (ex.: "0") seja substituído ao digitar.
      if (isNumeric) {
        const el = e.currentTarget;
        // setTimeout garante seleção em mobile (Android/iOS) onde o foco
        // pode resetar a seleção logo após o evento.
        setTimeout(() => {
          try {
            el.select();
          } catch {
            /* alguns tipos de input não suportam select() */
          }
        }, 0);
      }
      onFocus?.(e);
    };

    return (
      <input
        type={type}
        inputMode={inputMode}
        className={cn(
          "relative z-20 pointer-events-auto touch-auto flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground caret-primary ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onFocus={handleFocus}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
