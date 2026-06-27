import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Send, Play, Pencil } from "lucide-react";
import { format } from "date-fns";

type Recipient = {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
  message_type_keys: string[];
  notes: string | null;
};

type MessageType = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  template: string;
  is_active: boolean;
};

type LogRow = {
  id: string;
  message_type_key: string;
  recipient_name: string | null;
  recipient_phone: string;
  status: string;
  error: string | null;
  created_at: string;
  message_body: string;
};

export default function WhatsappReports() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [types, setTypes] = useState<MessageType[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  // recipient form
  const [editing, setEditing] = useState<Recipient | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [fName, setFName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fActive, setFActive] = useState(true);
  const [fKeys, setFKeys] = useState<string[]>(["daily_report"]);
  const [fNotes, setFNotes] = useState("");

  // template editor
  const [editingType, setEditingType] = useState<MessageType | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: t }, { data: l }] = await Promise.all([
      supabase.from("whatsapp_recipients").select("*").order("created_at", { ascending: false }),
      supabase.from("whatsapp_message_types").select("*").order("key"),
      supabase.from("whatsapp_send_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setRecipients((r || []) as Recipient[]);
    setTypes((t || []) as MessageType[]);
    setLogs((l || []) as LogRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setFName(""); setFPhone(""); setFActive(true);
    setFKeys(["daily_report"]); setFNotes("");
    setFormOpen(true);
  };
  const openEdit = (r: Recipient) => {
    setEditing(r);
    setFName(r.name); setFPhone(r.phone); setFActive(r.is_active);
    setFKeys(r.message_type_keys || []); setFNotes(r.notes || "");
    setFormOpen(true);
  };

  const saveRecipient = async () => {
    if (!fName.trim() || !fPhone.trim()) {
      toast.error("Nome e telefone obrigatórios");
      return;
    }
    const payload = {
      name: fName.trim(),
      phone: fPhone.trim(),
      is_active: fActive,
      message_type_keys: fKeys,
      notes: fNotes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("whatsapp_recipients").update(payload).eq("id", editing.id)
      : await supabase.from("whatsapp_recipients").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Destinatário salvo");
    setFormOpen(false);
    load();
  };

  const removeRecipient = async (id: string) => {
    if (!confirm("Excluir este destinatário?")) return;
    const { error } = await supabase.from("whatsapp_recipients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    load();
  };

  const toggleKey = (key: string) => {
    setFKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const saveTemplate = async () => {
    if (!editingType) return;
    const { error } = await supabase
      .from("whatsapp_message_types")
      .update({ template: editingType.template, label: editingType.label, description: editingType.description })
      .eq("id", editingType.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Template salvo");
    setEditingType(null);
    load();
  };

  const runDailyReport = async (testPhone?: string) => {
    toast.info(testPhone ? "Enviando teste..." : "Enviando relatório...");
    const { data, error } = await supabase.functions.invoke("whatsapp-daily-report", {
      body: testPhone ? { test_phone: testPhone } : {},
    });
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    toast.success(`Enviado para ${(data as any)?.sent ?? 0} destinatário(s)`);
    load();
  };

  const previewDailyReport = async () => {
    const { data, error } = await supabase.functions.invoke("whatsapp-daily-report?dry_run=1", {
      body: {},
    });
    if (error) { toast.error(error.message); return; }
    const msg = (data as any)?.message || "(sem prévia)";
    alert(msg);
  };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-8 space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp — Relatórios</h1>
          <p className="text-muted-foreground">
            Envio automático via Z-API. Relatório diário às 20:59 (horário de São Paulo).
          </p>
        </div>

        <Tabs defaultValue="recipients">
          <TabsList>
            <TabsTrigger value="recipients">Destinatários</TabsTrigger>
            <TabsTrigger value="types">Tipos de Mensagem</TabsTrigger>
            <TabsTrigger value="logs">Histórico</TabsTrigger>
          </TabsList>

          {/* RECIPIENTS */}
          <TabsContent value="recipients" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button onClick={openNew}><Plus size={16} className="mr-1" /> Novo destinatário</Button>
                <Button variant="outline" onClick={previewDailyReport}>Prévia do relatório</Button>
                <Button variant="outline" onClick={() => runDailyReport()}>
                  <Send size={16} className="mr-1" /> Enviar agora
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Nome</th>
                      <th className="text-left p-3">Telefone</th>
                      <th className="text-left p-3">Tipos</th>
                      <th className="text-left p-3">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-3">{r.name}</td>
                        <td className="p-3 font-mono">{r.phone}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {(r.message_type_keys || []).map((k) => (
                              <Badge key={k} variant="secondary">{k}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          {r.is_active ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                        </td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => runDailyReport(r.phone)} title="Enviar teste">
                            <Play size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                            <Pencil size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeRecipient(r.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {recipients.length === 0 && !loading && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                        Nenhum destinatário cadastrado
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MESSAGE TYPES */}
          <TabsContent value="types" className="space-y-4">
            {types.map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{t.label} <code className="text-xs text-muted-foreground ml-2">{t.key}</code></span>
                    <Button size="sm" variant="outline" onClick={() => setEditingType(t)}>
                      <Pencil size={14} className="mr-1" /> Editar template
                    </Button>
                  </CardTitle>
                  {t.description && <CardDescription>{t.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded border">{t.template}</pre>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* LOGS */}
          <TabsContent value="logs">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Quando</th>
                      <th className="text-left p-3">Tipo</th>
                      <th className="text-left p-3">Destinatário</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="p-3">{format(new Date(l.created_at), "dd/MM/yyyy HH:mm")}</td>
                        <td className="p-3"><code className="text-xs">{l.message_type_key}</code></td>
                        <td className="p-3">{l.recipient_name || "—"}<br/><span className="font-mono text-xs text-muted-foreground">{l.recipient_phone}</span></td>
                        <td className="p-3">
                          {l.status === "sent"
                            ? <Badge>Enviado</Badge>
                            : <Badge variant="destructive">Falhou</Badge>}
                        </td>
                        <td className="p-3 text-xs text-destructive max-w-md break-words">{l.error || ""}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem envios</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* RECIPIENT DIALOG */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar destinatário" : "Novo destinatário"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={fName} onChange={(e) => setFName(e.target.value)} />
              </div>
              <div>
                <Label>Telefone (com DDD; DDI 55 opcional)</Label>
                <Input value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder="5511999999999" />
              </div>
              <div>
                <Label>Tipos de mensagem</Label>
                <div className="space-y-2 mt-2">
                  {types.map((t) => (
                    <label key={t.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={fKeys.includes(t.key)}
                        onChange={() => toggleKey(t.key)}
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={fActive} onCheckedChange={setFActive} />
                <Label>Ativo</Label>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={saveRecipient}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* TEMPLATE EDITOR */}
        <Dialog open={!!editingType} onOpenChange={(o) => !o && setEditingType(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar template — {editingType?.label}</DialogTitle>
            </DialogHeader>
            {editingType && (
              <div className="space-y-3">
                <div>
                  <Label>Rótulo</Label>
                  <Input
                    value={editingType.label}
                    onChange={(e) => setEditingType({ ...editingType, label: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={editingType.description || ""}
                    onChange={(e) => setEditingType({ ...editingType, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Template</Label>
                  <Textarea
                    value={editingType.template}
                    onChange={(e) => setEditingType({ ...editingType, template: e.target.value })}
                    rows={18}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variáveis disponíveis: <code>{"{{date}}"}</code>, <code>{"{{connectors_section}}"}</code>,
                    <code>{"{{lp_views_today}}"}</code>, <code>{"{{lp_views_7d}}"}</code>,
                    <code>{"{{top_pages}}"}</code>, <code>{"{{silvia_triggers_today}}"}</code>,
                    <code>{"{{silvia_triggers_7d}}"}</code>, <code>{"{{new_salons_today}}"}</code>,
                    <code>{"{{active_salons}}"}</code>, <code>{"{{active_trials}}"}</code>,
                    <code>{"{{active_subscriptions}}"}</code>, <code>{"{{mrr}}"}</code>.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingType(null)}>Cancelar</Button>
              <Button onClick={saveTemplate}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
