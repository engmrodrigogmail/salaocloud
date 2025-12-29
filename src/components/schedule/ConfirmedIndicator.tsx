import { cn } from "@/lib/utils";

interface ConfirmedIndicatorProps {
  isConfirmed: boolean;
  className?: string;
}

export function ConfirmedIndicator({ isConfirmed, className }: ConfirmedIndicatorProps) {
  if (!isConfirmed) return null;
  
  return (
    <span 
      className={cn(
        "inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse",
        "shadow-[0_0_8px_2px_rgba(34,197,94,0.6)]",
        className
      )}
      title="Confirmado via WhatsApp"
    />
  );
}
