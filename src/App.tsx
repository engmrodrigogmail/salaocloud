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
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import ClientPortal from "./pages/client/ClientPortal";

// Admin Pages (SaaS Super Admin)
import AdminDashboard from "./pages/admin/Dashboard";
import AdminEstablishments from "./pages/admin/Establishments";
import AdminUsers from "./pages/admin/Users";
import AdminCoupons from "./pages/admin/Coupons";
import AdminPlans from "./pages/admin/Plans";
import AdminStripe from "./pages/admin/Stripe";
import AdminSettings from "./pages/admin/Settings";

// Portal Pages (Establishment Admin - configuration & settings)
import PortalDashboard from "./pages/portal/Dashboard";
import PortalServices from "./pages/portal/Services";
import PortalProfessionals from "./pages/portal/Professionals";
import PortalClients from "./pages/portal/Clients";
import PortalLoyalty from "./pages/portal/Loyalty";
import PortalPromotions from "./pages/portal/Promotions";
import PortalSettings from "./pages/portal/Settings";
import PortalCommissions from "./pages/portal/Commissions";
// Interno Pages (Establishment Internal - operations)
import InternoDashboard from "./pages/interno/Dashboard";
import InternoAgenda from "./pages/interno/Agenda";
import InternoComandas from "./pages/interno/Comandas";

// Portal Agenda
import PortalAgenda from "./pages/portal/Agenda";

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
              <Route path="/instalar" element={<Install />} />

              {/* Onboarding */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
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

              {/* Portal routes - Establishment Admin (configuration & settings) */}
              <Route path="/portal/:slug" element={<PortalDashboard />} />
              <Route path="/portal/:slug/agenda" element={<PortalAgenda />} />
              <Route path="/portal/:slug/profissionais" element={<PortalProfessionals />} />
              <Route path="/portal/:slug/servicos" element={<PortalServices />} />
              <Route path="/portal/:slug/clientes" element={<PortalClients />} />
              <Route path="/portal/:slug/fidelidade" element={<PortalLoyalty />} />
              <Route path="/portal/:slug/promocoes" element={<PortalPromotions />} />
              <Route path="/portal/:slug/configuracoes" element={<PortalSettings />} />
              <Route path="/portal/:slug/comissoes" element={<PortalCommissions />} />

              {/* Interno routes - Establishment Internal Operations */}
              <Route path="/interno/:slug" element={<InternoDashboard />} />
              <Route path="/interno/:slug/agenda" element={<InternoAgenda />} />
              <Route path="/interno/:slug/comandas" element={<InternoComandas />} />

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
