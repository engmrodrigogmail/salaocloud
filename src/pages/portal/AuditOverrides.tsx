import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Filter, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerEstablishment } from "@/hooks/useOwnerEstablishment";
import { formatDateTime } from "@/lib/dateUtils";

interface AuditRow {
  id: string;
  created_at: string;
  action_type: string;
  reason: string | null;
  old_value: any;
  new_value: any;
  target_type: string | null;
  manager_professional_id: string;
  tab_id: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  manual_discount: "Desconto manual",
  item_price_override: "Preço de item alterado",
  commission_manual_add: "Comissão manual adicionada",
  commission_manual_delete: "Comissão manual removida",
  commission_value_override: "Valor de comissão ajustado",
};

export default function AuditOverrides() {
  const { slug } = useParams<{ slug: string }>();
  const { guard } = useOwnerEstablishment(slug);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [managers, setManagers] = useState<Record<string, string>>({});
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: est } = await supabase
        .from("establishments")
        .select("id")
        .eq("slug", slug)
        .single();
      if (!est) return;

      const { data: audit } = await supabase
        .from("manager_pin_audit")
        .select("*")
        .eq("establishment_id", est.id)
        .order("created_at", { ascending: false })
        .limit(500);

      const { data: pros } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", est.id);

      if (cancelled) return;
      setRows((audit ?? []) as AuditRow[]);
      setManagers(
        Object.fromEntries((pros ?? []).map((p: any) => [p.id, p.name])),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action_type !== actionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const inReason = r.reason?.toLowerCase().includes(q);
        const inManager = managers[r.manager_professional_id]
          ?.toLowerCase()
          .includes(q);
        if (!inReason && !inManager) return false;
      }
      return true;
    });
  }, [rows, actionFilter, search, managers]);

  const renderValue = (v: any) => {
    if (v == null) return "—";
    if (typeof v === "object") {
      return (
        <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
          {JSON.stringify(v)}
        </code>
      );
    }
    return String(v);
  };

  if (guard) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Auditoria de overrides</h1>
            <p className="text-sm text-muted-foreground">
              Histórico de ações autorizadas por PIN de gerente (descontos,
              alteração de preço e comissão).
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de ação</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Buscar (gerente ou motivo)</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ex: Maria, desconto cliente VIP…"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {loading ? "Carregando…" : `${filtered.length} registro(s)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Nenhum override registrado para os filtros atuais.
              </p>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => (
                  <div
                    key={r.id}
                    className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">
                          {ACTION_LABELS[r.action_type] ?? r.action_type}
                        </Badge>
                        <span className="text-sm font-medium">
                          {managers[r.manager_professional_id] ??
                            "Gerente desconhecido"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">
                          De:{" "}
                        </span>
                        {renderValue(r.old_value)}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">
                          Para:{" "}
                        </span>
                        {renderValue(r.new_value)}
                      </div>
                    </div>
                    {r.reason && (
                      <p className="text-xs italic text-muted-foreground mt-2">
                        “{r.reason}”
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
