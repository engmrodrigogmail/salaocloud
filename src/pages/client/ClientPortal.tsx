import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  Calendar, Clock, User, Phone, CreditCard, ArrowLeft, 
  Loader2, Store, Scissors, Star, Gift, LogOut, Filter,
  ChevronLeft, ChevronRight, AlertCircle, FileText, Info, MessageCircle
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { LGPDTermsDialog } from "@/components/legal/LGPDTermsDialog";
import { Mail } from "lucide-react";
import { format, addDays, setHours, setMinutes, startOfDay, isBefore, addMinutes, isAfter, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { useAvailability } from "@/hooks/useAvailability";
import { EstablishmentNameHeader } from "@/components/branding/EstablishmentNameHeader";
import { EstablishmentAIChat } from "@/components/ai-assistant/EstablishmentAIChat";
import { Vitrine, type ShowcaseImage } from "@/components/showcase/Vitrine";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type Establishment = Tables<"establishments"> & { cancellation_policy?: string | null };
type Service = Tables<"services">;
type Client = Tables<"clients">;
type Professional = Tables<"professionals">;
type Appointment = Tables<"appointments"> & {
  services?: { name: string } | null;
  professionals?: { name: string } | null;
};
type LoyaltyProgram = Tables<"loyalty_programs">;
type LoyaltyPoints = Tables<"client_loyalty_points">;
type LoyaltyReward = Tables<"loyalty_rewards">;
type Promotion = Tables<"promotions">;
type ScheduleSlot = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  professional_id: string;
  service_id: string;
  status: string;
};

const ClientPortal = () => {
  const clientDebug = (event: string, payload?: Record<string, unknown>, level: "info" | "warn" | "error" = "info") => {
    const logPayload = {
      routeSlug: slug ?? null,
      timestamp: new Date().toISOString(),
      ...payload,
    };
    console[level](`[ClientPortalDebug] ${event}`, logPayload);
  };
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const [clientExists, setClientExists] = useState(false);
  // Identity stitching: cliente existe na plataforma mas não neste salão
  const [stitchSourceClient, setStitchSourceClient] = useState<Client | null>(null);
  // Senha cadastrada (em qualquer salão da rede) para este e-mail
  const [hasPassword, setHasPassword] = useState(false);
  // Senhas (login, criação no 1º acesso, cadastro novo)
  const [loginPassword, setLoginPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [requestingReset, setRequestingReset] = useState(false);

  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [allAppointments, setAllAppointments] = useState<ScheduleSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState<LoyaltyPoints | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [professionalServices, setProfessionalServices] = useState<{professional_id: string, service_id: string}[]>([]);
  const [showcaseImages, setShowcaseImages] = useState<ShowcaseImage[]>([]);
  const [showVitrine, setShowVitrine] = useState(true);

  // Email check form
  const [emailToCheck, setEmailToCheck] = useState("");

  // Login form
  const [loginPhone, setLoginPhone] = useState("");

  // Registration form
  const [registerName, setRegisterName] = useState("");
  const [registerCpf, setRegisterCpf] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [shareHistoryConsent, setShareHistoryConsent] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);

  // Booking state
  const [isBooking, setIsBooking] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  // Filters for agenda view
  const [filterDate, setFilterDate] = useState<Date>(startOfDay(new Date()));
  const [filterService, setFilterService] = useState<string>("all");
  const [filterProfessional, setFilterProfessional] = useState<string>("all");
  
  // Closed establishment message state
  const [showClosedMessage, setShowClosedMessage] = useState(false);
  const [nextAvailableSlot, setNextAvailableSlot] = useState<{
    date: Date;
    time: string;
    professional: Professional | null;
  } | null>(null);

  // Use availability hook
  const availability = useAvailability({
    establishmentId: establishment?.id || null,
    establishment,
    professionals,
    appointments: allAppointments,
  });

  // Brand colors and logo customization removed — SaaS uses unified design tokens.


  const sessionStorageKey = slug ? `client_portal_session:${slug}` : null;

  const persistClientSession = (
    clientRecord: Client | null,
    sessionToken?: string | null,
    sessionExpiresAt?: string | null,
  ) => {
    if (!sessionStorageKey) return;
    try {
      if (!clientRecord) {
        localStorage.removeItem(sessionStorageKey);
        return;
      }
      const existing = (() => {
        try {
          const raw = localStorage.getItem(sessionStorageKey);
          return raw ? (JSON.parse(raw) as { sessionToken?: string | null; sessionExpiresAt?: string | null }) : null;
        } catch { return null; }
      })();
      localStorage.setItem(
        sessionStorageKey,
        JSON.stringify({
          clientId: clientRecord.id,
          email: clientRecord.global_identity_email || clientRecord.email || null,
          phone: clientRecord.phone || null,
          sessionToken: sessionToken ?? existing?.sessionToken ?? null,
          sessionExpiresAt: sessionExpiresAt ?? existing?.sessionExpiresAt ?? null,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.warn("[ClientPortalDebug] persistClientSession failed", err);
    }
  };

  useEffect(() => {
    if (slug) {
      fetchEstablishment();
    }
  }, [slug]);

  // Restaurar sessão do cliente após o estabelecimento ser carregado
  useEffect(() => {
    if (!establishment || isAuthenticated || !sessionStorageKey) return;
    const restore = async () => {
      try {
        const raw = localStorage.getItem(sessionStorageKey);
        if (!raw) return;
        const saved = JSON.parse(raw) as { clientId?: string; email?: string | null; phone?: string | null };
        if (!saved?.email && !saved?.phone) {
          localStorage.removeItem(sessionStorageKey);
          return;
        }

        // RLS bloqueia SELECT direto para usuários anônimos.
        // Usamos a edge function (service role) para revalidar a sessão por e-mail.
        let existing: Client | null = null;

        if (saved.email) {
          const { data, error } = await supabase.functions.invoke("lookup-client-by-email", {
            body: { establishment_id: establishment.id, email: saved.email },
          });
          if (!error && data?.client) {
            existing = data.client as Client;
          }
        }

        if (!existing) {
          localStorage.removeItem(sessionStorageKey);
          return;
        }

        setClient(existing);
        setIsAuthenticated(true);
        if (saved.email) setEmailToCheck(saved.email);
        // Atualiza o storage com o id atual (caso tenha mudado por stitching)
        persistClientSession(existing);
        await fetchAllAppointments();
        await fetchClientData(existing.id);
      } catch (err) {
        console.warn("[ClientPortalDebug] restore session failed", err);
        localStorage.removeItem(sessionStorageKey);
      }
    };
    restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishment]);

  const fetchEstablishment = async () => {
    try {
      const { data: est, error } = await supabase
        .from("establishments")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .single();

      if (error || !est) {
        toast.error("Estabelecimento não encontrado");
        navigate("/");
        return;
      }

      setEstablishment(est);
      
      // Fetch services
      const { data: servicesData } = await supabase
        .from("services")
        .select("*")
        .eq("establishment_id", est.id)
        .eq("is_active", true)
        .order("name");
      
      setServices(servicesData || []);

      // Fetch professionals
      const { data: professionalsData } = await supabase
        .from("professionals")
        .select("*")
        .eq("establishment_id", est.id)
        .eq("is_active", true)
        .order("name");
      
      setProfessionals(professionalsData || []);

      // Fetch professional_services
      const { data: psData } = await supabase
        .from("professional_services")
        .select("professional_id, service_id");
      
      setProfessionalServices(psData || []);

      // Fetch active promotions
      const { data: promotionsData } = await supabase
        .from("promotions")
        .select("*")
        .eq("establishment_id", est.id)
        .eq("is_active", true)
        .gte("end_date", new Date().toISOString())
        .lte("start_date", new Date().toISOString());
      
      setPromotions(promotionsData || []);

      // Fetch loyalty program
      const { data: loyaltyData } = await supabase
        .from("loyalty_programs")
        .select("*")
        .eq("establishment_id", est.id)
        .eq("is_active", true)
        .maybeSingle();
      
      setLoyaltyProgram(loyaltyData);

      if (loyaltyData) {
        const { data: rewardsData } = await supabase
          .from("loyalty_rewards")
          .select("*")
          .eq("loyalty_program_id", loyaltyData.id)
          .eq("is_active", true)
          .order("points_required");
        
        setRewards(rewardsData || []);
      }

      // Fetch showcase images (vitrine) — somente se habilitada
      try {
        const enabled = (est as any).is_showcase_enabled !== false;
        console.info("[Vitrine] is_showcase_enabled:", (est as any).is_showcase_enabled, "→ enabled:", enabled);
        if (enabled) {
          const nowIso = new Date().toISOString();
          const { data: showcaseData, error: showcaseErr } = await supabase
            .from("establishment_showcase" as any)
            .select("id, image_url, caption, scheduled_for, order_index")
            .eq("establishment_id", est.id)
            .order("order_index", { ascending: true });
          if (showcaseErr) {
            console.error("[Vitrine] erro ao buscar imagens:", showcaseErr);
          }
          const visible = ((showcaseData || []) as any[])
            .filter((it) => !it.scheduled_for || it.scheduled_for <= nowIso)
            .map((it) => ({ id: it.id, image_url: it.image_url, caption: it.caption }));
          console.info("[Vitrine] imagens carregadas:", visible.length, "de", (showcaseData || []).length);
          setShowcaseImages(visible);
          // Reabre a vitrine sempre que novas imagens chegam (importante após login)
          if (visible.length > 0) setShowVitrine(true);
        } else {
          setShowcaseImages([]);
        }
      } catch (vitrineErr) {
        console.error("[Vitrine] exceção ao carregar:", vitrineErr);
      }

    } catch (error) {
      console.error("Error fetching establishment:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const normalizeOptionalCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers && !/^(\d)\1{10}$/.test(numbers) ? numbers : null;
  };

  const getClientErrorMessage = (error: unknown) => {
    const details = error as { code?: string; message?: string; details?: string; hint?: string };
    const message = `${details?.message ?? ""} ${details?.details ?? ""} ${details?.hint ?? ""}`.toLowerCase();

    if (details?.code === "23505" || message.includes("duplicate key")) {
      if (message.includes("cpf")) return "Este CPF já está cadastrado neste salão. Se ele não for obrigatório, deixe o campo em branco.";
      return "Já existe um cadastro com estes dados neste salão.";
    }

    if (message.includes("row-level security") || details?.code === "42501") {
      return "Não foi possível autorizar este cadastro. Tente novamente em alguns instantes.";
    }

    if (details?.code === "23503") {
      return "Não localizei o salão para concluir o cadastro. Volte e tente novamente.";
    }

    return "Erro ao fazer cadastro";
  };

  // Step 1: Check if email exists in this establishment OR globally
  const handleCheckEmail = async () => {
    if (!establishment) return;

    const email = emailToCheck.trim().toLowerCase();
    clientDebug("check_email_start", { emailLength: email.length, establishmentId: establishment.id });

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      clientDebug("check_email_invalid", { email });
      toast.error("E-mail inválido");
      return;
    }

    setCheckingEmail(true);

    try {
      const { data, error } = await supabase.functions.invoke("lookup-client-by-email", {
        body: { establishment_id: establishment.id, email },
      });

      clientDebug("check_email_lookup_result", {
        match: data?.match ?? null,
        hasClient: Boolean(data?.client),
        error: error?.message ?? null,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setEmailChecked(true);
      setHasPassword(Boolean(data?.has_password));

      if (data?.match === "local" && data.client) {
        setClientExists(true);
        setClient(data.client as Client);
        return;
      }

      if (data?.match === "global" && data.client) {
        setStitchSourceClient(data.client as Client);
        setClientExists(true);
        return;
      }

      // Novo cadastro
      setClientExists(false);
    } catch (error) {
      console.error("[ClientPortalDebug] check_email_exception", error);
      toast.error("Erro ao verificar e-mail");
    } finally {
      setCheckingEmail(false);
    }
  };

  // Login (cliente já existe neste salão) — autentica via e-mail + senha
  const handleLogin = async () => {
    if (!client || !establishment) return;
    const email = (emailToCheck || client.global_identity_email || client.email || "").trim().toLowerCase();
    clientDebug("client_login_start", {
      email,
      clientId: client.id,
      clientEstablishmentId: client.establishment_id,
      establishmentId: establishment.id,
      hasPassword,
    });
    if (!loginPassword || loginPassword.length < 6) {
      toast.error("Informe sua senha (mínimo 6 caracteres)");
      return;
    }
    setAuthenticating(true);
    try {
      const { data, error } = await supabase.functions.invoke("client-auth-login", {
        body: { email, password: loginPassword, establishment_id: establishment.id },
      });
      clientDebug("client_login_result", {
        status: data?.status ?? null,
        hasClient: Boolean(data?.client),
        returnedClientId: data?.client?.id ?? null,
        returnedEstablishmentId: data?.client?.establishment_id ?? null,
        sessionCreated: Boolean(data?.session_token),
        errorMessage: error?.message ?? null,
        errorStatus: (error as any)?.context?.status ?? null,
      }, error ? "error" : "info");
      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 401 || status === 404) {
          toast.error("E-mail ou senha incorretos");
          return;
        }
        throw error;
      }

      if (data?.status === "password_not_set") {
        // Migração suave: cliente antigo sem senha — leva para criar senha agora
        toast.message("Defina sua senha para o primeiro acesso", { duration: 2500 });
        setHasPassword(false);
        setLoginPassword("");
        return;
      }
      if (data?.status !== "ok" || !data?.client) {
        toast.error("E-mail ou senha incorretos");
        return;
      }

      // Garantir global_identity_email preenchido
      if (!data.client.global_identity_email) {
        await supabase
          .from("clients")
          .update({ global_identity_email: email })
          .eq("id", data.client.id);
      }

      const authedClient = { ...client, ...data.client } as Client;
      setClient(authedClient);
      setIsAuthenticated(true);
      persistClientSession(authedClient, data.session_token, data.session_expires_at);
      await fetchClientData(authedClient.id);
      await fetchAllAppointments();
      toast.success(`Bem-vindo(a), ${authedClient.name}!`, { duration: 2000 });
    } catch (error) {
      console.error("[ClientPortalDebug] client_login_exception", error);
      toast.error("Erro ao fazer login");
    } finally {
      setAuthenticating(false);
    }
  };

  // 1º acesso (migração suave): cliente antigo define senha agora
  const handleSetPasswordFirstTime = async () => {
    if (!client) return;
    const email = (emailToCheck || client.global_identity_email || client.email || "").trim().toLowerCase();
    if (!newPassword || newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setAuthenticating(true);
    try {
      const { data, error } = await supabase.functions.invoke("client-auth-set-password", {
        body: { email, password: newPassword, mode: "first_time" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIsAuthenticated(true);
      persistClientSession(client);
      await fetchClientData(client.id);
      await fetchAllAppointments();
      toast.success(`Bem-vindo(a), ${client.name}!`, { duration: 2000 });
    } catch (error) {
      console.error("[ClientPortalDebug] set_password_exception", error);
      toast.error("Erro ao definir senha");
    } finally {
      setAuthenticating(false);
    }
  };

  // Esqueci minha senha — envia link por e-mail
  const handleRequestReset = async () => {
    const email = (emailToCheck || client?.global_identity_email || client?.email || "").trim().toLowerCase();
    if (!email) {
      toast.error("Informe seu e-mail primeiro");
      return;
    }
    toast.message("O link de redefinição será enviado apenas ao e-mail cadastrado.", { duration: 4000 });
    setRequestingReset(true);
    try {
      await supabase.functions.invoke("client-auth-request-reset", { body: { email } });
      toast.success("Se houver cadastro, você receberá um e-mail com instruções.", { duration: 4000 });
    } catch (error) {
      console.error("[ClientPortalDebug] request_reset_exception", error);
      toast.error("Erro ao solicitar redefinição");
    } finally {
      setRequestingReset(false);
    }
  };

  // Identity stitching: criar registro local copiando dados do registro global
  const handleStitch = async () => {
    if (!establishment || !stitchSourceClient) return;

    // Validação de senha:
    //  - Se já existe senha cadastrada na rede para este e-mail, exigimos `loginPassword` (autenticação).
    //  - Caso contrário, exigimos `newPassword` + confirmação para criar.
    if (hasPassword) {
      if (!loginPassword || loginPassword.length < 6) {
        toast.error("Informe sua senha (mínimo 6 caracteres)");
        return;
      }
    } else {
      if (!newPassword || newPassword.length < 6) {
        toast.error("Crie uma senha com no mínimo 6 caracteres");
        return;
      }
      if (newPassword !== newPasswordConfirm) {
        toast.error("As senhas não coincidem");
        return;
      }
    }

    setAuthenticating(true);
    try {
      const email = emailToCheck.trim().toLowerCase();

      // Se a rede já tem senha, valida ANTES de criar o registro local
      let stitchSessionToken: string | null = null;
      let stitchSessionExpiresAt: string | null = null;
      if (hasPassword) {
        clientDebug("stitch_login_start", {
          email,
          sourceClientId: stitchSourceClient.id,
          sourceEstablishmentId: stitchSourceClient.establishment_id,
          targetEstablishmentId: establishment.id,
        });
        const { data: loginData, error: loginError } = await supabase.functions.invoke(
          "client-auth-login",
          { body: { email, password: loginPassword, establishment_id: establishment.id } }
        );
        clientDebug("stitch_login_result", {
          status: loginData?.status ?? null,
          hasClient: Boolean(loginData?.client),
          returnedClientId: loginData?.client?.id ?? null,
          returnedEstablishmentId: loginData?.client?.establishment_id ?? null,
          sessionCreated: Boolean(loginData?.session_token),
          errorMessage: loginError?.message ?? null,
          errorStatus: (loginError as any)?.context?.status ?? null,
        }, loginError ? "error" : "info");
        if (loginError) {
          const status = (loginError as any)?.context?.status;
          if (status === 401 || status === 404) {
            toast.error("Senha incorreta");
            setAuthenticating(false);
            return;
          }
          throw loginError;
        }
        if (loginData?.status !== "ok") {
          toast.error("Senha incorreta");
          setAuthenticating(false);
          return;
        }
        stitchSessionToken = loginData.session_token ?? null;
        stitchSessionExpiresAt = loginData.session_expires_at ?? null;
      }

      // Cria/recupera o registro local via edge function (service role) para evitar bloqueios de RLS
      const { data: stitchData, error: stitchErr } = await supabase.functions.invoke(
        "client-stitch-identity",
        {
          body: {
            establishment_id: establishment.id,
            source_client_id: stitchSourceClient.id,
            email,
          },
        }
      );

      if (stitchErr) throw stitchErr;
      if (stitchData?.error) {
        if (stitchData.error === "cpf_already_in_salon") {
          throw new Error("Este CPF já está cadastrado neste salão. Entre em contato com o salão.");
        }
        throw new Error(stitchData.error);
      }

      const newClient = stitchData.client as Client;

      // Se a rede ainda não tem senha, definimos agora (aplica a todos os registros do e-mail)
      if (!hasPassword) {
        const { error: setPwdError } = await supabase.functions.invoke("client-auth-set-password", {
          body: { email, password: newPassword, mode: "first_time" },
        });
        if (setPwdError) {
          console.error("[ClientPortalDebug] stitch_set_password_error", setPwdError);
          toast.error("Erro ao definir senha");
          setAuthenticating(false);
          return;
        }
      }

      setClient(newClient);
      setStitchSourceClient(null);
      setIsAuthenticated(true);
      persistClientSession(newClient, stitchSessionToken, stitchSessionExpiresAt);

      if (loyaltyProgram) {
        await supabase.from("client_loyalty_points").insert({
          client_id: newClient.id,
          loyalty_program_id: loyaltyProgram.id,
          points_balance: 0,
          total_points_earned: 0,
        });
      }

      await fetchAllAppointments();
      await fetchClientData(newClient.id);
      toast.success(`Bem-vindo(a) de volta, ${newClient.name}!`, { duration: 2500 });
    } catch (error: any) {
      console.error("Error stitching identity:", error, JSON.stringify(error));
      const code = error?.code || error?.details?.code;
      const message = error?.message || "";
      let userMsg = "Erro ao vincular cadastro";
      if (code === "23505" || /duplicate key|already exists/i.test(message)) {
        if (/cpf/i.test(message)) {
          userMsg = "Este CPF já está cadastrado neste salão. Entre em contato com o salão.";
        } else {
          userMsg = "Cadastro já existente neste salão. Tente fazer login.";
        }
      } else if (code === "42501" || /row-level security|permission denied/i.test(message)) {
        userMsg = "Permissão negada. Recarregue a página e tente novamente.";
      } else if (message) {
        userMsg = `Erro ao vincular cadastro: ${message}`;
      }
      toast.error(userMsg, { duration: 5000 });
    } finally {
      setAuthenticating(false);
    }
  };

  const handleRegister = async () => {
    if (!establishment) return;

    const rawCpfNumbers = registerCpf.replace(/\D/g, "");
    const cpfClean = normalizeOptionalCpf(registerCpf);
    const phoneClean = registerPhone.replace(/\D/g, "");
    const email = emailToCheck.trim().toLowerCase();

    clientDebug("register_start", {
      establishmentId: establishment.id,
      establishmentStatus: establishment.status,
      emailLength: email.length,
      phoneLength: phoneClean.length,
      phoneLast4: phoneClean.slice(-4),
      rawCpfLength: rawCpfNumbers.length,
      rawCpfIsRepeatedDigits: rawCpfNumbers ? /^(\d)\1{10}$/.test(rawCpfNumbers) : false,
      cpfLength: cpfClean?.length ?? 0,
      cpfStoredAsNull: cpfClean === null,
      acceptedTerms,
      shareHistoryConsent,
    });

    if (!registerName.trim()) {
      clientDebug("register_validation_failed", { reason: "missing_name" });
      toast.error("Nome é obrigatório");
      return;
    }
    if (phoneClean.length < 10) {
      clientDebug("register_validation_failed", { reason: "invalid_phone", phoneLength: phoneClean.length });
      toast.error("Celular inválido");
      return;
    }
    if (cpfClean && cpfClean.length !== 11) {
      clientDebug("register_validation_failed", { reason: "invalid_cpf", cpfLength: cpfClean.length });
      toast.error("CPF inválido");
      return;
    }
    if (!acceptedTerms) {
      clientDebug("register_validation_failed", { reason: "terms_not_accepted" });
      toast.error("Você precisa aceitar os Termos de Uso para continuar");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    setAuthenticating(true);

    try {
      const clientId = crypto.randomUUID();
      const now = new Date().toISOString();
      const clientInsert = {
        id: clientId,
        establishment_id: establishment.id,
        name: registerName.trim(),
        cpf: cpfClean,
        phone: phoneClean,
        email,
        global_identity_email: email,
        terms_accepted_at: now,
        shared_history_consent: shareHistoryConsent,
        user_id: null,
        notes: null,
      };
      clientDebug("register_insert_payload_ready", {
        clientId,
        establishmentId: clientInsert.establishment_id,
        hasCpf: Boolean(clientInsert.cpf),
        cpfStoredAsNull: clientInsert.cpf === null,
        hasEmail: Boolean(clientInsert.email),
        hasPhone: Boolean(clientInsert.phone),
        userIdIsNull: clientInsert.user_id === null,
        nameLength: clientInsert.name.length,
      });
      const { error } = await supabase
        .from("clients")
        .insert(clientInsert);

      const newClient = {
        ...clientInsert,
        created_at: now,
        updated_at: now,
      } as Client;

      clientDebug("register_insert_result", {
        ok: !error,
        clientId: newClient?.id ?? null,
        error: error?.message ?? null,
      });

      if (error) throw error;

      clientDebug("register_insert_success", {
        clientId: newClient.id,
        cpfStoredAsNull: newClient.cpf === null,
      });

      // Definir senha (compartilhada entre todos os salões com o mesmo e-mail)
      const { error: setPwdError } = await supabase.functions.invoke("client-auth-set-password", {
        body: { email, password: newPassword, mode: "register", client_id: newClient.id },
      });
      if (setPwdError) {
        console.error("[ClientPortalDebug] register_set_password_error", setPwdError);
        toast.error("Cadastro criado, mas houve erro ao definir a senha. Use 'Esqueci minha senha' para configurar.");
      }

      setClient(newClient);
      setIsAuthenticated(true);
      persistClientSession(newClient);

      if (loyaltyProgram) {
        clientDebug("register_loyalty_points_start", {
          clientId: newClient.id,
          loyaltyProgramId: loyaltyProgram.id,
        });
        const { error: pointsError } = await supabase
          .from("client_loyalty_points")
          .insert({
            client_id: newClient.id,
            loyalty_program_id: loyaltyProgram.id,
            points_balance: 0,
            total_points_earned: 0,
          });
        clientDebug("register_loyalty_points_result", {
          ok: !pointsError,
          errorCode: pointsError?.code ?? null,
          errorMessage: pointsError?.message ?? null,
          errorDetails: pointsError?.details ?? null,
          errorHint: pointsError?.hint ?? null,
        }, pointsError ? "warn" : "info");
      }

      clientDebug("register_fetch_appointments_start", { establishmentId: establishment.id });
      await fetchAllAppointments();
      await fetchClientData(newClient.id);
      clientDebug("register_completed", { clientId: newClient.id });
      toast.success(`Cadastro realizado com sucesso, ${newClient.name}!`, { duration: 2000 });
    } catch (error) {
      const details = error as { code?: string; message?: string; details?: string; hint?: string };
      clientDebug("register_exception", {
        errorCode: details?.code ?? null,
        errorMessage: details?.message ?? String(error),
        errorDetails: details?.details ?? null,
        errorHint: details?.hint ?? null,
        establishmentId: establishment.id,
        cpfStoredAsNull: cpfClean === null,
        rawCpfLength: rawCpfNumbers.length,
      }, "error");
      toast.error(getClientErrorMessage(error));
    } finally {
      setAuthenticating(false);
    }
  };

  const fetchClientData = async (clientId: string) => {
    try {
      // Buscar agendamentos via RPC SECURITY DEFINER (portal anônimo, validação por e-mail)
      const emailForLookup = (emailToCheck || client?.global_identity_email || client?.email || "")
        .trim()
        .toLowerCase();
      const phoneForLookup = (client?.phone || loginPhone || "").replace(/\D/g, "");
      clientDebug("fetch_appointments_start", {
        clientId,
        hasEmail: Boolean(emailForLookup),
        hasPhone: Boolean(phoneForLookup),
      });
      const { data: appointmentsData, error: appointmentsError } = await supabase.rpc(
        "get_client_appointments",
        { _client_id: clientId, _email: emailForLookup, _phone: phoneForLookup }
      );
      clientDebug("fetch_appointments_result", {
        ok: !appointmentsError,
        count: appointmentsData?.length ?? 0,
        error: appointmentsError?.message ?? null,
      }, appointmentsError ? "warn" : "info");

      const mapped = (appointmentsData || []).map((a: any) => ({
        ...a,
        services: a.service_name ? { name: a.service_name } : null,
        professionals: a.professional_name ? { name: a.professional_name } : null,
      }));
      setAppointments(mapped as Appointment[]);

      // Fetch loyalty points if program exists
      if (loyaltyProgram) {
        const { data: pointsData } = await supabase
          .from("client_loyalty_points")
          .select("*")
          .eq("client_id", clientId)
          .eq("loyalty_program_id", loyaltyProgram.id)
          .maybeSingle();
        
        setLoyaltyPoints(pointsData);
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
    }
  };

  const fetchAllAppointments = async () => {
    if (!establishment) return;
    
    try {
      // Fetch all appointments for the establishment (for availability checking)
      // We only get the schedules without client info for privacy
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, duration_minutes, professional_id, service_id, status")
        .eq("establishment_id", establishment.id)
        .in("status", ["pending", "confirmed", "in_service"]);
      
      setAllAppointments(data || []);
    } catch (error) {
      console.error("Error fetching all appointments:", error);
    }
  };

  const handleLogout = () => {
    persistClientSession(null);
    setClient(null);
    setIsAuthenticated(false);
    setAppointments([]);
    setLoyaltyPoints(null);
    setEmailToCheck("");
    setLoginPhone("");
    setEmailChecked(false);
    setClientExists(false);
    setStitchSourceClient(null);
    setRegisterName("");
    setRegisterCpf("");
    setRegisterPhone("");
    setAcceptedTerms(false);
    setShareHistoryConsent(false);
    setHasPassword(false);
    setLoginPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setIsBooking(false);
    setBookingStep(1);
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);

      if (error) throw error;

      toast.success("Agendamento cancelado");
      if (client) {
        fetchClientData(client.id);
        fetchAllAppointments();
      }
    } catch (error) {
      console.error("Error cancelling:", error);
      toast.error("Erro ao cancelar");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      confirmed: { label: "Confirmado", variant: "default" },
      in_service: { label: "Em atendimento", variant: "default" },
      completed: { label: "Concluído", variant: "outline" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const { label, variant } = variants[status] || { label: status, variant: "outline" as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  // Get professionals that can perform a given service
  const getProfessionalsForService = (serviceId: string) => {
    const profIds = professionalServices
      .filter(ps => ps.service_id === serviceId)
      .map(ps => ps.professional_id);
    
    // If no specific mapping, return all professionals
    if (profIds.length === 0) {
      return professionals;
    }
    
    return professionals.filter(p => profIds.includes(p.id));
  };

  // Check if a professional is available at a specific time slot - now uses availability hook
  const isProfessionalAvailable = (date: Date, time: string, professionalId: string, durationMinutes: number) => {
    return availability.isProfessionalAvailable(date, time, professionalId, durationMinutes);
  };

  // Check if a time slot is available (for any professional or specific one)
  const isTimeSlotAvailable = (date: Date, time: string, professionalId: string | null, durationMinutes: number) => {
    const availableProfs = getProfessionalsForService(selectedService?.id || "");
    return availability.isTimeSlotAvailable(date, time, professionalId, durationMinutes, selectedService?.id || "", availableProfs);
  };

  // Get count of appointments for a professional on a given day
  const getProfessionalDayLoad = (professionalId: string, date: Date) => {
    return allAppointments.filter(apt => {
      if (apt.status === "cancelled") return false;
      if (apt.professional_id !== professionalId) return false;
      const aptDate = parseISO(apt.scheduled_at);
      return isSameDay(aptDate, date);
    }).length;
  };

  // Auto-assign professional with load balancing
  const autoAssignProfessional = (date: Date, time: string, serviceId: string, durationMinutes: number): Professional | null => {
    const availableProfs = getProfessionalsForService(serviceId);
    
    // Filter only available professionals for this time slot
    const freeProfs = availableProfs.filter(p => 
      isProfessionalAvailable(date, time, p.id, durationMinutes)
    );
    
    if (freeProfs.length === 0) return null;
    
    // Sort by day load (ascending) to balance appointments
    freeProfs.sort((a, b) => {
      const loadA = getProfessionalDayLoad(a.id, date);
      const loadB = getProfessionalDayLoad(b.id, date);
      return loadA - loadB;
    });
    
    return freeProfs[0];
  };

  // Get max capacity for a time slot (how many professionals can handle the service)
  const getSlotCapacity = (date: Date, time: string, serviceId: string, durationMinutes: number) => {
    const availableProfs = getProfessionalsForService(serviceId);
    return availableProfs.filter(p => 
      isProfessionalAvailable(date, time, p.id, durationMinutes)
    ).length;
  };

  const handleBookingSubmit = async () => {
    if (!establishment || !client || !selectedService || !selectedDate || !selectedTime) {
      toast.error("Complete todos os campos obrigatórios");
      return;
    }

    if (establishment.cancellation_policy && !policyAccepted) {
      toast.error("Você precisa aceitar a política de cancelamento");
      return;
    }

    // Find a professional - either selected or auto-assigned with load balancing
    let professionalId = selectedProfessional?.id;
    let assignedProfessional = selectedProfessional;
    
    if (!professionalId) {
      assignedProfessional = autoAssignProfessional(
        selectedDate, 
        selectedTime, 
        selectedService.id, 
        selectedService.duration_minutes
      );
      
      if (!assignedProfessional) {
        toast.error("Não há profissionais disponíveis para este horário. Por favor, escolha outro horário.");
        return;
      }
      professionalId = assignedProfessional.id;
    } else {
      // Verify selected professional is still available
      if (!isProfessionalAvailable(selectedDate, selectedTime, professionalId, selectedService.duration_minutes)) {
        toast.error("Este profissional não está mais disponível neste horário. Por favor, escolha outro horário ou profissional.");
        return;
      }
    }

    setConfirming(true);

    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      const { error } = await supabase.from("appointments").insert({
        establishment_id: establishment.id,
        service_id: selectedService.id,
        professional_id: professionalId,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: selectedService.duration_minutes,
        price: selectedService.price,
        client_name: client.name,
        client_phone: client.phone,
        client_email: client.global_identity_email || client.email || emailToCheck.trim().toLowerCase() || null,
        client_id: client.id,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Agendamento realizado com sucesso!");
      setIsBooking(false);
      setBookingStep(1);
      setSelectedService(null);
      setSelectedProfessional(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setPolicyAccepted(false);
      fetchClientData(client.id);
      fetchAllAppointments();
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error("Erro ao criar agendamento");
    } finally {
      setConfirming(false);
    }
  };

  // Generate dates for date picker - only show days establishment is open
  const generateDates = () => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      // Include all dates but mark closed ones visually
      dates.push(date);
    }
    return dates;
  };

  // Check if a date is open for booking
  const isDateOpen = (date: Date) => {
    return availability.isEstablishmentOpen(date);
  };

  // Generate available time slots for a date and optional professional - using availability hook
  const generateAvailableSlots = (date: Date, professionalId: string | null, durationMinutes: number) => {
    const serviceId = selectedService?.id || "";
    const availableProfs = getProfessionalsForService(serviceId);
    
    // Use the availability hook to generate slots considering working hours and blocked times
    return availability.generateAvailableSlotsForDay(
      date, 
      professionalId, 
      durationMinutes, 
      serviceId, 
      availableProfs
    );
  };

  // Handle date selection - check if closed and show message
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    
    if (!availability.isEstablishmentOpen(date)) {
      // Find next available slot
      const serviceId = selectedService?.id || "";
      const availableProfs = getProfessionalsForService(serviceId);
      const durationMinutes = selectedService?.duration_minutes || 30;
      
      const nextSlot = availability.findNextAvailableSlot(
        date,
        serviceId,
        durationMinutes,
        selectedProfessional?.id || null,
        availableProfs
      );
      
      setNextAvailableSlot(nextSlot);
      setShowClosedMessage(true);
    } else {
      setShowClosedMessage(false);
      setNextAvailableSlot(null);
    }
  };

  // Accept suggested slot
  const handleAcceptSuggestedSlot = () => {
    if (nextAvailableSlot) {
      setSelectedDate(nextAvailableSlot.date);
      setSelectedTime(nextAvailableSlot.time);
      if (nextAvailableSlot.professional) {
        setSelectedProfessional(nextAvailableSlot.professional);
      }
      setShowClosedMessage(false);
    }
  };

  // Find alternative suggestions when a slot is not available
  const findAlternatives = (date: Date, time: string, serviceId: string, preferredProfessionalId: string | null) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return { sameProf: [], otherProfs: [] };

    const availableProfs = getProfessionalsForService(serviceId);
    const [hours, minutes] = time.split(":").map(Number);
    
    // Same professional, different times on same day
    const sameProfAlternatives: { time: string; professional: Professional }[] = [];
    if (preferredProfessionalId) {
      const prof = professionals.find(p => p.id === preferredProfessionalId);
      if (prof) {
        // Check 2 hours before and after
        for (let h = Math.max(8, hours - 2); h <= Math.min(19, hours + 2); h++) {
          for (const m of [0, 30]) {
            const altTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
            if (altTime !== time && isProfessionalAvailable(date, altTime, preferredProfessionalId, service.duration_minutes)) {
              sameProfAlternatives.push({ time: altTime, professional: prof });
            }
          }
        }
      }
    }

    // Other professionals at the same time
    const otherProfAlternatives: { time: string; professional: Professional }[] = [];
    for (const prof of availableProfs) {
      if (prof.id !== preferredProfessionalId) {
        if (isProfessionalAvailable(date, time, prof.id, service.duration_minutes)) {
          otherProfAlternatives.push({ time, professional: prof });
        }
      }
    }

    return { sameProf: sameProfAlternatives.slice(0, 3), otherProfs: otherProfAlternatives.slice(0, 3) };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Estabelecimento não encontrado</h2>
            <p className="text-muted-foreground mb-4">O link pode estar incorreto.</p>
            <Button onClick={() => navigate("/")}>Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Login/Register screen
  if (!isAuthenticated) {
    const showStitchScreen = emailChecked && stitchSourceClient !== null;
    const showLoginScreen = emailChecked && clientExists && !stitchSourceClient;

    return (
      <div className="min-h-screen bg-background">
        <LGPDTermsDialog
          open={showTermsDialog}
          onOpenChange={setShowTermsDialog}
          onAccept={() => setAcceptedTerms(true)}
        />
        <EstablishmentNameHeader name={establishment.name} subtitle="Área do Cliente" />
        <div className="max-w-md mx-auto px-4 py-6 sm:py-8">
          <Card>
            <CardHeader>
              <CardTitle>
                {!emailChecked
                  ? "Identificação"
                  : showStitchScreen
                    ? "Bem-vindo(a) de volta!"
                    : showLoginScreen
                      ? "Acessar conta"
                      : "Novo Cadastro"}
              </CardTitle>
              <CardDescription>
                {!emailChecked
                  ? "Informe seu e-mail para continuar"
                  : showStitchScreen
                    ? "Reconhecemos você de outro salão da nossa rede"
                    : showLoginScreen
                      ? "Confirme para acessar sua conta"
                      : "Preencha seus dados para se cadastrar"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!emailChecked ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="emailCheck">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="emailCheck"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        value={emailToCheck}
                        onChange={(e) => setEmailToCheck(e.target.value)}
                        placeholder="seu@email.com"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleCheckEmail}
                    disabled={checkingEmail || !emailToCheck.trim()}
                  >
                    {checkingEmail && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Verificar
                  </Button>
                </>
              ) : showStitchScreen ? (
                <>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Olá, <strong>{stitchSourceClient?.name}</strong>! Vamos vincular seu
                      cadastro a este salão para que você possa agendar.
                    </AlertDescription>
                  </Alert>

                  {hasPassword ? (
                    <div className="space-y-2">
                      <Label htmlFor="stitchPwd">Senha</Label>
                      <PasswordInput
                        id="stitchPwd"
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Sua senha"
                      />
                      <button
                        type="button"
                        onClick={handleRequestReset}
                        disabled={requestingReset}
                        className="text-xs text-primary underline hover:opacity-80"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                  ) : (
                    <>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Este é seu primeiro acesso. Crie uma senha para proteger sua conta.
                        </AlertDescription>
                      </Alert>
                      <div className="space-y-2">
                        <Label htmlFor="stitchNewPwd">Criar senha</Label>
                        <PasswordInput
                          id="stitchNewPwd"
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stitchNewPwdConfirm">Confirmar senha</Label>
                        <PasswordInput
                          id="stitchNewPwdConfirm"
                          autoComplete="new-password"
                          value={newPasswordConfirm}
                          onChange={(e) => setNewPasswordConfirm(e.target.value)}
                          placeholder="Repita a senha"
                        />
                      </div>
                    </>
                  )}

                  <Button className="w-full" onClick={handleStitch} disabled={authenticating}>
                    {authenticating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Continuar
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setEmailChecked(false);
                      setStitchSourceClient(null);
                      setLoginPassword("");
                      setNewPassword("");
                      setNewPasswordConfirm("");
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Usar outro e-mail
                  </Button>
                </>
              ) : showLoginScreen ? (
                <>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={emailToCheck} readOnly className="pl-10 bg-muted" />
                    </div>
                  </div>

                  {hasPassword ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="loginPwd">Senha</Label>
                        <PasswordInput
                          id="loginPwd"
                          autoComplete="current-password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Sua senha"
                        />
                        <button
                          type="button"
                          onClick={handleRequestReset}
                          disabled={requestingReset}
                          className="text-xs text-primary underline hover:opacity-80"
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                      <Button className="w-full" onClick={handleLogin} disabled={authenticating}>
                        {authenticating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Entrar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Este é seu primeiro acesso. Crie uma senha para proteger sua conta.
                        </AlertDescription>
                      </Alert>
                      <div className="space-y-2">
                        <Label htmlFor="firstPwd">Criar senha</Label>
                        <PasswordInput
                          id="firstPwd"
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="firstPwdConfirm">Confirmar senha</Label>
                        <PasswordInput
                          id="firstPwdConfirm"
                          autoComplete="new-password"
                          value={newPasswordConfirm}
                          onChange={(e) => setNewPasswordConfirm(e.target.value)}
                          placeholder="Repita a senha"
                        />
                      </div>
                      <Button className="w-full" onClick={handleSetPasswordFirstTime} disabled={authenticating}>
                        {authenticating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Definir senha e entrar
                      </Button>
                    </>
                  )}

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setEmailChecked(false);
                      setEmailToCheck("");
                      setClient(null);
                      setClientExists(false);
                      setLoginPassword("");
                      setNewPassword("");
                      setNewPasswordConfirm("");
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={emailToCheck} readOnly className="pl-10 bg-muted" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regPhone">Celular / WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="regPhone"
                        value={registerPhone}
                        onChange={(e) => setRegisterPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regCpf">
                      CPF <span className="text-muted-foreground text-xs">(opcional)</span>
                    </Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="regCpf"
                        value={registerCpf}
                        onChange={(e) => setRegisterCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Usado apenas para emissão de nota fiscal
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="regPwd">Senha</Label>
                    <PasswordInput
                      id="regPwd"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regPwdConfirm">Confirmar senha</Label>
                    <PasswordInput
                      id="regPwdConfirm"
                      autoComplete="new-password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="Repita a senha"
                    />
                  </div>

                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="acceptTerms"
                        checked={acceptedTerms}
                        onCheckedChange={(v) => setAcceptedTerms(v === true)}
                        className="mt-1"
                      />
                      <Label
                        htmlFor="acceptTerms"
                        className="text-sm font-normal leading-snug cursor-pointer"
                      >
                        Li e aceito os{" "}
                        <button
                          type="button"
                          onClick={() => setShowTermsDialog(true)}
                          className="text-primary underline hover:opacity-80"
                        >
                          Termos de Uso e Política de Privacidade
                        </button>
                        .
                      </Label>
                    </div>
                    <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
                      <Checkbox
                        id="shareHistory"
                        checked={shareHistoryConsent}
                        onCheckedChange={(v) => setShareHistoryConsent(v === true)}
                        className="mt-1"
                      />
                      <Label
                        htmlFor="shareHistory"
                        className="text-sm font-normal leading-snug cursor-pointer"
                      >
                        Aceito compartilhar meu histórico de procedimentos com salões
                        parceiros da plataforma Salão Cloud para um atendimento mais
                        personalizado.
                      </Label>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleRegister}
                    disabled={authenticating || !acceptedTerms}
                  >
                    {authenticating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Cadastrar
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setEmailChecked(false);
                      setEmailToCheck("");
                      setNewPassword("");
                      setNewPasswordConfirm("");
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Authenticated client portal
  return (
    <div className="min-h-screen bg-background">
      <EstablishmentNameHeader
        name={establishment.name}
        subtitle={client?.name ? `Olá, ${client.name}` : undefined}
      />
      <div className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 py-2 flex justify-end items-center gap-1">
          {client?.id && (
            <NotificationBell
              recipientType="client"
              recipientId={client.id}
              pushScope="client"
              pushClientId={client.id}
            />
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>

      {showVitrine && showcaseImages.length > 0 && (
        <Vitrine images={showcaseImages} onClose={() => setShowVitrine(false)} />
      )}

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Tabs
          defaultValue="booking"
          className="space-y-6"
          onValueChange={() => { if (showVitrine) setShowVitrine(false); }}
        >
          <TabsList className={`grid w-full ${establishment.show_catalog ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="booking">
              <Calendar className="h-4 w-4 mr-2 hidden sm:inline" />
              Agendar
            </TabsTrigger>
            <TabsTrigger value="appointments">
              <Clock className="h-4 w-4 mr-2 hidden sm:inline" />
              Agendamentos
            </TabsTrigger>
            {establishment.show_catalog && (
              <TabsTrigger value="services">
                <Scissors className="h-4 w-4 mr-2 hidden sm:inline" />
                Serviços
              </TabsTrigger>
            )}
          </TabsList>

          {/* Booking Tab */}
          <TabsContent value="booking" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Agendar Serviço</h2>
            </div>
            
            <Card>
              <CardContent className="p-6 text-center">
                <Calendar className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Pronto para agendar?</h3>
                <p className="text-muted-foreground mb-4">
                  Escolha o serviço, data e horário de sua preferência
                </p>
                <Button onClick={() => { setIsBooking(true); setBookingStep(1); }}>
                  Iniciar Agendamento
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Appointments Tab */}
          <TabsContent value="appointments" className="space-y-4">
            <h2 className="text-lg font-semibold">Meus Agendamentos</h2>

            {appointments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum agendamento encontrado</p>
                </CardContent>
              </Card>
            ) : (
              appointments.map((appointment) => (
                <Card key={appointment.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{appointment.services?.name}</h3>
                          {getStatusBadge(appointment.status)}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(appointment.scheduled_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(appointment.scheduled_at), "HH:mm")}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {appointment.professionals?.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {establishment.show_catalog && (
                          <p className="font-bold text-accent">
                            R$ {Number(appointment.price).toFixed(2)}
                          </p>
                        )}
                        {appointment.status === "pending" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelAppointment(appointment.id)}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Services Tab */}
          {establishment.show_catalog && (
            <TabsContent value="services" className="space-y-4">
              <h2 className="text-lg font-semibold">Nossos Serviços</h2>
              
              {services.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Scissors className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhum serviço disponível</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {services.map((service) => (
                    <Card key={service.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{service.name}</h3>
                            {service.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {service.description}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground mt-2">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {service.duration_minutes} min
                            </p>
                          </div>
                          <p className="font-bold text-accent text-lg">
                            R$ {Number(service.price).toFixed(2)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Booking Dialog */}
      <Dialog open={isBooking} onOpenChange={(open) => {
        setIsBooking(open);
        if (!open) {
          setBookingStep(1);
          setSelectedService(null);
          setSelectedProfessional(null);
          setSelectedDate(null);
          setSelectedTime(null);
          setPolicyAccepted(false);
          setShowClosedMessage(false);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {bookingStep === 1 && "Escolha o serviço"}
              {bookingStep === 2 && "Escolha o profissional"}
              {bookingStep === 3 && "Escolha data e horário"}
              {bookingStep === 4 && "Confirmar agendamento"}
            </DialogTitle>
            <DialogDescription>Passo {bookingStep} de 4</DialogDescription>
          </DialogHeader>

          {/* Header de Resumo fixo: aparece a partir do passo 2 quando o serviço foi escolhido */}
          {bookingStep > 1 && selectedService && (
            <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-muted/40 border-y space-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Serviço selecionado
                </p>
                <p className="text-sm font-semibold">{selectedService.name}</p>
              </div>
              {selectedProfessional && (
                <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                      Profissional
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Avatar className="h-7 w-7">
                        <AvatarImage
                          src={selectedProfessional.avatar_url || undefined}
                          alt={selectedProfessional.name}
                        />
                        <AvatarFallback>
                          <User className="h-3.5 w-3.5" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-semibold">{selectedProfessional.name}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Service */}
          {bookingStep === 1 && (
            <div className="space-y-2">
              {services.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum serviço disponível
                </p>
              )}
              {services.map((service) => (
                <Card
                  key={service.id}
                  className={`cursor-pointer transition-colors hover:border-primary ${
                    selectedService?.id === service.id ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedService(service)}
                >
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold">{service.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {service.duration_minutes} min
                      </p>
                    </div>
                    <p className="font-bold text-accent">
                      R$ {Number(service.price).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Step 2: Professional - filtrado por disponibilidade do dia se data já estiver escolhida */}
          {bookingStep === 2 && selectedService && (() => {
            const allProfs = getProfessionalsForService(selectedService.id);
            const profsForDay = selectedDate
              ? allProfs.filter((p) => availability.getWorkingHoursForDay(selectedDate, p.id) !== null)
              : allProfs;

            return (
              <div className="space-y-2">
                {selectedDate && profsForDay.length < allProfs.length && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Mostrando apenas profissionais que trabalham em{" "}
                      {format(selectedDate, "EEEE", { locale: ptBR })}.
                    </AlertDescription>
                  </Alert>
                )}
                <Card
                  className={`cursor-pointer transition-colors hover:border-primary ${
                    !selectedProfessional ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedProfessional(null)}
                >
                  <CardContent className="p-4">
                    <h4 className="font-semibold">Sem preferência</h4>
                    <p className="text-xs text-muted-foreground">
                      Atribuir automaticamente o profissional disponível
                    </p>
                  </CardContent>
                </Card>
                {profsForDay.map((prof) => (
                  <Card
                    key={prof.id}
                    className={`cursor-pointer transition-colors hover:border-primary ${
                      selectedProfessional?.id === prof.id ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => setSelectedProfessional(prof)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={prof.avatar_url || undefined} alt={prof.name} />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold">{prof.name}</h4>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {profsForDay.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum profissional trabalha nesta data. Volte e escolha outra.
                  </p>
                )}
              </div>
            );
          })()}

          {/* Step 3: Date (Calendário Mensal) & Time */}
          {bookingStep === 3 && selectedService && (
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Data</Label>
                <div className="flex justify-center">
                  <CalendarPicker
                    mode="single"
                    locale={ptBR}
                    selected={selectedDate ?? undefined}
                    onSelect={(d) => d && handleDateSelect(d)}
                    fromDate={startOfDay(new Date())}
                    toDate={addDays(new Date(), 60)}
                    disabled={(date) => {
                      if (isBefore(startOfDay(date), startOfDay(new Date()))) return true;
                      // Se profissional escolhido, desabilitar dias em que ele não trabalha
                      if (selectedProfessional) {
                        if (availability.getWorkingHoursForDay(date, selectedProfessional.id) === null) {
                          return true;
                        }
                      }
                      // Sempre desabilita dias fechados do estabelecimento
                      return !availability.isEstablishmentOpen(date);
                    }}
                    className="rounded-md border pointer-events-auto"
                  />
                </div>
              </div>

              {showClosedMessage && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Estabelecimento fechado nesta data.
                    {nextAvailableSlot && (
                      <Button
                        variant="link"
                        className="px-1 h-auto"
                        onClick={handleAcceptSuggestedSlot}
                      >
                        Ver próximo horário disponível
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {selectedDate && !showClosedMessage && (() => {
                // Estritamente apenas slots realmente disponíveis (sem sobreposição)
                const slots = generateAvailableSlots(
                  selectedDate,
                  selectedProfessional?.id || null,
                  selectedService.duration_minutes
                ).filter((slot) => slot.available === true);

                return (
                  <div>
                    <Label className="mb-2 block">Horário</Label>
                    {slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum horário disponível nesta data
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {slots.map((slot) => (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => setSelectedTime(slot.time)}
                            className={`px-2 py-2 rounded-md border text-sm transition-colors ${
                              selectedTime === slot.time
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary"
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 4: Confirm */}
          {bookingStep === 4 && selectedService && selectedDate && selectedTime && (
            <div className="space-y-3">
              <Card>
                <CardContent className="p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serviço:</span>
                    <span className="font-semibold">{selectedService.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Profissional:</span>
                    {selectedProfessional ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={selectedProfessional.avatar_url || undefined}
                            alt={selectedProfessional.name}
                          />
                          <AvatarFallback>
                            <User className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{selectedProfessional.name}</span>
                      </div>
                    ) : (
                      <span className="font-semibold">Sem preferência</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="font-semibold">
                      {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horário:</span>
                    <span className="font-semibold">{selectedTime}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-bold text-accent">
                      R$ {Number(selectedService.price).toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {establishment.cancellation_policy && (
                <div className="space-y-2">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs whitespace-pre-wrap">
                      {establishment.cancellation_policy}
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="policy"
                      checked={policyAccepted}
                      onCheckedChange={(checked) => setPolicyAccepted(checked === true)}
                    />
                    <Label htmlFor="policy" className="text-xs leading-tight">
                      Li e aceito a política de cancelamento
                    </Label>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (bookingStep === 1) {
                  setIsBooking(false);
                } else {
                  setBookingStep(bookingStep - 1);
                }
              }}
              disabled={confirming}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {bookingStep === 1 ? "Cancelar" : "Voltar"}
            </Button>
            {bookingStep < 4 ? (
              <Button
                onClick={() => setBookingStep(bookingStep + 1)}
                disabled={
                  (bookingStep === 1 && !selectedService) ||
                  (bookingStep === 3 && (!selectedDate || !selectedTime))
                }
              >
                Continuar
              </Button>
            ) : (
              <Button onClick={handleBookingSubmit} disabled={confirming}>
                {confirming && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Confirmar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Assistant Chat */}
      <EstablishmentAIChat
        establishmentId={establishment.id}
        establishmentName={establishment.name}
        clientData={client ? {
          id: client.id,
          name: client.name,
          phone: client.phone,
        } : null}
      />
    </div>
  );
};

export default ClientPortal;
