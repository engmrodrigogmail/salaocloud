import { createContext, useContext, ReactNode } from "react";
import { usePortalTour } from "@/hooks/usePortalTour";

interface PortalTourContextType {
  startTour: () => void;
  resetTour: () => void;
  isTourActive: boolean;
  isTourCompleted: boolean;
}

const PortalTourContext = createContext<PortalTourContextType | null>(null);

export function usePortalTourContext() {
  const context = useContext(PortalTourContext);
  if (!context) {
    throw new Error("usePortalTourContext must be used within PortalTourProvider");
  }
  return context;
}

interface PortalTourProviderProps {
  children: ReactNode;
}

export function PortalTourProvider({ children }: PortalTourProviderProps) {
  const tour = usePortalTour({ autoStart: true });

  return (
    <PortalTourContext.Provider value={tour}>
      {children}
    </PortalTourContext.Provider>
  );
}
