import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, Building2, Activity, Search, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIFailure {
  id: string;
  title: string;
  body: string;
  created_at: string;
  data: any;
}

interface Row {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  granted_at: string | null;
  revoked_at: string | null;
}

export default function AdminEdu() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ active: 0, total_analyses: 0 });
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: ests }, { data: access }, { data: countRow }] = await Promise.all([
      supabase.from("establishments").select("id, name, slug").order("name"),
      supabase.from("edu_access_control").select("establishment_id, is_active, granted_at, revoked_at"),
      supabase.from("client_hair_profiles").select("id", { count: "exact", head: true }),
    ]);

    const accMap = new Map((access ?? []).map((a) => [a.establishment_id, a]));
    const merged: Row[] = (ests ?? []).map((e) => {
      const a = accMap.get(e.id);
      return {
        id: e.id,
        name: e.name,
        slug: e.slug,
        is_active: !!a?.is_active,
        granted_at: a?.granted_at ?? null,
        revoked_at: a?.revoked_at ?? null,
      };
    });
    setRows(merged);
    setStats({
      active: merged.filter((m) => m.is_active).length,
      total_analyses: (countRow as any)?.count ?? 0,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (row: Row, next: boolean) => {
    setSavingId(row.id);
    const payload = next
      ? {
          establishment_id: row.id,
          is_active: true,
          granted_by: user?.id ?? null,
          granted_at: new Date().toISOString(),
          revoked_at: null,
        }
      : {
          establishment_id: row.id,
          is_active: false,
          revoked_at: new Date().toISOString(),
        };

    const { error } = await supabase
      .from("edu_access_control")
      .upsert(payload, { onConflict: "establishment_id" });

    setSavingId(null);
    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
      return;
    }
    toast.success(next ? `Edu ativado para ${row.name}` : `Edu desativado para ${row.name}`);
    load();
  };

  const filtered = rows.filter(
    (r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.slug.includes(search.toLowerCase()),
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Gestão IA (Edu)</h1>
            <p className="text-muted-foreground">Ative ou desative o Consultor Capilar Edu para cada salão.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salões com Edu ativo</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de salões</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rows.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Análises realizadas</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_analyses}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Salões cadastrados</CardTitle>
            <CardDescription>O acesso ao Edu é exclusivo do super admin. Salões não podem assinar.</CardDescription>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salão</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status Edu</TableHead>
                    <TableHead className="text-right">Controle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.slug}</TableCell>
                      <TableCell>
                        {row.is_active ? (
                          <Badge className="bg-green-600">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={row.is_active}
                          disabled={savingId === row.id}
                          onCheckedChange={(v) => toggle(row, v)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum salão encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
