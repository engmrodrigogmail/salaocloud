import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminEstablishments from "./pages/admin/Establishments";
import AdminUsers from "./pages/admin/Users";
import AdminSettings from "./pages/admin/Settings";

// Dashboard Pages
import EstablishmentDashboard from "./pages/dashboard/Dashboard";
import Services from "./pages/dashboard/Services";
import Professionals from "./pages/dashboard/Professionals";
import Agenda from "./pages/dashboard/Agenda";
import Clients from "./pages/dashboard/Clients";
import EstablishmentSettings from "./pages/dashboard/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
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
                <ProtectedRoute allowedRoles={["establishment"]}>
                  <EstablishmentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/agenda"
              element={
                <ProtectedRoute allowedRoles={["establishment"]}>
                  <Agenda />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/profissionais"
              element={
                <ProtectedRoute allowedRoles={["establishment"]}>
                  <Professionals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/servicos"
              element={
                <ProtectedRoute allowedRoles={["establishment"]}>
                  <Services />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/clientes"
              element={
                <ProtectedRoute allowedRoles={["establishment"]}>
                  <Clients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/configuracoes"
              element={
                <ProtectedRoute allowedRoles={["establishment"]}>
                  <EstablishmentSettings />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
