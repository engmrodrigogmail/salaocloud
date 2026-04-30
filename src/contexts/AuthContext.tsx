import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "super_admin" | "establishment" | "client" | "professional";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  /** Papel principal (mais privilegiado) — mantido por retrocompatibilidade. */
  role: UserRole | null;
  /** Todos os papéis ativos do usuário. */
  roles: UserRole[];
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_PRIORITY: UserRole[] = ["super_admin", "establishment", "professional", "client"];

function pickPrimaryRole(roles: UserRole[]): UserRole | null {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRoles = async (userId: string): Promise<UserRole[]> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.error("Erro ao buscar papéis do usuário", error);
        return [];
      }
      const list = (data ?? []).map((r: any) => r.role as UserRole);
      // Inferir 'establishment' se for dono de algum salão (mesmo sem linha em user_roles)
      const { data: ownEst } = await supabase
        .from("establishments")
        .select("id")
        .eq("owner_id", userId)
        .limit(1);
      if (ownEst && ownEst.length > 0 && !list.includes("establishment")) {
        list.push("establishment");
      }
      return list;
    } catch (err) {
      console.error("Exceção ao buscar papéis", err);
      return [];
    }
  };

  const applyRoles = (list: UserRole[]) => {
    setRoles(list);
    setRole(pickPrimaryRole(list));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id).then(applyRoles);
          }, 0);
        } else {
          applyRoles([]);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRoles(session.user.id).then((list) => {
          applyRoles(list);
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
        data: { full_name: fullName },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const list = await fetchUserRoles(user.id);
        applyRoles(list);
      }
    }
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    applyRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, roles, loading, signUp, signIn, signOut }}>
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
