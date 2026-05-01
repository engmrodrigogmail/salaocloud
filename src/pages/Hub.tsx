import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, LogOut, ShieldCheck, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-salaocloud-v5.png";
import salonBg from "@/assets/salon-dark-bg.png";

interface AccessTarget {
  kind: "owner" | "professional" | "client" | "super_admin";
  establishment_id: string;
  establishment_name: string;
  establishment_slug: string;
  establishment_logo_url: string | null;
  is_manager: boolean;
  must_change_password: boolean;
  client_id: string | null;
}

/**
 * Hub central de acesso pós-login.
 *
 * Regras:
 *  - super_admin → vai direto para /admin
 *  - 1 destino → auto-redirect
 *  - 2+ destinos → mostra seletor (cards)
 *  - 0 destinos → /onboarding (caso autenticado mas sem vínculo)
 *
 * Aceita acesso autenticado (Supabase Auth) e sessões cliente
 * (localStorage de qualquer salão). O hub deduplica e une tudo.
 */
export default function Hub() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<AccessTarget[]>([]);
  const [didAutoRedirect, setDidAutoRedirect] = useState(false);

  // Coleta sessões cliente persistidas no localStorage (independente do Supabase Auth).
  const localClientSessions = useMemo(() => {
    const out: { slug: string; clientId: string; email: string | null }[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith("client_portal_session:")) continue;
        const slug = key.slice("client_portal_session:".length);
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.clientId) {
            out.push({ slug, clientId: parsed.clientId, email: parsed.email ?? null });
          }
        } catch { /* ignore corrupted */ }
      }
    } catch { /* ignore */ }
    return out;
  }, []);

  // Removido auto-redirect para super_admin: agora ele aparece como mais uma
  // opção no picker quando o usuário também tem acesso a salões/clientes.

  useEffect(() => {
    let cancelled = false;

    const fetchTargets = async () => {
      setLoading(true);

      const collected: AccessTarget[] = [];

      // 1) Destinos via Supabase Auth (owner/professional/client por email)
      if (user) {
        const { data, error } = await supabase.rpc(
          "get_user_access_targets_full" as never,
          { _user_id: user.id, _email: user.email ?? null } as never
        );
        if (!error && Array.isArray(data)) {
          for (const t of data as AccessTarget[]) collected.push(t);
        } else if (error) {
          console.error("get_user_access_targets_full failed", error);
        }
      }

      // 2) Sessões cliente persistidas (localStorage) — busca dados dos salões
      if (localClientSessions.length > 0) {
        const slugs = localClientSessions.map((s) => s.slug);
        const { data: ests } = await supabase
          .from("establishments")
          .select("id, name, slug, logo_url")
          .in("slug", slugs);
        if (ests) {
          for (const session of localClientSessions) {
            const est = ests.find((e: any) => e.slug === session.slug);
            if (!est) continue;
            collected.push({
              kind: "client",
              establishment_id: est.id,
              establishment_name: est.name,
              establishment_slug: est.slug,
              establishment_logo_url: est.logo_url ?? null,
              is_manager: false,
              must_change_password: false,
              client_id: session.clientId,
            });
          }
        }
      }

      // 3) Acesso de super-admin (se aplicável)
      if (user && role === "super_admin") {
        collected.push({
          kind: "super_admin",
          establishment_id: "__super_admin__",
          establishment_name: "Painel Super Admin",
          establishment_slug: "",
          establishment_logo_url: null,
          is_manager: false,
          must_change_password: false,
          client_id: null,
        });
      }

      // Deduplicar por (kind, establishment_id)
      const seen = new Set<string>();
      const deduped = collected.filter((t) => {
        const k = `${t.kind}:${t.establishment_id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // Ordenar: super_admin > owner > professional > client; depois por nome
      const order: Record<AccessTarget["kind"], number> = { super_admin: 0, owner: 1, professional: 2, client: 3 };
      deduped.sort((a, b) => {
        const d = order[a.kind] - order[b.kind];
        if (d !== 0) return d;
        return a.establishment_name.localeCompare(b.establishment_name);
      });

      if (cancelled) return;
      setTargets(deduped);
      setLoading(false);
    };

    if (!authLoading) {
      fetchTargets();
    }

    return () => { cancelled = true; };
  }, [authLoading, user, localClientSessions]);

  const goTo = (t: AccessTarget) => {
    if (t.kind === "owner") navigate(`/portal/${t.establishment_slug}`);
    else if (t.kind === "professional") navigate(`/interno/${t.establishment_slug}`);
    else navigate(`/${t.establishment_slug}`);
  };

  // Auto-redirect quando há exatamente 1 destino
  useEffect(() => {
    if (loading || authLoading || didAutoRedirect) return;
    if (targets.length === 1) {
      setDidAutoRedirect(true);
      goTo(targets[0]);
    } else if (targets.length === 0 && user) {
      // Autenticado mas sem nenhum vínculo → onboarding
      setDidAutoRedirect(true);
      navigate("/onboarding", { replace: true });
    } else if (targets.length === 0 && !user && localClientSessions.length === 0) {
      // Sem auth E sem sessão cliente local → manda pro login
      setDidAutoRedirect(true);
      navigate("/auth", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, authLoading, targets, didAutoRedirect, user]);

  const handleLogoutAll = async () => {
    // Limpa sessões cliente e Supabase Auth
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("client_portal_session:")) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    await signOut();
    navigate("/", { replace: true });
  };

  if (authLoading || loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center salon-photo-bg"
        style={{ ["--salon-bg-image" as any]: `url(${salonBg})` }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Picker (2+ destinos)
  return (
    <div
      className="min-h-screen flex items-center justify-center salon-photo-bg px-4 py-10"
      style={{ ["--salon-bg-image" as any]: `url(${salonBg})` }}
    >
      <div className="max-w-lg w-full premium-card p-6 sm:p-8">
        <img src={logo} alt="Salão Cloud" className="h-12 w-auto mb-6 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-center mb-2">
          Onde você quer acessar?
        </h1>
        <p className="text-muted-foreground text-center mb-6">
          Você tem {targets.length} formas de acesso disponíveis
        </p>

        <div className="space-y-3">
          {targets.map((t) => {
            const Icon = t.kind === "owner" ? ShieldCheck : t.kind === "professional" ? Users : User;
            const label =
              t.kind === "owner"
                ? "Painel do dono"
                : t.kind === "professional"
                ? (t.is_manager ? "Área interna (Gerente)" : "Área interna")
                : "Área do cliente";
            return (
              <button
                key={`${t.kind}-${t.establishment_id}`}
                onClick={() => goTo(t)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary hover:shadow-md transition-all text-left"
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {t.establishment_logo_url ? (
                    <img src={t.establishment_logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{t.establishment_name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t flex justify-center">
          <Button variant="ghost" size="sm" onClick={handleLogoutAll} className="text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" />
            Sair de todas as contas
          </Button>
        </div>
      </div>
    </div>
  );
}
