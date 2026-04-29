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
import { Coins, Wallet, Clock } from "lucide-react";
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
  pending: "Aguardando aprovação",
  approved: "Aprovada",
  paid: "Paga",
  cancelled: "Cancelada",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  approved: "secondary",
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
    } catch (e) {
      console.error("Error loading commissions:", e);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const acc = { pending: 0, approved: 0, paid: 0 };
    for (const c of commissions) {
      const v = Number(c.commission_amount) || 0;
      if (c.status === "pending") acc.pending += v;
      else if (c.status === "approved") acc.approved += v;
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" /> A aprovar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(totals.pending)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Coins className="h-4 w-4" /> Aprovadas (a pagar)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(totals.approved)}</p>
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
