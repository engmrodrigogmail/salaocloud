import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Layout, 
  Users, 
  Scissors, 
  Calendar, 
  Gift, 
  Percent, 
  Settings, 
  DollarSign,
  ClipboardList,
  Globe,
  Home,
  Shield,
  Building2,
  CreditCard,
  MessageSquare,
  UserCog,
  Ticket,
  BarChart3
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PageInfo {
  route: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  features: string[];
  accessLevel: "public" | "authenticated" | "establishment" | "super_admin";
}

const publicPages: PageInfo[] = [
  {
    route: "/",
    name: "Landing Page",
    icon: <Home className="h-5 w-5" />,
    description: "Página inicial do SaaS com apresentação do produto, planos, FAQ e chat de suporte.",
    features: [
      "Hero section com CTA",
      "Seção de funcionalidades",
      "Tabela de preços dinâmica",
      "FAQ",
      "Depoimentos",
      "Chat de suporte com IA"
    ],
    accessLevel: "public"
  },
  {
    route: "/auth",
    name: "Autenticação",
    icon: <Shield className="h-5 w-5" />,
    description: "Página de login e cadastro para acesso ao sistema.",
    features: [
      "Login com email/senha",
      "Cadastro de novos usuários",
      "Recuperação de senha"
    ],
    accessLevel: "public"
  },
  {
    route: "/:slug",
    name: "Portal do Cliente",
    icon: <Globe className="h-5 w-5" />,
    description: "Página pública de agendamento para clientes do estabelecimento.",
    features: [
      "Visualização de serviços",
      "Seleção de profissional",
      "Agendamento online",
      "Confirmação por telefone"
    ],
    accessLevel: "public"
  },
  {
    route: "/termos",
    name: "Termos de Uso",
    icon: <ClipboardList className="h-5 w-5" />,
    description: "Página com os termos de uso da plataforma.",
    features: ["Termos legais do serviço"],
    accessLevel: "public"
  },
  {
    route: "/privacidade",
    name: "Política de Privacidade",
    icon: <Shield className="h-5 w-5" />,
    description: "Página com a política de privacidade e tratamento de dados.",
    features: ["Política LGPD", "Tratamento de dados"],
    accessLevel: "public"
  }
];

const portalPages: PageInfo[] = [
  {
    route: "/portal/:slug",
    name: "Dashboard",
    icon: <Layout className="h-5 w-5" />,
    description: "Painel principal com métricas e visão geral do estabelecimento.",
    features: [
      "Countdown de trial (se aplicável)",
      "Métricas de agendamentos",
      "Próximos atendimentos",
      "Estatísticas rápidas"
    ],
    accessLevel: "establishment"
  },
  {
    route: "/portal/:slug/agenda",
    name: "Agenda",
    icon: <Calendar className="h-5 w-5" />,
    description: "Gerenciamento completo da agenda de atendimentos.",
    features: [
      "Visualização por dia/semana",
      "Criação de agendamentos",
      "Bloqueio de horários",
      "Filtro por profissional"
    ],
    accessLevel: "establishment"
  },
  {
    route: "/portal/:slug/profissionais",
    name: "Profissionais",
    icon: <Users className="h-5 w-5" />,
    description: "Cadastro e gestão da equipe de profissionais.",
    features: [
      "Cadastro de profissionais",
      "Horários de trabalho individuais",
      "Atribuição de serviços",
      "Configuração de comissões"
    ],
    accessLevel: "establishment"
  },
  {
    route: "/portal/:slug/servicos",
    name: "Serviços",
    icon: <Scissors className="h-5 w-5" />,
    description: "Catálogo de serviços oferecidos pelo estabelecimento.",
    features: [
      "Cadastro de serviços",
      "Categorias",
      "Preços e durações",
      "Ativação/desativação"
    ],
    accessLevel: "establishment"
  },
  {
    route: "/portal/:slug/clientes",
    name: "Clientes",
    icon: <Users className="h-5 w-5" />,
    description: "Base de dados de clientes do estabelecimento.",
    features: [
      "Cadastro de clientes",
      "Histórico de atendimentos",
      "Dados de contato",
      "Notas e observações"
    ],
    accessLevel: "establishment"
  },
  {
    route: "/portal/:slug/fidelidade",
    name: "Fidelidade",
    icon: <Gift className="h-5 w-5" />,
    description: "Programa de fidelidade e recompensas para clientes.",
    features: [
      "Configuração de programa",
      "Regras de pontuação",
      "Recompensas disponíveis",
      "Saldo de pontos por cliente"
    ],
    accessLevel: "establishment"
  },
  {
    route: "/portal/:slug/promocoes",
    name: "Promoções",
    icon: <Percent className="h-5 w-5" />,
    description: "Gestão de promoções e descontos temporários.",
    features: [
      "Criação de promoções",
      "Período de validade",
      "Serviços aplicáveis",
      "Tipos de desconto"
    ],
    accessLevel: "establishment"
  },
  {
    route: "/portal/:slug/comissoes",
    name: "Comissões",
    icon: <DollarSign className="h-5 w-5" />,
    description: "Controle de comissões dos profissionais.",
    features: [
      "Regras de comissão",
      "Acompanhamento de ganhos",
      "Relatórios por período",
      "Desafios de vendas"
    ],
    accessLevel: "establishment"
  },
  {
    route: "/portal/:slug/configuracoes",
    name: "Configurações",
    icon: <Settings className="h-5 w-5" />,
    description: "Configurações gerais do estabelecimento.",
    features: [
      "Dados do estabelecimento",
      "Horários de funcionamento",
      "Métodos de pagamento",
      "Política de cancelamento"
    ],
    accessLevel: "establishment"
  }
];

const internoPages: PageInfo[] = [
  {
    route: "/interno/:slug",
    name: "Dashboard Interno",
    icon: <Layout className="h-5 w-5" />,
    description: "Painel de operações diárias do estabelecimento.",
    features: [
      "Visão rápida do dia",
      "Atendimentos em andamento",
      "Comandas abertas"
    ],
    accessLevel: "establishment"
  },
  {
    route: "/interno/:slug/agenda",
    name: "Agenda Operacional",
    icon: <Calendar className="h-5 w-5" />,
    description: "Agenda focada em operações do dia-a-dia.",
    features: [
      "Check-in de clientes",
      "Confirmação de chegada",
      "Gestão de fila"
    ],
    accessLevel: "establishment"
  },
  {
    route: "/interno/:slug/comandas",
    name: "Comandas",
    icon: <ClipboardList className="h-5 w-5" />,
    description: "Sistema de comandas para controle de consumo.",
    features: [
      "Abertura de comandas",
      "Adição de serviços/produtos",
      "Fechamento com múltiplos pagamentos",
      "Cálculo de comissões automático"
    ],
    accessLevel: "establishment"
  }
];

const adminPages: PageInfo[] = [
  {
    route: "/admin",
    name: "Dashboard Admin",
    icon: <BarChart3 className="h-5 w-5" />,
    description: "Painel administrativo com métricas gerais da plataforma.",
    features: [
      "Total de estabelecimentos",
      "Usuários ativos",
      "Métricas de conversão",
      "Receita do período"
    ],
    accessLevel: "super_admin"
  },
  {
    route: "/admin/establishments",
    name: "Estabelecimentos",
    icon: <Building2 className="h-5 w-5" />,
    description: "Gestão de todos os estabelecimentos cadastrados.",
    features: [
      "Lista de estabelecimentos",
      "Status de assinatura",
      "Impersonação (acessar como)",
      "Ativação/suspensão"
    ],
    accessLevel: "super_admin"
  },
  {
    route: "/admin/users",
    name: "Usuários",
    icon: <UserCog className="h-5 w-5" />,
    description: "Gestão de usuários da plataforma.",
    features: [
      "Lista de usuários",
      "Roles e permissões",
      "Dados de perfil"
    ],
    accessLevel: "super_admin"
  },
  {
    route: "/admin/plans",
    name: "Planos",
    icon: <CreditCard className="h-5 w-5" />,
    description: "Configuração dos planos de assinatura.",
    features: [
      "Criação de planos",
      "Preços e features",
      "Limites por plano",
      "Sincronização com Stripe"
    ],
    accessLevel: "super_admin"
  },
  {
    route: "/admin/coupons",
    name: "Cupons",
    icon: <Ticket className="h-5 w-5" />,
    description: "Gestão de cupons de desconto da plataforma.",
    features: [
      "Criação de cupons",
      "Tipos de desconto",
      "Limites de uso",
      "Validade"
    ],
    accessLevel: "super_admin"
  },
  {
    route: "/admin/stripe",
    name: "Stripe",
    icon: <CreditCard className="h-5 w-5" />,
    description: "Integração e sincronização com o Stripe.",
    features: [
      "Status de conexão",
      "Sincronização de planos",
      "Webhooks",
      "Logs de operações"
    ],
    accessLevel: "super_admin"
  },
  {
    route: "/admin/conversations",
    name: "Conversas",
    icon: <MessageSquare className="h-5 w-5" />,
    description: "Monitoramento do chat de suporte.",
    features: [
      "Conversas ativas",
      "Escalonamentos",
      "Métricas de atendimento",
      "Intervenção manual"
    ],
    accessLevel: "super_admin"
  },
  {
    route: "/admin/settings",
    name: "Configurações",
    icon: <Settings className="h-5 w-5" />,
    description: "Configurações gerais da plataforma.",
    features: [
      "Dias de trial",
      "Configurações globais",
      "Parâmetros do sistema"
    ],
    accessLevel: "super_admin"
  },
  {
    route: "/admin/portal-structure",
    name: "Estrutura do Portal",
    icon: <Layout className="h-5 w-5" />,
    description: "Documentação da estrutura de páginas do sistema.",
    features: [
      "Mapa de rotas",
      "Descrição de funcionalidades",
      "Níveis de acesso"
    ],
    accessLevel: "super_admin"
  }
];

function AccessBadge({ level }: { level: PageInfo["accessLevel"] }) {
  const config = {
    public: { label: "Público", variant: "secondary" as const },
    authenticated: { label: "Autenticado", variant: "outline" as const },
    establishment: { label: "Estabelecimento", variant: "default" as const },
    super_admin: { label: "Super Admin", variant: "destructive" as const }
  };

  return <Badge variant={config[level].variant}>{config[level].label}</Badge>;
}

function PageTable({ pages }: { pages: PageInfo[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[250px]">Página</TableHead>
          <TableHead>Rota</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Funcionalidades</TableHead>
          <TableHead className="text-right">Acesso</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pages.map((page) => (
          <TableRow key={page.route}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{page.icon}</span>
                {page.name}
              </div>
            </TableCell>
            <TableCell>
              <code className="bg-muted px-2 py-1 rounded text-sm">
                {page.route}
              </code>
            </TableCell>
            <TableCell className="max-w-[300px]">
              <span className="text-muted-foreground text-sm">
                {page.description}
              </span>
            </TableCell>
            <TableCell>
              <ul className="text-sm text-muted-foreground space-y-1">
                {page.features.slice(0, 3).map((feature, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-primary rounded-full" />
                    {feature}
                  </li>
                ))}
                {page.features.length > 3 && (
                  <li className="text-xs text-muted-foreground/70">
                    +{page.features.length - 3} mais...
                  </li>
                )}
              </ul>
            </TableCell>
            <TableCell className="text-right">
              <AccessBadge level={page.accessLevel} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function PortalStructure() {
  const totalPages = publicPages.length + portalPages.length + internoPages.length + adminPages.length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estrutura do Portal</h1>
          <p className="text-muted-foreground">
            Documentação completa de todas as páginas e funcionalidades do sistema
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Páginas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPages}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Páginas Públicas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{publicPages.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Páginas do Portal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{portalPages.length + internoPages.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Páginas Admin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminPages.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs with page categories */}
        <Card>
          <CardHeader>
            <CardTitle>Mapa de Páginas</CardTitle>
            <CardDescription>
              Navegue pelas diferentes áreas do sistema para ver detalhes de cada página
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="public" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="public">Públicas ({publicPages.length})</TabsTrigger>
                <TabsTrigger value="portal">Portal ({portalPages.length})</TabsTrigger>
                <TabsTrigger value="interno">Interno ({internoPages.length})</TabsTrigger>
                <TabsTrigger value="admin">Admin ({adminPages.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="public" className="mt-4">
                <div className="rounded-md border">
                  <PageTable pages={publicPages} />
                </div>
              </TabsContent>

              <TabsContent value="portal" className="mt-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Páginas acessíveis em <code className="bg-muted px-1 rounded">/portal/:slug/*</code> - 
                    Área de configuração e gestão do estabelecimento pelo proprietário.
                  </p>
                  <div className="rounded-md border">
                    <PageTable pages={portalPages} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="interno" className="mt-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Páginas acessíveis em <code className="bg-muted px-1 rounded">/interno/:slug/*</code> - 
                    Área de operações diárias (agenda, comandas, atendimento).
                  </p>
                  <div className="rounded-md border">
                    <PageTable pages={internoPages} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="admin" className="mt-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Páginas acessíveis em <code className="bg-muted px-1 rounded">/admin/*</code> - 
                    Área exclusiva do Super Admin para gestão da plataforma SaaS.
                  </p>
                  <div className="rounded-md border">
                    <PageTable pages={adminPages} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Architecture Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Arquitetura de Rotas</CardTitle>
            <CardDescription>
              Visão geral da estrutura de roteamento do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Rotas Públicas
                </h4>
                <p className="text-sm text-muted-foreground">
                  Acessíveis por qualquer visitante. Inclui landing page, autenticação e portal de agendamento dos clientes.
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded block">
                  /, /auth, /:slug, /termos, /privacidade
                </code>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Portal do Estabelecimento
                </h4>
                <p className="text-sm text-muted-foreground">
                  Área administrativa do estabelecimento. Configuração de serviços, profissionais, promoções e relatórios.
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded block">
                  /portal/:slug/*
                </code>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Área Interna
                </h4>
                <p className="text-sm text-muted-foreground">
                  Operações do dia-a-dia. Gestão de agenda, comandas e atendimentos em tempo real.
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded block">
                  /interno/:slug/*
                </code>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Super Admin
                </h4>
                <p className="text-sm text-muted-foreground">
                  Gestão da plataforma SaaS. Estabelecimentos, usuários, planos, cupons e integrações.
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded block">
                  /admin/*
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
