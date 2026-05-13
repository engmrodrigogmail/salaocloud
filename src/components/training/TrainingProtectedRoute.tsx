import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  children: ReactNode;
  requireMustChangePasswordCleared?: boolean;
}

export function TrainingProtectedRoute({ children, requireMustChangePasswordCleared = true }: Props) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [needsFirstAccess, setNeedsFirstAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) { setChecking(false); return; }

      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("training_vendor_profiles").select("must_change_password").eq("user_id", user.id).maybeSingle(),
      ]);

      if (cancelled) return;
      const rolesList = (roles ?? []).map((r: any) => r.role);
      const ok = rolesList.includes("sales_trainee") || rolesList.includes("super_admin");
      setAllowed(ok);
      setNeedsFirstAccess(
        rolesList.includes("sales_trainee") &&
        !rolesList.includes("super_admin") &&
        !!profile?.must_change_password
      );
      setChecking(false);
    };
    if (!loading) run();
    return () => { cancelled = true; };
  }, [user, loading]);

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/treinamento" replace />;
  if (!allowed) return <Navigate to="/hub" replace />;
  if (requireMustChangePasswordCleared && needsFirstAccess) {
    return <Navigate to="/treinamento/primeiro-acesso" replace />;
  }
  return <>{children}</>;
}
