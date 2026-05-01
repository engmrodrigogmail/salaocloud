import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, Trash2, Search, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type TargetType = "all_professionals" | "all_clients" | "specific_clients";

interface ClientLite { id: string; name: string; email: string | null; phone: string | null; }
interface HistoryRow {
  id: string;
  title: string;
  body: string;
  recipient_type: string;
  recipient_id: string;
  recipient_name: string;
  read_at: string | null;
  created_at: string;
}

export default function PortalCommunications() {
  const { slug } = useParams<{ slug: string }>();
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [target, setTarget] = useState<TargetType>("all_clients");
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [clientSearch, setClientSearch] = useState("");
  const [sending, setSending] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const { data: est } = await supabase
        .from("establishments").select("id").eq("slug", slug).maybeSingle();
      if (est?.id) {
        setEstablishmentId(est.id);
        const { data: cs } = await supabase
          .from("clients")
          .select("id, name, email, phone")
          .eq("establishment_id", est.id)
          .order("name", { ascending: true });
        setClients((cs ?? []) as ClientLite[]);
        await loadHistory(est.id);
      }
    })();
  }, [slug]);

  const loadHistory = async (estId: string) => {
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, recipient_type, recipient_id, read_at, created_at")
        .eq("sender_type", "establishment")
        .eq("sender_id", estId)
        .order("created_at", { ascending: false })
        .limit(200);
      const rows = (data ?? []) as any[];

      // Resolve nomes dos destinatários
      const clientIds = rows.filter(r => r.recipient_type === "client").map(r => r.recipient_id);
      const profIds = rows.filter(r => r.recipient_type === "professional").map(r => r.recipient_id);
      const [clientsRes, profsRes] = await Promise.all([
        clientIds.length
          ? supabase.from("clients").select("id, name").in("id", clientIds)
          : Promise.resolve({ data: [] as any[] }),
        profIds.length
          ? supabase.from("professionals").select("id, name").in("id", profIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const cMap = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c.name]));
      const pMap = new Map((profsRes.data ?? []).map((p: any) => [p.id, p.name]));

      setHistory(
        rows.map((r) => ({
          ...r,
          recipient_name:
            r.recipient_type === "client"
              ? (cMap.get(r.recipient_id) ?? "Cliente removido")
              : (pMap.get(r.recipient_id) ?? "Profissional removido"),
        })) as HistoryRow[],
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(c =>
      c.name?.toLowerCase().includes(q)
      || c.email?.toLowerCase().includes(q)
      || c.phone?.includes(q),
    );
  }, [clients, clientSearch]);

  const toggleClient = (id: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!establishmentId) return;
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha título e mensagem", { position: "top-center", duration: 2000 });
      return;
    }
    if (target === "specific_clients" && selectedClients.size === 0) {
      toast.error("Selecione ao menos um cliente", { position: "top-center", duration: 2000 });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("notifications-broadcast", {
        body: {
          scope: "establishment",
          establishment_id: establishmentId,
          target,
          ids: target === "specific_clients" ? Array.from(selectedClients) : undefined,
          title: title.trim(),
          body: body.trim(),
          link: link.trim() || null,
          category: "manual_broadcast",
        },
      });
      if (error) throw error;
      toast.success(
        `Enviado para ${data?.total ?? 0} destinatário(s) — ${data?.sent ?? 0} push entregues`,
        { position: "top-center", duration: 3000 },
      );
      setTitle(""); setBody(""); setLink(""); setSelectedClients(new Set());
      await loadHistory(establishmentId);
    } catch (e: any) {
      toast.error("Falha ao enviar: " + (e?.message ?? "erro"), { position: "top-center", duration: 3000 });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este registro? Quem ainda não leu deixará de ver.")) return;
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      toast.error("Falha ao excluir", { position: "top-center", duration: 2000 });
      return;
    }
    setHistory(prev => prev.filter(r => r.id !== id));
    toast.success("Registro excluído", { position: "top-center", duration: 1500 });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Comunicação</h1>
      </div>

      <Tabs defaultValue="new" className="space-y-4">
        <TabsList>
          <TabsTrigger value="new">Nova notificação</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle>Enviar notificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Destinatário</Label>
                <Select value={target} onValueChange={(v) => setTarget(v as TargetType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_clients">Todos os clientes</SelectItem>
                    <SelectItem value="all_professionals">Todos os profissionais</SelectItem>
                    <SelectItem value="specific_clients">Clientes específicos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {target === "specific_clients" && (
                <div className="space-y-2 border rounded-md p-3">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente…"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedClients.size} selecionado(s) · {filteredClients.length} exibido(s)
                  </p>
                  <ScrollArea className="h-56 border rounded">
                    {filteredClients.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer border-b last:border-0"
                      >
                        <Checkbox
                          checked={selectedClients.has(c.id)}
                          onCheckedChange={() => toggleClient(c.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name || "Sem nome"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.email || c.phone || "—"}
                          </p>
                        </div>
                      </label>
                    ))}
                    {filteredClients.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente</p>
                    )}
                  </ScrollArea>
                </div>
              )}

              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label>Link (opcional)</Label>
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/portal/seu-salao/agenda" />
              </div>

              <Button onClick={handleSend} disabled={sending} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Enviando…" : "Enviar"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de envios</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="font-medium text-sm truncate">{r.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.body}</p>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="mr-1">
                              {r.recipient_type === "client" ? "Cliente" : "Profissional"}
                            </Badge>
                            {r.recipient_name}
                          </TableCell>
                          <TableCell>
                            {r.read_at ? (
                              <Badge variant="secondary">Lida</Badge>
                            ) : (
                              <Badge>Não lida</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(r.id)}
                              aria-label="Excluir"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
