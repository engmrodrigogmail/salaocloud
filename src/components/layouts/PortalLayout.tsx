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
  DollarSign,
  Crown,
  HelpCircle,
  Bot,
  MessageCircle,
  Package,
  Brain,
  Tag,
  ShieldCheck,
  Repeat,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  TrendingUp,
import { NotificationBell } from "@/components/notifications/NotificationBell";
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
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { supabase } from "@/integrations/supabase/client";
import { usePortalTour } from "@/hooks/usePortalTour";
import { useEduAccess } from "@/hooks/useEduAccess";
import logo from "@/assets/logo-salaocloud-v5.png";
import salonBg from "@/assets/salon-dark-bg.png";

interface PortalLayoutProps {
  children: React.ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [establishmentName, setEstablishmentName] = useState("");
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user, signOut } = useAuth();
  const { isImpersonating } = useImpersonation();
  const { startTour } = usePortalTour({ autoStart: true });
  const { isActive: eduActive } = useEduAccess(establishmentId);

  useEffect(() => {
    if (slug) {
      fetchEstablishment();
    }
  }, [slug]);

  const fetchEstablishment = async () => {
    const { data } = await supabase
      .from("establishments")
      .select("id, name")
      .eq("slug", slug)
      .single();
    
    if (data) {
      setEstablishmentName(data.name);
      setEstablishmentId(data.id);
    }
  };

  const navItems = [
    { href: `/portal/${slug}`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/portal/${slug}/agenda`, label: "Agenda", icon: Calendar },
    { href: `/portal/${slug}/profissionais`, label: "Profissionais", icon: Users },
    { href: `/portal/${slug}/servicos`, label: "Serviços", icon: Scissors },
    { href: `/portal/${slug}/produtos`, label: "Produtos", icon: Package },
    { href: `/portal/${slug}/clientes`, label: "Clientes", icon: UserCircle },
    { href: `/portal/${slug}/categorias`, label: "Categorias", icon: FolderKanban },
    { href: `/portal/${slug}/fidelidade`, label: "Fidelidade", icon: Star },
    { href: `/portal/${slug}/promocoes`, label: "Promoções", icon: Gift },
    { href: `/portal/${slug}/comissoes`, label: "Comissões", icon: DollarSign },
    { href: `/portal/${slug}/cupons`, label: "Cupons", icon: Tag },
    { href: `/portal/${slug}/assistente-ia`, label: "Assistente IA", icon: Bot },
    { href: `/portal/${slug}/conversas-ia`, label: "Conversas IA", icon: MessageCircle },
    { href: `/portal/${slug}/aprendizados-ia`, label: "Aprendizados IA", icon: Brain },
    ...(eduActive ? [{ href: `/portal/${slug}/edu`, label: "Consultor Edu", icon: Sparkles }] : []),
    { href: `/portal/${slug}/assinatura`, label: "Assinatura", icon: Crown },
    { href: `/portal/${slug}/auditoria`, label: "Auditoria", icon: ShieldCheck },
    { href: `/portal/${slug}/vitrine`, label: "Vitrine", icon: ImageIcon },
    { href: `/portal/${slug}/comunicacao`, label: "Comunicação", icon: MessageSquare },
    { href: `/portal/${slug}/configuracoes`, label: "Configurações", icon: Settings },
  ];

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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={startTour}
                  className="h-9 w-9"
                  id="tour-help-button"
                >
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tour guiado</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(`/interno/${slug}`)}
            id="internal-area-button"
          >
            Área Interna
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/hub")}
                  className="h-9 w-9"
                  aria-label="Trocar de área"
                >
                  <Repeat className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Trocar de área</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {establishmentId && (
            <NotificationBell
              recipientType="establishment"
              recipientId={establishmentId}
              pushScope="establishment"
            />
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
        <nav className="p-4 space-y-1 h-full overflow-y-auto">
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
