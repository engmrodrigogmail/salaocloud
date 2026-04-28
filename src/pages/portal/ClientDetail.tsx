import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Save, User, History, Globe2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Client {
  id: string;
  establishment_id: string;
  name: string;
  email: string | null;
  phone: string;
  cpf: string | null;
  notes: string | null;
  global_identity_email: string | null;
  created_at: string;
}

interface LocalTab {
  id: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  total: number;
  subtotal: number;
  discount_amount: number | null;
  professional_name?: string | null;
  items: {
    id: string;
    name: string;
    item_type: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    professional_name?: string | null;
  }[];
  payments: { id: string; payment_method_name: string; amount: number }[];
}

interface CrossTab {
  closed_at: string;
  items: { name: string; item_type: string }[]; // anonimizado: sem qty/price/establishment
}

export default function ClientDetail() {
  const { slug, clientId } = useParams<{ slug: string; clientId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", cpf: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [localTabs, setLocalTabs] = useState<LocalTab[]>([]);
  const [crossTabs, setCrossTabs] = useState<CrossTab[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingCross, setLoadingCross] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    void loadEstablishmentAndClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, clientId]);

  const loadEstablishmentAndClient = async () => {
    if (!clientId || !user) return;
    setLoading(true);
    try {
      const { data: est } = await supabase
        .from("establishments")
        .select("id")
        .eq("owner_id", user.id)
        .eq("slug", slug)
        .maybeSingle();
      if (!est) {
        toast.error("Estabelecimento não encontrado");
        navigate(`/portal/${slug}`);
        return;
      }
      setEstablishmentId(est.id);

      const { data: c, error } = await supabase
        .from("clients")
        .select("id, establishment_id, name, email, phone, cpf, notes, global_identity_email, created_at")
        .eq("id", clientId)
        .eq("establishment_id", est.id)
        .maybeSingle();
      if (error) throw error;
      if (!c) {
        toast.error("Cliente não encontrado");
        navigate(`/portal/${slug}/clientes`);
        return;
      }
      setClient(c as Client);
      setForm({
        name: c.name || "",
        phone: c.phone || "",
        email: c.email || "",
        cpf: c.cpf || "",
        notes: c.notes || "",
      });
      void loadLocalHistory(est.id, c.id);
      void loadCrossHistory(c);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar cliente");
    } finally {
      setLoading(false);
    }
  };

  const loadLocalHistory = async (estId: string, cId: string) => {
    setLoadingHistory(true);
    try {
      const { data: tabs, error } = await supabase
        .from("tabs")
        .select(`
          id, opened_at, closed_at, status, total, subtotal, discount_amount,
          professionals:professional_id ( name ),
          tab_items ( id, name, item_type, quantity, unit_price, total_price,
            professionals:professional_id ( name )
          ),
          tab_payments ( id, payment_method_name, amount )
        `)
        .eq("establishment_id", estId)
        .eq("client_id", cId)
        .eq("status", "closed")
        .order("closed_at", { ascending: false });
      if (error) throw error;
      const mapped: LocalTab[] = (tabs || []).map((t: any) => ({
        id: t.id,
        opened_at: t.opened_at,
        closed_at: t.closed_at,
        status: t.status,
        total: Number(t.total || 0),
        subtotal: Number(t.subtotal || 0),
        discount_amount: t.discount_amount ? Number(t.discount_amount) : null,
        professional_name: t.professionals?.name || null,
        items: (t.tab_items || []).map((it: any) => ({
          id: it.id,
          name: it.name,
          item_type: it.item_type,
          quantity: Number(it.quantity || 1),
          unit_price: Number(it.unit_price || 0),
          total_price: Number(it.total_price || 0),
          professional_name: it.professionals?.name || null,
        })),
        payments: (t.tab_payments || []).map((p: any) => ({
          id: p.id,
          payment_method_name: p.payment_method_name,
          amount: Number(p.amount || 0),
        })),
      }));
      setLocalTabs(mapped);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar histórico local");
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadCrossHistory = async (c: Client) => {
    setLoadingCross(true);
    try {
      const normalizedPhone = (c.phone || "").replace(/\D/g, "");
      const email = (c.global_identity_email || c.email || "").trim().toLowerCase();
      const cpf = (c.cpf || "").replace(/\D/g, "");

      // Build OR query: prioridade email > phone > cpf, mas precisamos buscar todos clones em outros estabelecimentos
      const orParts: string[] = [];
      if (email) orParts.push(`global_identity_email.eq.${email}`, `email.eq.${email}`);
      // phone/cpf compared as raw text — best-effort
      if (normalizedPhone) orParts.push(`phone.eq.${c.phone}`);
      if (cpf) orParts.push(`cpf.eq.${c.cpf}`);

      if (orParts.length === 0) {
        setCrossTabs([]);
        return;
      }

      const { data: peers } = await supabase
        .from("clients")
        .select("id, establishment_id, phone, email, global_identity_email, cpf")
        .or(orParts.join(","))
        .neq("establishment_id", c.establishment_id);

      // Refine match by normalized phone if needed
      const matchingIds = (peers || [])
        .filter((p: any) => {
          if (email && (
            (p.global_identity_email || "").toLowerCase() === email ||
            (p.email || "").toLowerCase() === email
          )) return true;
          if (normalizedPhone && (p.phone || "").replace(/\D/g, "") === normalizedPhone) return true;
          if (cpf && (p.cpf || "").replace(/\D/g, "") === cpf) return true;
          return false;
        })
        .map((p: any) => p.id);

      if (matchingIds.length === 0) {
        setCrossTabs([]);
        return;
      }

      const { data: tabs } = await supabase
        .from("tabs")
        .select(`
          closed_at,
          tab_items ( name, item_type )
        `)
        .in("client_id", matchingIds)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(100);

      const mapped: CrossTab[] = (tabs || []).map((t: any) => ({
        closed_at: t.closed_at,
        items: (t.tab_items || []).map((i: any) => ({ name: i.name, item_type: i.item_type })),
      }));
      setCrossTabs(mapped);
    } catch (err: any) {
      console.error(err);
      // Não bloqueia — apenas oculta a aba se falhar
      setCrossTabs([]);
    } finally {
      setLoadingCross(false);
    }
  };

  const saveClient = async () => {
    if (!client) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          cpf: form.cpf.trim() || null,
          notes: form.notes.trim() || null,
        })
        .eq("id", client.id)
        .eq("establishment_id", client.establishment_id);
      if (error) throw error;
      toast.success("Cliente atualizado", { position: "top-center", duration: 2000 });
      setClient({ ...client, ...form, email: form.email || null, cpf: form.cpf || null, notes: form.notes || null });
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const totalSpent = useMemo(
    () => localTabs.reduce((sum, t) => sum + (t.total || 0), 0),
    [localTabs]
  );

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  if (!client) return null;

  return (
    <PortalLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/portal/${slug}/clientes`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <p className="text-sm text-muted-foreground">
              Cliente desde {format(new Date(client.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dados"><User className="h-4 w-4 mr-1" /> Dados</TabsTrigger>
            <TabsTrigger value="historico"><History className="h-4 w-4 mr-1" /> Histórico</TabsTrigger>
            <TabsTrigger value="consumo"><Globe2 className="h-4 w-4 mr-1" /> Perfil de consumo</TabsTrigger>
          </TabsList>

          {/* DADOS */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle>Editar dados</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Observações</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Button onClick={saveClient} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HISTÓRICO LOCAL — completo */}
          <TabsContent value="historico" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Histórico no seu salão</CardTitle>
                  {!loadingHistory && (
                    <Badge variant="outline">
                      Total gasto: R$ {totalSpent.toFixed(2)}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : localTabs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum atendimento finalizado ainda.</p>
                ) : (
                  <div className="space-y-4">
                    {localTabs.map((tab) => (
                      <div key={tab.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="font-medium">
                              {tab.closed_at ? format(new Date(tab.closed_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                            </p>
                            {tab.professional_name && (
                              <p className="text-xs text-muted-foreground">Comanda atendida por {tab.professional_name}</p>
                            )}
                          </div>
                          <Badge>R$ {tab.total.toFixed(2)}</Badge>
                        </div>
                        <Separator />
                        <div className="space-y-1.5">
                          {tab.items.map((it) => (
                            <div key={it.id} className="flex items-center justify-between text-sm">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{it.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({it.item_type === "service" ? "Serviço" : it.item_type === "product" ? "Produto" : "Item"})
                                  {it.quantity > 1 && ` × ${it.quantity}`}
                                  {it.professional_name && ` • ${it.professional_name}`}
                                </span>
                              </div>
                              <span className="text-sm tabular-nums">R$ {it.total_price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        {tab.payments.length > 0 && (
                          <>
                            <Separator />
                            <div className="text-xs text-muted-foreground">
                              Pagamentos: {tab.payments.map(p => `${p.payment_method_name} (R$ ${p.amount.toFixed(2)})`).join(" • ")}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PERFIL DE CONSUMO — anonimizado */}
          <TabsContent value="consumo" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Perfil de consumo em outros salões</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Apenas datas e tipos de procedimentos/produtos. Nomes de salões, valores e quantidades não são compartilhados.
                </p>
              </CardHeader>
              <CardContent>
                {loadingCross ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : crossTabs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhum atendimento em outros salões identificado.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {crossTabs.map((t, idx) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <p className="text-sm font-medium mb-2">
                          {format(new Date(t.closed_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {t.items.map((it, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {it.item_type === "service" ? "💈" : it.item_type === "product" ? "🧴" : "•"} {it.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
