import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Bot, 
  Save,
  Loader2,
  DollarSign,
  Building2,
  TrendingUp,
  MessageSquare,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIAddonConfig {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  trial_message_limit: number;
  is_active: boolean;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
}

interface EstablishmentSubscription {
  id: string;
  establishment_name: string;
  status: string;
  trial_messages_used: number;
  created_at: string;
}

export default function AIAddon() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<AIAddonConfig | null>(null);
  const [subscriptions, setSubscriptions] = useState<EstablishmentSubscription[]>([]);
  const [stats, setStats] = useState({
    total_establishments: 0,
    active_subscriptions: 0,
    trial_subscriptions: 0,
    total_messages: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get addon config
        const { data: addon } = await supabase
          .from('platform_ai_addon')
          .select('*')
          .single();

        if (addon) {
          setConfig({
            id: addon.id,
            name: addon.name,
            description: addon.description || '',
            price_monthly: addon.price_monthly,
            trial_message_limit: addon.trial_message_limit,
            is_active: addon.is_active,
            stripe_product_id: addon.stripe_product_id,
            stripe_price_id: addon.stripe_price_id,
          });
        }

        // Get subscriptions with establishment names
        const { data: subs } = await supabase
          .from('establishment_ai_subscriptions')
          .select(`
            id,
            status,
            trial_messages_used,
            created_at,
            establishments:establishment_id (name)
          `)
          .order('created_at', { ascending: false });

        if (subs) {
          setSubscriptions(subs.map(s => ({
            id: s.id,
            establishment_name: (s.establishments as any)?.name || 'N/A',
            status: s.status,
            trial_messages_used: s.trial_messages_used,
            created_at: s.created_at,
          })));
        }

        // Get stats
        const { count: totalEstablishments } = await supabase
          .from('establishment_ai_assistant')
          .select('*', { count: 'exact', head: true })
          .eq('is_enabled', true);

        const { count: activeCount } = await supabase
          .from('establishment_ai_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        const { count: trialCount } = await supabase
          .from('establishment_ai_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'trial');

        const { data: usageData } = await supabase
          .from('ai_assistant_usage')
          .select('message_count');

        const totalMessages = usageData?.reduce((acc, u) => acc + u.message_count, 0) || 0;

        setStats({
          total_establishments: totalEstablishments || 0,
          active_subscriptions: activeCount || 0,
          trial_subscriptions: trialCount || 0,
          total_messages: totalMessages,
        });

      } catch (error) {
        console.error('Error fetching AI addon data:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('platform_ai_addon')
        .update({
          name: config.name,
          description: config.description,
          price_monthly: config.price_monthly,
          trial_message_limit: config.trial_message_limit,
          is_active: config.is_active,
          stripe_product_id: config.stripe_product_id,
          stripe_price_id: config.stripe_price_id,
        })
        .eq('id', config.id);

      if (error) throw error;

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving addon config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Ativo</Badge>;
      case 'trial':
        return <Badge className="bg-amber-100 text-amber-700">Trial</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelado</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Pagamento pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-7 w-7 text-primary" />
              Addon: Assistente Virtual IA
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o addon de IA para estabelecimentos
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Estabelecimentos Ativos</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total_establishments}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Assinaturas Pagas</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.active_subscriptions}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Em Trial</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.trial_subscriptions}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Total de Mensagens</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total_messages.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Configuration */}
        {config && (
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Addon</CardTitle>
              <CardDescription>
                Defina as configurações comerciais do addon de IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Status do Addon</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativar ou desativar a disponibilidade do addon
                  </p>
                </div>
                <Switch
                  checked={config.is_active}
                  onCheckedChange={(checked) => setConfig(prev => prev ? { ...prev, is_active: checked } : null)}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Addon</Label>
                  <Input
                    id="name"
                    value={config.name}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Preço Mensal (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={config.price_monthly}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, price_monthly: parseFloat(e.target.value) } : null)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trial_limit">Limite de Mensagens no Trial</Label>
                  <Input
                    id="trial_limit"
                    type="number"
                    value={config.trial_message_limit}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, trial_message_limit: parseInt(e.target.value) } : null)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stripe_price_id">Stripe Price ID</Label>
                  <Input
                    id="stripe_price_id"
                    value={config.stripe_price_id || ''}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, stripe_price_id: e.target.value } : null)}
                    placeholder="price_..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={config.description}
                  onChange={(e) => setConfig(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscriptions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Assinaturas do Addon</CardTitle>
            <CardDescription>
              Lista de estabelecimentos que utilizam o addon
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum estabelecimento utilizando o addon ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estabelecimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagens (Trial)</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.establishment_name}</TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell>{sub.trial_messages_used}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(sub.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
