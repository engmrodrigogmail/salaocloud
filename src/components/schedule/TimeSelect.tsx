import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimeSelectProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  minuteStep?: number;
}

/**
 * Custom in-app time picker (two selects) to avoid native Android picker
 * being clipped on small viewports.
 */
export function TimeSelect({ value, onChange, minuteStep = 5 }: TimeSelectProps) {
  const [hh = "", mm = ""] = (value || "").split(":");

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes: string[] = [];
  for (let m = 0; m < 60; m += minuteStep) minutes.push(String(m).padStart(2, "0"));
  // Ensure current minute is selectable even if not multiple of step
  if (mm && !minutes.includes(mm)) {
    minutes.push(mm);
    minutes.sort();
  }

  const update = (h: string, m: string) => {
    onChange(`${h || "00"}:${m || "00"}`);
  };

  return (
    <div className="flex gap-2">
      <Select value={hh} onValueChange={(v) => update(v, mm)}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {hours.map((h) => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={mm} onValueChange={(v) => update(hh, v)}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
