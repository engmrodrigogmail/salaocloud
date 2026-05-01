import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ("super_admin" | "establishment" | "client" | "professional")[];
  requireRole?: boolean;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  requireRole = false 
}: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const { isImpersonating, impersonatedRole } = useImpersonation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Super admin can access any route when impersonating
  if (role === "super_admin" && isImpersonating && impersonatedRole) {
    // If impersonating, check if the impersonated role matches the allowed roles
    if (allowedRoles && allowedRoles.includes(impersonatedRole)) {
      return <>{children}</>;
    }
  }

  // Normal role-based access control
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Super admin can access everything
    if (role === "super_admin") {
      return <>{children}</>;
    }
    
    // Toda decisão de destino agora é centralizada no /hub
    return <Navigate to="/hub" replace />;
  }

  if (requireRole && !role) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
