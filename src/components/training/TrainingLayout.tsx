import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { GraduationCap, LayoutDashboard, User, Settings, LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props { children: ReactNode; }

export function TrainingLayout({ children }: Props) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, isAdmin: false });

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const [{ data: roles }, { count: total }, { count: done }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("training_modules").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("training_user_progress").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
      ]);
      const isAdmin = !!(roles ?? []).find((r: any) => r.role === "super_admin");
      setProgress({ done: done ?? 0, total: total ?? 0, isAdmin });
    };
    load();
  }, [user, loc.pathname]);

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const nav = [
    { to: "/treinamento/dashboard", label: "Módulos", icon: LayoutDashboard },
    { to: "/treinamento/perfil", label: "Meu Perfil", icon: User },
    ...(progress.isAdmin ? [{ to: "/treinamento/admin", label: "Gerenciar", icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="font-display font-bold">Portal de Treinamento</span>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-xs text-muted-foreground">{progress.done}/{progress.total} módulos</div>
            <Progress value={pct} className="w-32 h-2" />
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/treinamento"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className={cn(
          "fixed md:sticky top-14 z-30 bg-background border-r h-[calc(100vh-3.5rem)] w-64 transition-transform",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}>
          <nav className="p-3 space-y-1">
            {nav.map((n) => {
              const active = loc.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
            <Button variant="ghost" size="sm" className="w-full justify-start mt-4 md:hidden" onClick={async () => { await signOut(); navigate("/treinamento"); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </nav>
        </aside>
        <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
