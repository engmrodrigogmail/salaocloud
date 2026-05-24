import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronsUpDown, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  /** Texto principal exibido e usado na busca */
  label: string;
  /** Texto auxiliar (telefone, duração, preço) — exibido e indexado na busca */
  hint?: string;
  /** Nome do grupo. Quando informado, itens são agrupados e os grupos ordenados alfabeticamente */
  group?: string | null;
  /** Renderização customizada (opcional) — sobrescreve label/hint */
  render?: React.ReactNode;
  /** Texto adicional para busca, não exibido */
  keywords?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** Renderização customizada do valor selecionado no trigger */
  renderTrigger?: (option: SearchableSelectOption | undefined) => React.ReactNode;
  /** Permite limpar o valor (clicando num item sentinel "Nenhum") */
  allowClear?: boolean;
  clearLabel?: string;
  id?: string;
  /** Modo "combobox": trigger é um input editável que filtra enquanto digita.
   *  Ao focar/clicar abre a lista completa rolável. */
  typeable?: boolean;
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Selecione",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum resultado encontrado.",
  className,
  triggerClassName,
  disabled,
  renderTrigger,
  allowClear,
  clearLabel = "Nenhum",
  id,
  typeable,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const grouped = React.useMemo(() => {
    const map = new Map<string, SearchableSelectOption[]>();
    for (const opt of options) {
      const key = opt.group ?? "";
      const arr = map.get(key) ?? [];
      arr.push(opt);
      map.set(key, arr);
    }
    const groups = Array.from(map.entries()).map(([name, items]) => ({
      name,
      items: [...items].sort((a, b) => collator.compare(a.label, b.label)),
    }));
    groups.sort((a, b) => {
      // grupo vazio vai pro fim
      if (!a.name && b.name) return 1;
      if (a.name && !b.name) return -1;
      return collator.compare(a.name, b.name);
    });
    return groups;
  }, [options]);

  const selected = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  // Texto exibido no input quando em modo typeable e fechado
  const displayLabel = selected
    ? selected.hint
      ? `${selected.label} — ${selected.hint}`
      : selected.label
    : "";

  // Em typeable: enquanto aberto mostra `search`; fechado mostra label do selecionado
  const inputValue = typeable ? (open ? search : displayLabel) : "";

  const commandFilter = (itemValue: string, s: string) => {
    if (!s) return 1;
    return stripAccents(itemValue).includes(stripAccents(s)) ? 1 : 0;
  };

  const listContent = (
    <>
      <CommandList className="flex-1 min-h-0 max-h-none overflow-y-auto overscroll-contain">
        <CommandEmpty>{emptyText}</CommandEmpty>
        {allowClear && (
          <CommandGroup>
            <CommandItem
              value="__clear__ nenhum"
              onSelect={() => {
                onValueChange("");
                setSearch("");
                setOpen(false);
              }}
            >
              <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
              <span className="text-muted-foreground">{clearLabel}</span>
            </CommandItem>
          </CommandGroup>
        )}
        {grouped.map((g) => (
          <CommandGroup key={g.name || "__no_group__"} heading={g.name || undefined}>
            {g.items.map((opt) => {
              const searchValue = [opt.label, opt.hint, opt.keywords, g.name]
                .filter(Boolean)
                .join(" ");
              return (
                <CommandItem
                  key={opt.value}
                  value={searchValue}
                  disabled={opt.disabled}
                  onSelect={() => {
                    if (opt.disabled) return;
                    onValueChange(opt.value);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.render ?? (
                    <span className="flex flex-1 items-center justify-between gap-2 min-w-0">
                      <span className="truncate">{opt.label}</span>
                      {opt.hint && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {opt.hint}
                        </span>
                      )}
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </>
  );

  if (typeable) {
    return (
      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <Command
          shouldFilter
          filter={commandFilter}
          className="flex flex-col min-h-0 overflow-visible bg-transparent"
        >
          <PopoverAnchor asChild>
            <div
              className={cn(
                "relative flex h-10 w-full items-center rounded-md border border-input bg-background px-3 ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                disabled && "opacity-50 cursor-not-allowed",
                triggerClassName,
              )}
            >
              <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandPrimitive.Input
                id={id}
                ref={inputRef}
                disabled={disabled}
                value={inputValue}
                onValueChange={(v) => {
                  setSearch(v);
                  if (!open) setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onMouseDown={() => {
                  // ao reabrir, limpa filtro para exibir lista completa
                  if (!open) setSearch("");
                  setOpen(true);
                }}
                placeholder={selected ? displayLabel : placeholder}
                className="flex h-10 w-full bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed"
              />
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </div>
          </PopoverAnchor>
          <PopoverContent
            className={cn(
              "w-[--radix-popover-trigger-width] p-0 flex flex-col",
              "max-h-[min(60vh,var(--radix-popover-content-available-height,60vh))]",
              className,
            )}
            align="start"
            side="bottom"
            sideOffset={4}
            collisionPadding={8}
            avoidCollisions
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (inputRef.current && e.target instanceof Node && inputRef.current.contains(e.target)) {
                e.preventDefault();
              }
            }}
          >
            {listContent}
          </PopoverContent>
        </Command>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate text-left">
            {renderTrigger
              ? renderTrigger(selected)
              : selected
                ? selected.hint
                  ? `${selected.label} — ${selected.hint}`
                  : selected.label
                : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[--radix-popover-trigger-width] p-0 flex flex-col",
          "max-h-[min(70vh,var(--radix-popover-content-available-height,70vh))]",
          className,
        )}
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        avoidCollisions
      >
        <Command filter={commandFilter} className="flex flex-col min-h-0">
          <CommandInput placeholder={searchPlaceholder} />
          {listContent}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
