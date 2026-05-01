import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Receipt,
  Coins,
  HelpCircle,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useInternoTour } from "@/hooks/useInternoTour";
import { ChangePasswordGate } from "@/components/auth/ChangePasswordGate";
import logo from "@/assets/logo-salaocloud-v5.png";
import salonBg from "@/assets/salon-dark-bg.png";

interface InternoLayoutProps {
  children: React.ReactNode;
}

export function InternoLayout({ children }: InternoLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [establishmentName, setEstablishmentName] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user, role, signOut } = useAuth();
  const { startTour } = useInternoTour();

  useEffect(() => {
    if (slug && user) {
      fetchEstablishment();
    }
  }, [slug, user]);

  const fetchEstablishment = async () => {
    const { data } = await supabase
      .from("establishments")
      .select("name, owner_id")
      .eq("slug", slug)
      .single();
    
    if (data) {
      setEstablishmentName(data.name);
      setIsOwner(data.owner_id === user?.id);
    }
  };

  const navItems = [
    { href: `/interno/${slug}`, label: "Painel", icon: LayoutDashboard },
    { href: `/interno/${slug}/agenda`, label: "Agenda", icon: Calendar },
    { href: `/interno/${slug}/comandas`, label: "Comandas", icon: Receipt },
    { href: `/interno/${slug}/comissoes`, label: "Minhas Comissões", icon: Coins },
    { href: `/interno/${slug}/perfil`, label: "Meu Perfil", icon: UserCircle },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <ChangePasswordGate>
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="fixed left-0 right-0 top-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button
            className="lg:hidden p-2"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Link to={`/interno/${slug}`} className="flex items-center gap-2">
            <img src={logo} alt="Salão Cloud" className="h-8 w-auto" />
            {establishmentName && (
              <span className="hidden sm:inline text-sm font-medium text-muted-foreground">
                | {establishmentName} - Interno
              </span>
            )}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  id="interno-tour-help-button"
                  variant="ghost"
                  size="icon"
                  onClick={startTour}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <HelpCircle size={20} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tour guiado</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Only show Portal Admin button to establishment owners and super_admin */}
          {(isOwner || role === "super_admin") && (
            <Button 
              id="portal-admin-button"
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/portal/${slug}`)}
            >
              Portal Admin
            </Button>
          )}
          
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
        className={`fixed left-0 bottom-0 top-16 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 z-40 ${
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
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors border-l-4 ${
                  isActive
                    ? "bg-gradient-to-r from-brand-copper/20 to-transparent text-brand-copper border-brand-copper"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-brand-copper border-transparent"
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
      <main
        className="lg:pl-64 pt-16 salon-photo-bg min-h-screen"
        style={{ ['--salon-bg-image' as any]: `url(${salonBg})` }}
      >
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
    </ChangePasswordGate>
  );
}
