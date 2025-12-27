import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

type ImpersonatedRole = "establishment" | "client" | "professional" | null;

interface ImpersonationContextType {
  impersonatedRole: ImpersonatedRole;
  isImpersonating: boolean;
  impersonatedEstablishmentId: string | null;
  startImpersonation: (role: ImpersonatedRole, establishmentId?: string) => void;
  stopImpersonation: () => void;
  effectiveRole: "super_admin" | "establishment" | "client" | "professional" | null;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { role: actualRole } = useAuth();
  const [impersonatedRole, setImpersonatedRole] = useState<ImpersonatedRole>(null);
  const [impersonatedEstablishmentId, setImpersonatedEstablishmentId] = useState<string | null>(null);

  const isImpersonating = actualRole === "super_admin" && impersonatedRole !== null;

  // The effective role is what the UI should use for rendering
  const effectiveRole = isImpersonating ? impersonatedRole : actualRole;

  const startImpersonation = useCallback((role: ImpersonatedRole, establishmentId?: string) => {
    if (actualRole !== "super_admin") {
      console.warn("Only super_admin can impersonate other roles");
      return;
    }
    setImpersonatedRole(role);
    if (establishmentId) {
      setImpersonatedEstablishmentId(establishmentId);
    }
  }, [actualRole]);

  const stopImpersonation = useCallback(() => {
    setImpersonatedRole(null);
    setImpersonatedEstablishmentId(null);
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedRole,
        isImpersonating,
        impersonatedEstablishmentId,
        startImpersonation,
        stopImpersonation,
        effectiveRole,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error("useImpersonation must be used within an ImpersonationProvider");
  }
  return context;
}
