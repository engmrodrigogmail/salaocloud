import { Button } from "@/components/ui/button";
import { HelpCircle, RotateCcw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TourTriggerButtonProps {
  onStartTour: () => void;
  variant?: "icon" | "full";
}

export function TourTriggerButton({ onStartTour, variant = "icon" }: TourTriggerButtonProps) {
  if (variant === "full") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onStartTour}
        className="gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        Refazer Tour Guiado
      </Button>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onStartTour}
            className="h-8 w-8"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Iniciar tour guiado</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
