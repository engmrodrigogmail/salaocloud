import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Building2,
  UserCircle,
  Gift,
  Ticket,
  Star,
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
import logo from "@/assets/logo.webp";
import salonBg from "@/assets/salon-dark-bg.png";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/agenda", label: "Agenda", icon: Calendar },
  { href: "/dashboard/profissionais", label: "Profissionais", icon: Users },
  { href: "/dashboard/servicos", label: "Serviços", icon: Scissors },
  { href: "/dashboard/clientes", label: "Clientes", icon: UserCircle },
  { href: "/dashboard/fidelidade", label: "Fidelidade", icon: Star },
  { href: "/dashboard/promocoes", label: "Promoções", icon: Gift },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isImpersonating } = useImpersonation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Impersonation Banner */}
      <ImpersonationBanner />

      {/* Top bar */}
      <header className={`fixed left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4 ${isImpersonating ? 'top-10' : 'top-0'}`}>
        <div className="flex items-center gap-4">
          <button
            className="lg:hidden p-2"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src={logo} alt="Salão Cloud" className="h-8 w-auto" />
          </Link>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white text-sm font-medium">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline">{user?.email}</span>
              <ChevronDown size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => navigate("/dashboard/configuracoes")}>
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
        className={`lg:pl-64 ${isImpersonating ? 'pt-[104px]' : 'pt-16'} salon-photo-bg min-h-screen`}
        style={{ ['--salon-bg-image' as any]: `url(${salonBg})` }}
      >
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
