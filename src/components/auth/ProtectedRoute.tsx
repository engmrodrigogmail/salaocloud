import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ("super_admin" | "establishment" | "client")[];
  requireRole?: boolean;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  requireRole = false 
}: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

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

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to appropriate dashboard based on role
    if (role === "super_admin") {
      return <Navigate to="/admin" replace />;
    } else if (role === "establishment") {
      return <Navigate to="/dashboard" replace />;
    } else if (role === "client") {
      return <Navigate to="/meus-agendamentos" replace />;
    }
    return <Navigate to="/" replace />;
  }

  if (requireRole && !role) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
