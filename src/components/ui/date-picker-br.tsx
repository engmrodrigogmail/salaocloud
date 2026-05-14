import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerBRProps {
  /** ISO date string `yyyy-MM-dd` (or empty). */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** ISO `yyyy-MM-dd` */
  min?: string;
  /** ISO `yyyy-MM-dd` */
  max?: string;
  id?: string;
}

const ISO = "yyyy-MM-dd";

function isoToDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const d = parse(v, ISO, new Date());
  return isValid(d) ? d : undefined;
}

/**
 * Reusable date picker (Brazilian format) backed by shadcn Calendar inside a Popover.
 * Drop-in replacement for `<Input type="date" value onChange />`.
 * - Display: dd/MM/yyyy (pt-BR)
 * - State value: ISO `yyyy-MM-dd` (same as native date input)
 */
export function DatePickerBR({
  value,
  onChange,
  placeholder = "Selecionar data",
  className,
  disabled,
  min,
  max,
  id,
}: DatePickerBRProps) {
  const date = isoToDate(value);
  const minDate = isoToDate(min) ?? new Date("2020-01-01");
  const maxDate = isoToDate(max);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {date ? format(date, "dd/MM/yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (!d) {
              onChange("");
              return;
            }
            onChange(format(d, ISO));
          }}
          locale={ptBR}
          defaultMonth={date ?? new Date()}
          disabled={(d) => {
            if (minDate && d < minDate) return true;
            if (maxDate && d > maxDate) return true;
            return false;
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
