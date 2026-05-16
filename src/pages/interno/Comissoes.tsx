import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { InternoLayout } from "@/components/layouts/InternoLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Coins, Wallet, Clock, Trophy } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type CommissionRow = {
  id: string;
  reference_value: number;
  commission_amount: number;
  description: string | null;
  status: "pending" | "approved" | "paid" | "cancelled";
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Acerto Pendente",
  approved: "Acerto Pendente",
  paid: "Paga",
  cancelled: "Cancelada",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  approved: "outline",
  paid: "default",
  cancelled: "destructive",
};

export default function InternoComissoes() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [professionalName, setProfessionalName] = useState<string | null>(null);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<Array<{
    id: string;
    name: string;
    motivational_message: string | null;
    commission_type: string;
    commission_value: number;
    challenge_target: number | null;
    challenge_end_date: string | null;
  }>>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/interno/${slug}/comissoes`);
      return;
    }
    if (slug && user) load();
  }, [slug, user, authLoading]);

  const load = async () => {
    setLoading(true);
    try {
      // Resolve establishment by slug
      const { data: est } = await supabase
        .from("establishments")
        .select("id")
        .eq("slug", slug)
        .single();

      if (!est) {
        navigate("/");
        return;
      }

      // Resolve the professional row tied to this user in this establishment.
      const { data: prof } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", est.id)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!prof) {
        // Not a professional in this establishment — nothing to show.
        setCommissions([]);
        setProfessionalName(null);
        return;
      }

      setProfessionalName(prof.name);

      const { data, error } = await supabase
        .from("professional_commissions")
        .select("id, reference_value, commission_amount, description, status, created_at, approved_at, paid_at")
        .eq("professional_id", prof.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCommissions((data as CommissionRow[]) || []);

      // Active challenges of the establishment
      const nowIso = new Date().toISOString();
      const { data: challenges } = await supabase
        .from("commission_rules")
        .select("id, name, motivational_message, commission_type, commission_value, challenge_target, challenge_start_date, challenge_end_date")
        .eq("establishment_id", est.id)
        .eq("is_challenge", true)
        .eq("is_active", true);
      const filtered = (challenges || []).filter((c: any) => {
        if (c.challenge_start_date && c.challenge_start_date > nowIso) return false;
        if (c.challenge_end_date && c.challenge_end_date < nowIso) return false;
        return true;
      });
      setActiveChallenges(filtered as any);
    } catch (e) {
      console.error("Error loading commissions:", e);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const acc = { pending: 0, paid: 0 };
    for (const c of commissions) {
      const v = Number(c.commission_amount) || 0;
      if (c.status === "pending" || c.status === "approved") acc.pending += v;
      else if (c.status === "paid") acc.paid += v;
    }
    return acc;
  }, [commissions]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (authLoading || loading) {
    return (
      <InternoLayout>
        <Skeleton className="h-96" />
      </InternoLayout>
    );
  }

  return (
    <InternoLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Minhas Comissões</h1>
          <p className="text-muted-foreground text-sm">
            {professionalName
              ? `Extrato individual de ${professionalName}`
              : "Você não está vinculada como profissional neste salão."}
          </p>
        </div>

        {activeChallenges.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" /> Desafios em andamento
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {activeChallenges.map((ch) => (
                <Card key={ch.id} className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{ch.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {ch.motivational_message && (
                      <p className="text-sm italic text-muted-foreground whitespace-pre-wrap border-l-2 border-primary pl-3">
                        "{ch.motivational_message}"
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {ch.challenge_target && (
                        <span>Meta: <strong className="text-foreground">{fmt(ch.challenge_target)}</strong></span>
                      )}
                      <span>
                        Bonificação:{" "}
                        <strong className="text-foreground">
                          {ch.commission_type === "percentage"
                            ? `${ch.commission_value}%`
                            : fmt(ch.commission_value)}
                        </strong>
                      </span>
                      {ch.challenge_end_date && (
                        <span>
                          Até{" "}
                          <strong className="text-foreground">
                            {format(parseISO(ch.challenge_end_date), "dd/MM/yyyy", { locale: ptBR })}
                          </strong>
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" /> Acerto Pendente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(totals.pending)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-4 w-4" /> Já recebidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(totals.paid)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Extrato</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {commissions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma comissão registrada ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(parseISO(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.description || "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {fmt(Number(c.reference_value) || 0)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {fmt(Number(c.commission_amount) || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[c.status] || "outline"}>
                            {STATUS_LABEL[c.status] || c.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Esta tela é somente leitura. Dúvidas sobre valores ou status devem ser
          tratadas com a gestão do salão.
        </p>
      </div>
    </InternoLayout>
  );
}
