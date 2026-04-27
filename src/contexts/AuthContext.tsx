import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "super_admin" | "establishment" | "client" | "professional" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const authDebug = (event: string, payload?: Record<string, unknown>) => {
    console.info(`[AuthContextDebug] ${event}`, payload ?? {});
  };

  const fetchUserRole = async (userId: string) => {
    try {
      authDebug("fetch_role_start", { userId });
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[AuthContextDebug] fetch_role_error", error);
        return null;
      }
      authDebug("fetch_role_result", { role: data?.role ?? null });
      return data?.role as UserRole;
    } catch (err) {
      console.error("[AuthContextDebug] fetch_role_exception", err);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        authDebug("state_change", {
          event,
          hasSession: Boolean(session),
          userId: session?.user?.id ?? null,
          email: session?.user?.email ?? null,
        });
        setSession(session);
        setUser(session?.user ?? null);

        // Defer role fetching with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id).then(setRole);
          }, 0);
        } else {
          setRole(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      authDebug("get_session_result", {
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        error: error?.message ?? null,
      });
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id).then((r) => {
          setRole(r);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    authDebug("sign_in_start", { emailLength: email.length, passwordLength: password.length });
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    authDebug("sign_in_result", { ok: !error, error: error?.message ?? null });
    
    if (!error) {
      // Refetch role after sign in
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      authDebug("get_user_after_sign_in", {
        hasUser: Boolean(user),
        userId: user?.id ?? null,
        email: user?.email ?? null,
        error: userError?.message ?? null,
      });
      if (user) {
        const userRole = await fetchUserRole(user.id);
        setRole(userRole);
      }
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
