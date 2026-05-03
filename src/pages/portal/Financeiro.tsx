import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";
import { useFinance, type ConsolidatedRow, type EntryType, type FinanceEntry, type RecurringTemplate } from "@/hooks/useFinance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ManagerPinDialog, type ManagerPinAuthorization } from "@/components/security/ManagerPinDialog";
import { EntryFormDialog } from "@/components/finance/EntryFormDialog";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Download,
  Lock,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTip, PieChart, Pie, Cell, Legend } from "recharts";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, startOfDay, endOfDay, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PeriodKey = "today" | "week" | "month" | "last_month" | "custom";

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#94a3b8"];

export default function Financeiro() {
  const { slug } = useParams<{ slug: string }>();
  const access = useFinanceAccess(slug);
  const [pinOk, setPinOk] = useState(false);
  const [managerAuth, setManagerAuth] = useState<ManagerPinAuthorization | null>(null);

  // gerente precisa de PIN
  const requiresPin = access.role === "manager" && !pinOk;

  if (access.guard) {
    return (
      <PortalLayout>
        <Skeleton className="h-32 w-full" />
      </PortalLayout>
    );
  }

  if (requiresPin) {
    return (
      <PortalLayout>
        <Card className="max-w-md mx-auto mt-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Área financeira
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              O acesso ao módulo financeiro exige autorização de gerente.
            </p>
            <ManagerPinDialog
              open
              onOpenChange={(o) => { if (!o && !pinOk) window.history.back(); }}
              establishmentId={access.establishmentId!}
              reason="Acessar módulo financeiro"
              onAuthorized={(auth) => { setManagerAuth(auth); setPinOk(true); }}
            />
          </CardContent>
        </Card>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <FinanceContent
        establishmentId={access.establishmentId!}
        role={access.role!}
        managerAuth={managerAuth}
      />
    </PortalLayout>
  );
}

function FinanceContent({
  establishmentId,
  role,
  managerAuth,
}: {
  establishmentId: string;
  role: "owner" | "manager";
  managerAuth: ManagerPinAuthorization | null;
}) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const { from, to, prevFrom, prevTo, label } = useMemo(() => {
    const today = new Date();
    let f: Date, t: Date;
    switch (period) {
      case "today": f = startOfDay(today); t = endOfDay(today); break;
      case "week": f = startOfWeek(today, { weekStartsOn: 0 }); t = endOfWeek(today, { weekStartsOn: 0 }); break;
      case "last_month": {
        const lm = subMonths(today, 1);
        f = startOfMonth(lm); t = endOfMonth(lm); break;
      }
      case "custom": f = new Date(customFrom + "T00:00:00"); t = new Date(customTo + "T23:59:59"); break;
      case "month":
      default: f = startOfMonth(today); t = endOfMonth(today); break;
    }
    const days = Math.max(1, differenceInDays(t, f) + 1);
    const pt = addDays(f, -1);
    const pf = addDays(pt, -(days - 1));
    return {
      from: format(f, "yyyy-MM-dd"),
      to: format(t, "yyyy-MM-dd"),
      prevFrom: format(pf, "yyyy-MM-dd"),
      prevTo: format(pt, "yyyy-MM-dd"),
      label: `${format(f, "dd/MM/yyyy")} – ${format(t, "dd/MM/yyyy")}`,
    };
  }, [period, customFrom, customTo]);

  const finance = useFinance(establishmentId, from, to);
  const prev = useFinance(establishmentId, prevFrom, prevTo);

  const totals = useMemo(() => computeTotals(finance.consolidated), [finance.consolidated]);
  const prevTotals = useMemo(() => computeTotals(prev.consolidated), [prev.consolidated]);

  const [entryDialog, setEntryDialog] = useState<{ open: boolean; type: EntryType; entry?: FinanceEntry | null }>({ open: false, type: "expense" });

  const auditCtx = role === "manager" && managerAuth
    ? { managerProfessionalId: managerAuth.managerProfessionalId, reason: "Operação no módulo financeiro" }
    : undefined;

  const handleSaveEntry = async (
    payload: Partial<FinanceEntry>,
    extra?: { recurring?: { day_of_month: number } },
  ) => {
    const ok = await finance.saveEntry(payload, auditCtx);
    if (ok && extra?.recurring && payload.category_id && payload.type) {
      await finance.saveRecurring({
        category_id: payload.category_id,
        type: payload.type,
        amount: payload.amount!,
        description: payload.description!,
        day_of_month: extra.recurring.day_of_month,
        is_active: true,
      });
    }
    return ok;
  };

  const exportCsv = () => {
    const rows = [
      ["Data", "Tipo", "Categoria", "Descrição", "Forma de Pagamento", "Status", "Valor", "Origem"],
      ...finance.consolidated.map((r) => [
        r.date,
        r.type === "revenue" ? "Receita" : "Despesa",
        r.category_name,
        r.description.replace(/"/g, "''"),
        r.payment_method ?? "",
        r.status === "paid" ? "Pago" : "Pendente",
        r.amount.toFixed(2).replace(".", ","),
        r.is_auto ? "Automático" : "Manual",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" /> Financeiro
          </h1>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="last_month">Mês passado</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {period === "custom" && (
            <div className="flex items-center gap-1">
              <Input type="date" className="w-[140px]" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span>–</span>
              <Input type="date" className="w-[140px]" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Atenção: taxas de maquininha e impostos não são deduzidos automaticamente das comandas. Lance-os como despesa manual.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="dre">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="dre">Resumo</TabsTrigger>
          <TabsTrigger value="revenue">Receitas</TabsTrigger>
          <TabsTrigger value="expense">Despesas</TabsTrigger>
          <TabsTrigger value="recurring">Recorrentes</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="dre" className="space-y-4">
          <DreTab
            totals={totals}
            prevTotals={prevTotals}
            consolidated={finance.consolidated}
            onExport={exportCsv}
          />
        </TabsContent>

        <TabsContent value="revenue">
          <ListTab
            type="revenue"
            rows={finance.consolidated.filter((r) => r.type === "revenue")}
            entries={finance.entries}
            onNew={() => setEntryDialog({ open: true, type: "revenue" })}
            onEdit={(e) => setEntryDialog({ open: true, type: e.type, entry: e })}
            onDelete={(id) => finance.deleteEntry(id, auditCtx)}
          />
        </TabsContent>

        <TabsContent value="expense">
          <ListTab
            type="expense"
            rows={finance.consolidated.filter((r) => r.type === "expense")}
            entries={finance.entries}
            onNew={() => setEntryDialog({ open: true, type: "expense" })}
            onEdit={(e) => setEntryDialog({ open: true, type: e.type, entry: e })}
            onDelete={(id) => finance.deleteEntry(id, auditCtx)}
          />
        </TabsContent>

        <TabsContent value="recurring">
          <RecurringTab finance={finance} />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab finance={finance} role={role} />
        </TabsContent>
      </Tabs>

      <EntryFormDialog
        open={entryDialog.open}
        onOpenChange={(o) => setEntryDialog((s) => ({ ...s, open: o, entry: o ? s.entry : null }))}
        establishmentId={establishmentId}
        defaultType={entryDialog.type}
        categories={finance.categories}
        entry={entryDialog.entry ?? null}
        onSave={handleSaveEntry}
      />
    </div>
  );
}

function computeTotals(rows: ConsolidatedRow[]) {
  let revenue = 0, expense = 0, pending = 0;
  const byCat: Record<string, number> = {};
  const byPayment: Record<string, { rev: number; exp: number }> = {};
  const byDay: Record<string, { rev: number; exp: number }> = {};
  for (const r of rows) {
    const paid = r.status === "paid";
    if (r.type === "revenue") {
      if (paid) revenue += Number(r.amount);
    } else {
      if (paid) expense += Number(r.amount);
      else pending += Number(r.amount);
      if (paid) byCat[r.category_name] = (byCat[r.category_name] ?? 0) + Number(r.amount);
    }
    if (paid && r.payment_method) {
      byPayment[r.payment_method] ??= { rev: 0, exp: 0 };
      if (r.type === "revenue") byPayment[r.payment_method].rev += Number(r.amount);
      else byPayment[r.payment_method].exp += Number(r.amount);
    }
    byDay[r.date] ??= { rev: 0, exp: 0 };
    if (paid) {
      if (r.type === "revenue") byDay[r.date].rev += Number(r.amount);
      else byDay[r.date].exp += Number(r.amount);
    }
  }
  const profit = revenue - expense;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { revenue, expense, pending, profit, margin, byCat, byPayment, byDay };
}

function Delta({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${up ? "text-emerald-600" : "text-destructive"}`}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function DreTab({
  totals, prevTotals, consolidated, onExport,
}: {
  totals: ReturnType<typeof computeTotals>;
  prevTotals: ReturnType<typeof computeTotals>;
  consolidated: ConsolidatedRow[];
  onExport: () => void;
}) {
  const barData = Object.entries(totals.byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date: format(new Date(date + "T00:00:00"), "dd/MM"), Receitas: v.rev, Despesas: v.exp }));

  const catEntries = Object.entries(totals.byCat).sort((a, b) => b[1] - a[1]);
  const top5 = catEntries.slice(0, 5);
  const others = catEntries.slice(5).reduce((s, [, v]) => s + v, 0);
  const pieData = [...top5.map(([name, value]) => ({ name, value })), ...(others > 0 ? [{ name: "Outros", value: others }] : [])];

  const topExpenses = consolidated
    .filter((r) => r.type === "expense" && r.status === "paid")
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Faturamento" value={fmtMoney(totals.revenue)} delta={<Delta current={totals.revenue} prev={prevTotals.revenue} />} />
        <SummaryCard label="Despesas" value={fmtMoney(totals.expense)} delta={<Delta current={totals.expense} prev={prevTotals.expense} />} />
        <SummaryCard label="Lucro líquido" value={fmtMoney(totals.profit)} valueClass={totals.profit >= 0 ? "text-emerald-600" : "text-destructive"} />
        <SummaryCard label="Margem" value={`${totals.margin.toFixed(1)}%`} />
        <SummaryCard label="Pendências" value={fmtMoney(totals.pending)} valueClass={totals.pending > 0 ? "text-orange-600" : ""} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Receitas vs Despesas</CardTitle></CardHeader>
          <CardContent className="h-64">
            {barData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTip formatter={(v: number) => fmtMoney(v)} />
                  <Legend />
                  <Bar dataKey="Receitas" fill="hsl(var(--primary))" />
                  <Bar dataKey="Despesas" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Despesas por categoria</CardTitle></CardHeader>
          <CardContent className="h-64">
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem despesas no período</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RTip formatter={(v: number) => fmtMoney(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Top despesas</CardTitle></CardHeader>
          <CardContent>
            {topExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem despesas no período</p>
            ) : (
              <ul className="space-y-2">
                {topExpenses.map((r) => (
                  <li key={`${r.source}-${r.id}`} className="flex justify-between text-sm">
                    <span className="truncate mr-2">{r.description}</span>
                    <span className="font-medium">{fmtMoney(Number(r.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Por forma de pagamento</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(totals.byPayment).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem registros</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th>Método</th><th className="text-right">Receitas</th><th className="text-right">Despesas</th></tr></thead>
                <tbody>
                  {Object.entries(totals.byPayment).map(([k, v]) => (
                    <tr key={k} className="border-t">
                      <td className="py-1">{k}</td>
                      <td className="text-right">{fmtMoney(v.rev)}</td>
                      <td className="text-right">{fmtMoney(v.exp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onExport}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, valueClass, delta }: { label: string; value: string; valueClass?: string; delta?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold ${valueClass ?? ""}`}>{value}</p>
        {delta}
      </CardContent>
    </Card>
  );
}

function ListTab({
  type, rows, entries, onNew, onEdit, onDelete,
}: {
  type: EntryType;
  rows: ConsolidatedRow[];
  entries: FinanceEntry[];
  onNew: () => void;
  onEdit: (e: FinanceEntry) => void;
  onDelete: (id: string) => void;
}) {
  const entriesById = new Map(entries.map((e) => [e.id, e]));
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={onNew}>
          <Plus className="h-4 w-4 mr-2" /> {type === "revenue" ? "Nova receita" : "Nova despesa"}
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Nenhum lançamento no período</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-2">Data</th>
                  <th className="p-2">Categoria</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2">Forma</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.source}-${r.id}`} className="border-t">
                    <td className="p-2">{format(new Date(r.date + "T00:00:00"), "dd/MM/yyyy")}</td>
                    <td className="p-2">{r.category_name}</td>
                    <td className="p-2">
                      {r.description}
                      {r.is_auto && <Badge variant="secondary" className="ml-2 text-[10px]">Automático</Badge>}
                    </td>
                    <td className="p-2">{r.payment_method ?? "—"}</td>
                    <td className="p-2">
                      <Badge variant={r.status === "paid" ? "default" : "outline"} className={r.status === "pending" ? "border-orange-500 text-orange-600" : ""}>
                        {r.status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-medium">{fmtMoney(Number(r.amount))}</td>
                    <td className="p-2 text-right">
                      {!r.is_auto && entriesById.has(r.id) && (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => onEdit(entriesById.get(r.id)!)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir lançamento?")) onDelete(r.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RecurringTab({ finance }: { finance: ReturnType<typeof useFinance> }) {
  const [editing, setEditing] = useState<RecurringTemplate | null>(null);
  const [form, setForm] = useState({ category_id: "", type: "expense" as EntryType, amount: "", description: "", day_of_month: "1", is_active: true });

  const startEdit = (r: RecurringTemplate) => {
    setEditing(r);
    setForm({
      category_id: r.category_id,
      type: r.type,
      amount: String(r.amount).replace(".", ","),
      description: r.description,
      day_of_month: String(r.day_of_month),
      is_active: r.is_active,
    });
  };

  const handleSave = async () => {
    const amt = parseFloat(form.amount.replace(",", "."));
    if (!form.category_id || !form.description.trim() || !amt) return;
    const ok = await finance.saveRecurring({
      id: editing?.id,
      category_id: form.category_id,
      type: form.type,
      amount: amt,
      description: form.description.trim(),
      day_of_month: parseInt(form.day_of_month) || 1,
      is_active: form.is_active,
    });
    if (ok) {
      setEditing(null);
      setForm({ category_id: "", type: "expense", amount: "", description: "", day_of_month: "1", is_active: true });
    }
  };

  const cats = finance.categories.filter((c) => c.type === form.type);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Repeat className="h-4 w-4" /> {editing ? "Editar recorrente" : "Nova recorrente"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm((s) => ({ ...s, type: v as EntryType, category_id: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="revenue">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dia do mês</Label>
              <Input inputMode="numeric" value={form.day_of_month} onChange={(e) => setForm((s) => ({ ...s, day_of_month: e.target.value.replace(/\D/g, "").slice(0, 2) }))} />
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm((s) => ({ ...s, category_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value.replace(/[^\d.,]/g, "") }))} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave}>{editing ? "Salvar" : "Criar"}</Button>
            {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ category_id: "", type: "expense", amount: "", description: "", day_of_month: "1", is_active: true }); }}>Cancelar</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recorrentes cadastradas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {finance.recurring.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Nenhuma recorrente cadastrada</p>
          ) : (
            <ul className="divide-y">
              {finance.recurring.map((r) => (
                <li key={r.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.type === "expense" ? "Despesa" : "Receita"} · Dia {r.day_of_month} · {fmtMoney(Number(r.amount))}
                      {!r.is_active && " · Inativa"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir recorrente?")) finance.deleteRecurring(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoriesTab({ finance, role }: { finance: ReturnType<typeof useFinance>; role: "owner" | "manager" }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<EntryType>("expense");

  const handleAdd = async () => {
    if (!name.trim()) return;
    const ok = await finance.saveCategory({ name: name.trim(), type });
    if (ok) setName("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Adicionar categoria</CardTitle></CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
            <SelectTrigger className="sm:w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="revenue">Receita</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Nome da categoria" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(["expense", "revenue"] as const).map((t) => (
          <Card key={t}>
            <CardHeader><CardTitle className="text-base">{t === "expense" ? "Despesas" : "Receitas"}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {finance.categories.filter((c) => c.type === t).map((c) => (
                  <li key={c.id} className="p-3 flex items-center justify-between">
                    <span className="text-sm">{c.name} {c.is_system && <Badge variant="secondary" className="ml-2 text-[10px]">Sistema</Badge>}</span>
                    {!c.is_system && (
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir categoria?")) finance.deleteCategory(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {role === "owner" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Configurações</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Label>Quando lançar a despesa de comissão?</Label>
            <Select
              value={finance.settings?.commission_expense_trigger ?? "on_tab_close"}
              onValueChange={(v) => finance.updateSettings(v as any)}
            >
              <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on_tab_close">No fechamento da comanda (regime de competência)</SelectItem>
                <SelectItem value="on_commission_payment">No pagamento ao profissional (regime de caixa)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
