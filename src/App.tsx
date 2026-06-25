import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Hub from "./pages/Hub";
import Onboarding from "./pages/Onboarding";
import OnboardingAwaitingPayment from "./pages/OnboardingAwaitingPayment";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import ClientPortal from "./pages/client/ClientPortal";
import ClientReviewSubmit from "./pages/client/ReviewSubmit";
import ClientLogin from "./pages/ClientLogin";
import ClientResetPassword from "./pages/ClientResetPassword";
import OwnerResetPassword from "./pages/OwnerResetPassword";
import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";

// Admin Pages (SaaS Super Admin)
import AdminDashboard from "./pages/admin/Dashboard";
import AdminEstablishments from "./pages/admin/Establishments";
import AdminUsers from "./pages/admin/Users";
import AdminCoupons from "./pages/admin/Coupons";
import AdminPlans from "./pages/admin/Plans";
import AdminStripe from "./pages/admin/Stripe";
import AdminSettings from "./pages/admin/Settings";
import AdminConversations from "./pages/admin/Conversations";
import AdminPortalStructure from "./pages/admin/PortalStructure";
import AdminIntegrationGuides from "./pages/admin/IntegrationGuides";
import AdminCommunications from "./pages/admin/Communications";

// Portal Pages (Establishment Admin - configuration & settings)
import PortalDashboard from "./pages/portal/Dashboard";
import PortalServices from "./pages/portal/Services";
import PortalProducts from "./pages/portal/Products";
import PortalProfessionals from "./pages/portal/Professionals";
import PortalClients from "./pages/portal/Clients";
import PortalClientDetail from "./pages/portal/ClientDetail";
import PortalLoyalty from "./pages/portal/Loyalty";
import PortalPromotions from "./pages/portal/Promotions";
import PortalCoupons from "./pages/portal/Coupons";
import PortalSettings from "./pages/portal/Settings";
import PortalCommissions from "./pages/portal/Commissions";
import PortalFinanceiro from "./pages/portal/Financeiro";
import PortalSubscription from "./pages/portal/Subscription";
import PortalAuditOverrides from "./pages/portal/AuditOverrides";
import PortalReviews from "./pages/portal/Reviews";
import PortalShowcase from "./pages/portal/Showcase";
import PortalCommunications from "./pages/portal/Communications";
// Interno Pages (Establishment Internal - operations)
import InternoDashboard from "./pages/interno/Dashboard";
import InternoAgenda from "./pages/interno/Agenda";
import InternoComandas from "./pages/interno/Comandas";
import InternoComissoes from "./pages/interno/Comissoes";
import InternoPerfil from "./pages/interno/Perfil";

// Portal Agenda & AI
import PortalAgenda from "./pages/portal/Agenda";
import PortalAIAssistant from "./pages/portal/AIAssistant";
import PortalAIConversations from "./pages/portal/AIConversations";
import PortalAILearnings from "./pages/portal/AILearnings";

// Admin AI
import AdminAIAddon from "./pages/admin/AIAddon";
import AdminEdu from "./pages/admin/Edu";

// Portal Edu
import PortalEdu from "./pages/portal/Edu";

// Treinamento (Vendedores)
import TrainingLogin from "./pages/treinamento/Login";
import TrainingPrimeiroAcesso from "./pages/treinamento/PrimeiroAcesso";
import TrainingRecuperar from "./pages/treinamento/RecuperarSenha";
import TrainingResetar from "./pages/treinamento/ResetarSenha";
import TrainingDashboard from "./pages/treinamento/Dashboard";
import TrainingPerfil from "./pages/treinamento/Perfil";
import TrainingModulo from "./pages/treinamento/Modulo";
import TrainingAdmin from "./pages/treinamento/Admin";
import { TrainingProtectedRoute } from "./components/training/TrainingProtectedRoute";
import { SubscriptionGate } from "./components/auth/SubscriptionGate";
import SubscriptionExpired from "./pages/SubscriptionExpired";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ImpersonationProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/hub" element={<Hub />} />
              <Route path="/cliente" element={<ClientLogin />} />
              <Route path="/cliente/redefinir-senha" element={<ClientResetPassword />} />
              <Route path="/redefinir-senha" element={<OwnerResetPassword />} />
              <Route path="/instalar" element={<Install />} />
              <Route path="/install" element={<Install />} />
              <Route path="/termos" element={<Termos />} />
              <Route path="/privacidade" element={<Privacidade />} />

              {/* Onboarding */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/onboarding/aguardando"
                element={
                  <ProtectedRoute>
                    <OnboardingAwaitingPayment />
                  </ProtectedRoute>
                }
              />

              {/* Super Admin routes (SaaS administration) */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/establishments"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminEstablishments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/coupons"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminCoupons />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/plans"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminPlans />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/stripe"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminStripe />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/conversations"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminConversations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/portal-structure"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminPortalStructure />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/integration-guides"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminIntegrationGuides />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ai-addon"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminAIAddon />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/comunicacao"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminCommunications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/edu"
                element={
                  <ProtectedRoute allowedRoles={["super_admin"]}>
                    <AdminEdu />
                  </ProtectedRoute>
                }
              />

              {/* Portal routes - Establishment Admin (configuration & settings) */}
              <Route path="/portal/:slug" element={<SubscriptionGate><PortalDashboard /></SubscriptionGate>} />
              <Route path="/portal/:slug/agenda" element={<SubscriptionGate><PortalAgenda /></SubscriptionGate>} />
              <Route path="/portal/:slug/profissionais" element={<SubscriptionGate><PortalProfessionals /></SubscriptionGate>} />
              <Route path="/portal/:slug/servicos" element={<SubscriptionGate><PortalServices /></SubscriptionGate>} />
              <Route path="/portal/:slug/produtos" element={<SubscriptionGate><PortalProducts /></SubscriptionGate>} />
              <Route path="/portal/:slug/clientes" element={<SubscriptionGate><PortalClients /></SubscriptionGate>} />
              <Route path="/portal/:slug/clientes/:clientId" element={<SubscriptionGate><PortalClientDetail /></SubscriptionGate>} />
              <Route path="/portal/:slug/fidelidade" element={<SubscriptionGate><PortalLoyalty /></SubscriptionGate>} />
              <Route path="/portal/:slug/promocoes" element={<SubscriptionGate><PortalPromotions /></SubscriptionGate>} />
              <Route path="/portal/:slug/cupons" element={<SubscriptionGate><PortalCoupons /></SubscriptionGate>} />
              <Route path="/portal/:slug/configuracoes" element={<SubscriptionGate><PortalSettings /></SubscriptionGate>} />
              <Route path="/portal/:slug/comissoes" element={<SubscriptionGate><PortalCommissions /></SubscriptionGate>} />
              <Route path="/portal/:slug/financeiro" element={<SubscriptionGate><PortalFinanceiro /></SubscriptionGate>} />
              {/* Subscription page intentionally NOT gated so blocked owners can reactivate */}
              <Route path="/portal/:slug/assinatura" element={<PortalSubscription />} />
              <Route path="/portal/:slug/auditoria" element={<SubscriptionGate><PortalAuditOverrides /></SubscriptionGate>} />
              <Route path="/portal/:slug/avaliacoes" element={<SubscriptionGate><PortalReviews /></SubscriptionGate>} />
              <Route path="/portal/:slug/vitrine" element={<SubscriptionGate><PortalShowcase /></SubscriptionGate>} />
              <Route path="/portal/:slug/assistente-ia" element={<SubscriptionGate><PortalAIAssistant /></SubscriptionGate>} />
              <Route path="/portal/:slug/conversas-ia" element={<SubscriptionGate><PortalAIConversations /></SubscriptionGate>} />
              <Route path="/portal/:slug/aprendizados-ia" element={<SubscriptionGate><PortalAILearnings /></SubscriptionGate>} />
              <Route path="/portal/:slug/comunicacao" element={<SubscriptionGate><PortalCommunications /></SubscriptionGate>} />
              <Route path="/portal/:slug/edu" element={<SubscriptionGate><PortalEdu /></SubscriptionGate>} />

              {/* Interno routes - Establishment Internal Operations */}
              <Route path="/interno/:slug" element={<SubscriptionGate><InternoDashboard /></SubscriptionGate>} />
              <Route path="/interno/:slug/agenda" element={<SubscriptionGate><InternoAgenda /></SubscriptionGate>} />
              <Route path="/interno/:slug/comandas" element={<SubscriptionGate><InternoComandas /></SubscriptionGate>} />
              <Route path="/interno/:slug/comissoes" element={<SubscriptionGate><InternoComissoes /></SubscriptionGate>} />
              <Route path="/interno/:slug/perfil" element={<SubscriptionGate><InternoPerfil /></SubscriptionGate>} />

              {/* Subscription expired page */}
              <Route path="/assinatura/expirada" element={<SubscriptionExpired />} />

              {/* Client review submission */}
              <Route path="/:slug/avaliar/:reviewId" element={<ClientReviewSubmit />} />

              {/* Treinamento */}
              <Route path="/treinamento" element={<TrainingLogin />} />
              <Route path="/treinamento/recuperar-senha" element={<TrainingRecuperar />} />
              <Route path="/treinamento/resetar-senha" element={<TrainingResetar />} />
              <Route path="/treinamento/primeiro-acesso" element={
                <TrainingProtectedRoute requireMustChangePasswordCleared={false}><TrainingPrimeiroAcesso /></TrainingProtectedRoute>
              } />
              <Route path="/treinamento/dashboard" element={
                <TrainingProtectedRoute><TrainingDashboard /></TrainingProtectedRoute>
              } />
              <Route path="/treinamento/perfil" element={
                <TrainingProtectedRoute><TrainingPerfil /></TrainingProtectedRoute>
              } />
              <Route path="/treinamento/modulo/:id" element={
                <TrainingProtectedRoute><TrainingModulo /></TrainingProtectedRoute>
              } />
              <Route path="/treinamento/admin" element={
                <TrainingProtectedRoute><TrainingAdmin /></TrainingProtectedRoute>
              } />

              {/* Public client portal - /{slug} opens client booking page */}
              <Route path="/:slug" element={<ClientPortal />} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ImpersonationProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
