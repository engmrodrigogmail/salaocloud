import { useEffect, useMemo, useState } from "react";
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

type TargetType =
  | "all_establishments"
  | "active_establishments"
  | "inactive_establishments"
  | "specific_establishments";

interface EstLite { id: string; name: string; slug: string; status: string; }
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

export default function AdminCommunications() {
  const [establishments, setEstablishments] = useState<EstLite[]>([]);
  const [target, setTarget] = useState<TargetType>("active_establishments");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("establishments")
        .select("id, name, slug, status")
        .order("name", { ascending: true });
      setEstablishments((data ?? []) as EstLite[]);
      await loadHistory();
    })();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, recipient_type, recipient_id, read_at, created_at")
        .eq("sender_type", "admin")
        .order("created_at", { ascending: false })
        .limit(200);
      const rows = (data ?? []) as any[];
      const estIds = rows.filter(r => r.recipient_type === "establishment").map(r => r.recipient_id);
      const { data: ests } = estIds.length
        ? await supabase.from("establishments").select("id, name").in("id", estIds)
        : { data: [] as any[] };
      const map = new Map((ests ?? []).map((e: any) => [e.id, e.name]));
      setHistory(
        rows.map(r => ({
          ...r,
          recipient_name: map.get(r.recipient_id) ?? "—",
        })) as HistoryRow[],
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return establishments;
    return establishments.filter(
      (e) => e.name.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q),
    );
  }, [establishments, search]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha título e mensagem", { position: "top-center", duration: 2000 });
      return;
    }
    if (target === "specific_establishments" && selected.size === 0) {
      toast.error("Selecione ao menos um salão", { position: "top-center", duration: 2000 });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("notifications-broadcast", {
        body: {
          scope: "admin",
          target,
          ids: target === "specific_establishments" ? Array.from(selected) : undefined,
          title: title.trim(),
          body: body.trim(),
          link: null,
          category: "admin_broadcast",
        },
      });
      if (error) throw error;
      toast.success(
        `Enviado para ${data?.total ?? 0} salão(ões) — ${data?.sent ?? 0} push entregues`,
        { position: "top-center", duration: 3000 },
      );
      setTitle(""); setBody(""); setLink(""); setSelected(new Set());
      await loadHistory();
    } catch (e: any) {
      toast.error("Falha ao enviar: " + (e?.message ?? "erro"), { position: "top-center", duration: 3000 });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este registro?")) return;
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
            <CardHeader><CardTitle>Enviar notificação para salões</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Destinatário</Label>
                <Select value={target} onValueChange={(v) => setTarget(v as TargetType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_establishments">Todos os salões</SelectItem>
                    <SelectItem value="active_establishments">Salões ativos</SelectItem>
                    <SelectItem value="inactive_establishments">Salões inativos</SelectItem>
                    <SelectItem value="specific_establishments">Salões específicos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {target === "specific_establishments" && (
                <div className="space-y-2 border rounded-md p-3">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar salão…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selected.size} selecionado(s) · {filtered.length} exibido(s)
                  </p>
                  <ScrollArea className="h-56 border rounded">
                    {filtered.map((e) => (
                      <label
                        key={e.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer border-b last:border-0"
                      >
                        <Checkbox
                          checked={selected.has(e.id)}
                          onCheckedChange={() => toggle(e.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{e.name}</p>
                          <p className="text-xs text-muted-foreground">/{e.slug} · {e.status}</p>
                        </div>
                      </label>
                    ))}
                    {filtered.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhum salão</p>
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

              <Button onClick={handleSend} disabled={sending} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Enviando…" : "Enviar"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>Histórico de envios</CardTitle></CardHeader>
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
                        <TableHead>Salão</TableHead>
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
                          <TableCell className="text-xs">{r.recipient_name}</TableCell>
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
