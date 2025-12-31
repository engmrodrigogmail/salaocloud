import { useState } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Send, 
  Image as ImageIcon, 
  Users, 
  MessageSquare, 
  History,
  AlertTriangle,
  Loader2,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  Crown
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: string;
  name: string;
  phone: string;
}

interface Campaign {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
  sent_at: string | null;
  completed_at: string | null;
}

export default function BroadcastList() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Fetch establishment
  const { data: establishment } = useQuery({
    queryKey: ['establishment', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('establishments')
        .select('id, name')
        .eq('slug', slug)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug
  });

  // Fetch broadcast subscription
  const { data: subscription, isLoading: loadingSubscription } = useQuery({
    queryKey: ['broadcast-subscription', establishment?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broadcast_subscriptions')
        .select('*')
        .eq('establishment_id', establishment!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!establishment?.id
  });

  const isSubscribed = subscription?.status === 'active';

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-broadcast', establishment?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone')
        .eq('establishment_id', establishment!.id)
        .order('name');
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!establishment?.id && isSubscribed
  });

  // Fetch campaign history
  const { data: campaigns = [] } = useQuery({
    queryKey: ['broadcast-campaigns', establishment?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('establishment_id', establishment!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!establishment?.id && isSubscribed
  });

  const toggleClient = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const toggleAll = () => {
    if (selectedClients.length === clients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(c => c.id));
    }
  };

  const handleSendBroadcast = async () => {
    if (!title.trim()) {
      toast.error("Informe um título para a campanha");
      return;
    }
    if (!message.trim()) {
      toast.error("Informe a mensagem a ser enviada");
      return;
    }
    if (selectedClients.length === 0) {
      toast.error("Selecione pelo menos um cliente");
      return;
    }

    setIsSending(true);

    try {
      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('broadcast_campaigns')
        .insert({
          establishment_id: establishment!.id,
          title: title.trim(),
          message: message.trim(),
          image_url: imageUrl.trim() || null,
          total_recipients: selectedClients.length,
          status: 'sending'
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Get selected clients data
      const selectedClientsData = clients.filter(c => selectedClients.includes(c.id));

      // Create logs for each recipient
      const logs = selectedClientsData.map(client => ({
        campaign_id: campaign.id,
        client_id: client.id,
        client_phone: client.phone,
        client_name: client.name,
        status: 'pending'
      }));

      const { error: logsError } = await supabase
        .from('broadcast_logs')
        .insert(logs);

      if (logsError) throw logsError;

      // Call edge function to send messages
      const { error: sendError } = await supabase.functions.invoke('broadcast-whatsapp', {
        body: { campaign_id: campaign.id }
      });

      if (sendError) throw sendError;

      toast.success(`Campanha iniciada! Enviando para ${selectedClients.length} contatos...`);
      
      // Reset form
      setTitle("");
      setMessage("");
      setImageUrl("");
      setSelectedClients([]);
      
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
    } catch (error: any) {
      console.error('Erro ao enviar broadcast:', error);
      toast.error(error.message || "Erro ao enviar mensagens");
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'sending':
        return <Badge variant="default" className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Enviando</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Concluído</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loadingSubscription) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  // Not subscribed - show upgrade prompt
  if (!isSubscribed) {
    return (
      <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Lista de Distribuição</h1>
          <p className="text-muted-foreground">Envie mensagens em massa para seus clientes via WhatsApp</p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Crown className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Funcionalidade Premium</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              A Lista de Distribuição permite enviar mensagens personalizadas para todos os seus clientes de uma vez. 
              Perfeito para promoções, avisos e campanhas de marketing.
            </p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-bold">R$ 45</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
            <ul className="text-sm text-muted-foreground mb-6 space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Envio ilimitado de mensagens
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Suporte a texto e imagens
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Histórico de campanhas
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Relatório de entregas
              </li>
            </ul>
            <Badge variant="outline" className="mb-4">BETA</Badge>
            <Button size="lg" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>
      </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Lista de Distribuição</h1>
            <Badge variant="outline">BETA</Badge>
          </div>
          <p className="text-muted-foreground">Envie mensagens em massa para seus clientes via WhatsApp</p>
        </div>
        <Button variant="outline" onClick={() => setShowHistory(true)}>
          <History className="w-4 h-4 mr-2" />
          Histórico
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Message Composer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Compor Mensagem
            </CardTitle>
            <CardDescription>
              Monte sua mensagem para enviar aos clientes selecionados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título da Campanha</Label>
              <Input
                id="title"
                placeholder="Ex: Promoção de Natal"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                placeholder="Digite sua mensagem aqui..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                {message.length} caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image" className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                URL da Imagem (opcional)
              </Label>
              <Input
                id="image"
                placeholder="https://exemplo.com/imagem.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
              {imageUrl && (
                <div className="relative w-full max-w-[200px]">
                  <img 
                    src={imageUrl} 
                    alt="Preview" 
                    className="rounded-lg border object-cover w-full h-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                {selectedClients.length} de {clients.length} clientes selecionados
              </div>
              <Button 
                onClick={handleSendBroadcast}
                disabled={isSending || selectedClients.length === 0 || !message.trim()}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Mensagem
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Client Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Selecionar Clientes
            </CardTitle>
            <CardDescription>
              Escolha os clientes que receberão a mensagem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectedClients.length === clients.length && clients.length > 0}
                  onCheckedChange={toggleAll}
                />
                <Label htmlFor="select-all" className="cursor-pointer">
                  Selecionar todos ({clients.length})
                </Label>
              </div>
              {selectedClients.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedClients([])}
                >
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              {clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhum cliente cadastrado</p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {clients.map((client) => (
                    <div 
                      key={client.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedClients.includes(client.id) 
                          ? 'bg-primary/5 border-primary/20' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleClient(client.id)}
                    >
                      <Checkbox
                        checked={selectedClients.includes(client.id)}
                        onCheckedChange={() => toggleClient(client.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{client.name}</p>
                        <p className="text-sm text-muted-foreground">{client.phone}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Warning */}
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 pt-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">Atenção</p>
            <p className="text-amber-700 dark:text-amber-300">
              Use esta funcionalidade com responsabilidade. Envios excessivos podem resultar em bloqueio do número no WhatsApp. 
              Recomendamos não enviar mais de 200 mensagens por hora.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Campaign History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Histórico de Campanhas</DialogTitle>
            <DialogDescription>
              Veja o histórico de mensagens enviadas
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="w-12 h-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhuma campanha enviada ainda</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-center">Enviados</TableHead>
                    <TableHead className="text-center">Falhas</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{campaign.title}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {campaign.message}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-medium">{campaign.sent_count}</span>
                        <span className="text-muted-foreground">/{campaign.total_recipients}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {campaign.failed_count > 0 ? (
                          <span className="text-red-600 font-medium">{campaign.failed_count}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
    </PortalLayout>
  );
}
