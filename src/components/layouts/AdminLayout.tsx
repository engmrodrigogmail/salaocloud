import { useState } from "react";
import { Activity } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Shield,
  Ticket,
  Package,
  CreditCard,
  Eye,
  UserCircle,
  MessageCircle,
  Layout,
  BookOpen,
  MessageSquare as WhatsAppIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import logo from "@/assets/logo.webp";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/establishments", label: "Estabelecimentos", icon: Building2 },
  { href: "/admin/users", label: "Usuários", icon: Users },
  { href: "/admin/coupons", label: "Cupons", icon: Ticket },
  { href: "/admin/plans", label: "Planos", icon: Package },
  { href: "/admin/stripe", label: "Stripe", icon: CreditCard },
  { href: "/admin/conversations", label: "Conversas", icon: MessageCircle },
  { href: "/admin/portal-structure", label: "Estrutura do Portal", icon: Layout },
  { href: "/admin/integration-guides", label: "Guias de Integração", icon: BookOpen },
  { href: "/admin/zapi-status", label: "Status Z-API", icon: Activity },
  { href: "/admin/whatsapp-test", label: "Teste WhatsApp", icon: WhatsAppIcon },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { startImpersonation } = useImpersonation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleImpersonate = (role: "establishment" | "client") => {
    startImpersonation(role);
    if (role === "establishment") {
      navigate("/dashboard");
    } else if (role === "client") {
      navigate("/meus-agendamentos");
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-background border-b border-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button
            className="lg:hidden p-2"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Link to="/admin" className="flex items-center gap-2">
            <img src={logo} alt="Salão Cloud" className="h-8 w-auto" />
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              <Shield size={12} />
              Admin
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Impersonation Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Eye size={16} />
                <span className="hidden sm:inline">Ver como</span>
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Visualizar perfil como:</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => handleImpersonate("establishment")}>
                  <Building2 size={16} className="mr-2" />
                  Estabelecimento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleImpersonate("client")}>
                  <UserCircle size={16} className="mr-2" />
                  Cliente
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Dropdown */}
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
              <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
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
        className={`fixed top-16 left-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 z-40 ${
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
      <main className="pt-16 lg:pl-64">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
