import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Scissors,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  UserCircle,
  Gift,
  Star,
  CreditCard,
  FolderKanban,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-salaocloud.png";

interface PortalLayoutProps {
  children: React.ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [establishmentName, setEstablishmentName] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user, signOut } = useAuth();
  const { isImpersonating } = useImpersonation();

  useEffect(() => {
    if (slug) {
      fetchEstablishment();
    }
  }, [slug]);

  const fetchEstablishment = async () => {
    const { data } = await supabase
      .from("establishments")
      .select("name")
      .eq("slug", slug)
      .single();
    
    if (data) {
      setEstablishmentName(data.name);
    }
  };

  const navItems = [
    { href: `/portal/${slug}`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/portal/${slug}/agenda`, label: "Agenda", icon: Calendar },
    { href: `/portal/${slug}/profissionais`, label: "Profissionais", icon: Users },
    { href: `/portal/${slug}/servicos`, label: "Serviços", icon: Scissors },
    { href: `/portal/${slug}/clientes`, label: "Clientes", icon: UserCircle },
    { href: `/portal/${slug}/categorias`, label: "Categorias", icon: FolderKanban },
    { href: `/portal/${slug}/fidelidade`, label: "Fidelidade", icon: Star },
    { href: `/portal/${slug}/promocoes`, label: "Promoções", icon: Gift },
    { href: `/portal/${slug}/cupons`, label: "Cupons", icon: CreditCard },
    { href: `/portal/${slug}/configuracoes`, label: "Configurações", icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Impersonation Banner */}
      <ImpersonationBanner />

      {/* Top bar */}
      <header className={`fixed left-0 right-0 h-16 bg-background border-b border-border z-50 flex items-center justify-between px-4 ${isImpersonating ? 'top-10' : 'top-0'}`}>
        <div className="flex items-center gap-4">
          <button
            className="lg:hidden p-2"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Link to={`/portal/${slug}`} className="flex items-center gap-2">
            <img src={logo} alt="Salão Cloud" className="h-8 w-auto" />
            {establishmentName && (
              <span className="hidden sm:inline text-sm font-medium text-muted-foreground">
                | {establishmentName}
              </span>
            )}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(`/interno/${slug}`)}
          >
            Área Interna
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white text-sm font-medium">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline truncate max-w-[150px]">{user?.email}</span>
                <ChevronDown size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate(`/portal/${slug}/configuracoes`)}>
                <Settings size={16} className="mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut size={16} className="mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 z-40 ${
          isImpersonating ? 'top-[104px]' : 'top-16'
        } ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className={`lg:pl-64 ${isImpersonating ? 'pt-[104px]' : 'pt-16'}`}>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
