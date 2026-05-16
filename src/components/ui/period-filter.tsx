import { useMemo } from "react";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  format,
} from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerBR } from "@/components/ui/date-picker-br";

export type PeriodKey =
  | "today"
  | "week"
  | "month"
  | "last_month"
  | "year"
  | "custom";

export interface PeriodRange {
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
  label: string;
}

export function computePeriodRange(
  period: PeriodKey,
  customFrom: string,
  customTo: string,
): PeriodRange {
  const today = new Date();
  let f: Date, t: Date;
  switch (period) {
    case "today":
      f = startOfDay(today);
      t = endOfDay(today);
      break;
    case "week":
      f = startOfWeek(today, { weekStartsOn: 0 });
      t = endOfWeek(today, { weekStartsOn: 0 });
      break;
    case "last_month": {
      const lm = subMonths(today, 1);
      f = startOfMonth(lm);
      t = endOfMonth(lm);
      break;
    }
    case "year":
      f = startOfYear(today);
      t = endOfYear(today);
      break;
    case "custom":
      f = new Date((customFrom || format(startOfMonth(today), "yyyy-MM-dd")) + "T00:00:00");
      t = new Date((customTo || format(endOfMonth(today), "yyyy-MM-dd")) + "T23:59:59");
      break;
    case "month":
    default:
      f = startOfMonth(today);
      t = endOfMonth(today);
      break;
  }
  return {
    from: f,
    to: t,
    fromIso: format(f, "yyyy-MM-dd"),
    toIso: format(t, "yyyy-MM-dd"),
    label: `${format(f, "dd/MM/yyyy")} – ${format(t, "dd/MM/yyyy")}`,
  };
}

interface PeriodFilterProps {
  period: PeriodKey;
  onPeriodChange: (v: PeriodKey) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
  triggerClassName?: string;
}

export function PeriodFilter({
  period,
  onPeriodChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  triggerClassName,
}: PeriodFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={period} onValueChange={(v) => onPeriodChange(v as PeriodKey)}>
        <SelectTrigger className={triggerClassName ?? "w-[160px]"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="week">Esta semana</SelectItem>
          <SelectItem value="month">Este mês</SelectItem>
          <SelectItem value="last_month">Mês passado</SelectItem>
          <SelectItem value="year">Este ano</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>
      {period === "custom" && (
        <div className="flex items-center gap-1">
          <DatePickerBR
            value={customFrom}
            onChange={onCustomFromChange}
            className="w-[160px]"
            placeholder="Início"
          />
          <span className="text-muted-foreground">–</span>
          <DatePickerBR
            value={customTo}
            onChange={onCustomToChange}
            className="w-[160px]"
            placeholder="Fim"
          />
        </div>
      )}
    </div>
  );
}

export function usePeriodRange(period: PeriodKey, customFrom: string, customTo: string) {
  return useMemo(
    () => computePeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );
}
