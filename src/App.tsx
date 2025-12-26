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
import BookingPage from "./pages/booking/BookingPage";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientPortal from "./pages/client/ClientPortal";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminEstablishments from "./pages/admin/Establishments";
import AdminUsers from "./pages/admin/Users";
import AdminCoupons from "./pages/admin/Coupons";
import AdminPlans from "./pages/admin/Plans";
import AdminStripe from "./pages/admin/Stripe";
import AdminSettings from "./pages/admin/Settings";

// Dashboard Pages
import EstablishmentDashboard from "./pages/dashboard/Dashboard";
import Services from "./pages/dashboard/Services";
import Professionals from "./pages/dashboard/Professionals";
import Agenda from "./pages/dashboard/Agenda";
import Clients from "./pages/dashboard/Clients";
import Loyalty from "./pages/dashboard/Loyalty";
import Promotions from "./pages/dashboard/Promotions";
import EstablishmentSettings from "./pages/dashboard/Settings";

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

              {/* Onboarding */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />

              {/* Super Admin routes */}
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

              {/* Establishment routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["super_admin", "establishment"]}>
                    <EstablishmentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/agenda"
                element={
                  <ProtectedRoute allowedRoles={["super_admin", "establishment"]}>
                    <Agenda />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/profissionais"
                element={
                  <ProtectedRoute allowedRoles={["super_admin", "establishment"]}>
                    <Professionals />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/servicos"
                element={
                  <ProtectedRoute allowedRoles={["super_admin", "establishment"]}>
                    <Services />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/clientes"
                element={
                  <ProtectedRoute allowedRoles={["super_admin", "establishment"]}>
                    <Clients />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/fidelidade"
                element={
                  <ProtectedRoute allowedRoles={["super_admin", "establishment"]}>
                    <Loyalty />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/promocoes"
                element={
                  <ProtectedRoute allowedRoles={["super_admin", "establishment"]}>
                    <Promotions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/configuracoes"
                element={
                  <ProtectedRoute allowedRoles={["super_admin", "establishment"]}>
                    <EstablishmentSettings />
                  </ProtectedRoute>
                }
              />

              {/* Public booking page */}
              <Route path="/agendar/:slug" element={<BookingPage />} />
              
              {/* Client portal for establishments */}
              <Route path="/cliente/:slug" element={<ClientPortal />} />

              {/* Client routes */}
              <Route
                path="/meus-agendamentos"
                element={
                  <ProtectedRoute allowedRoles={["super_admin", "client"]}>
                    <ClientDashboard />
                  </ProtectedRoute>
                }
              />

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
