import { useState, useEffect, useRef, useMemo } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageCircle, 
  Send, 
  User, 
  Mail, 
  Clock, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  AlertTriangle,
  Timer,
  BellRing
} from "lucide-react";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  visitor_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  message: string;
  is_from_user: boolean;
  created_at: string;
}

interface ChatMetrics {
  totalConversations: number;
  openConversations: number;
  escalatedConversations: number;
  closedConversations: number;
  avgResponseTime: number | null;
  todayConversations: number;
  returningVisitors: number;
}

export default function AdminConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [metrics, setMetrics] = useState<ChatMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    fetchMetrics();
    
    // Subscribe to new conversations
    const conversationsChannel = supabase
      .channel('admin-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations'
        },
        () => {
          fetchConversations();
          fetchMetrics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;

    // Subscribe to new messages for selected conversation
    const messagesChannel = supabase
      .channel(`messages-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      toast.error("Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const { data: allConversations, error } = await supabase
        .from("chat_conversations")
        .select("*");

      if (error) throw error;

      const conversations = allConversations || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Count by status
      const totalConversations = conversations.length;
      const openConversations = conversations.filter(c => c.status === 'open').length;
      const escalatedConversations = conversations.filter(c => c.status === 'escalated').length;
      const closedConversations = conversations.filter(c => c.status === 'closed').length;
      
      // Today's conversations
      const todayConversations = conversations.filter(c => 
        new Date(c.created_at) >= today
      ).length;

      // Returning visitors (visitors with more than 1 conversation)
      const visitorCounts = conversations.reduce((acc, c) => {
        acc[c.visitor_id] = (acc[c.visitor_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const returningVisitors = Object.values(visitorCounts).filter(count => count > 1).length;

      // Calculate average response time
      let totalResponseTime = 0;
      let responseCount = 0;

      for (const conv of conversations) {
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true })
          .limit(10);

        if (msgs && msgs.length >= 2) {
          // Find first user message and first bot/admin response
          const firstUserMsg = msgs.find(m => m.is_from_user);
          const firstResponse = msgs.find(m => !m.is_from_user && m.created_at > (firstUserMsg?.created_at || ''));
          
          if (firstUserMsg && firstResponse) {
            const responseTime = differenceInMinutes(
              new Date(firstResponse.created_at),
              new Date(firstUserMsg.created_at)
            );
            if (responseTime >= 0) {
              totalResponseTime += responseTime;
              responseCount++;
            }
          }
        }
      }

      const avgResponseTime = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : null;

      setMetrics({
        totalConversations,
        openConversations,
        escalatedConversations,
        closedConversations,
        avgResponseTime,
        todayConversations,
        returningVisitors
      });
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: selectedConversation.id,
        message: replyText.trim(),
        is_from_user: false,
      });

      if (error) throw error;

      // Update conversation updated_at
      await supabase
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedConversation.id);

      setReplyText("");
      toast.success("Resposta enviada");
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error("Erro ao enviar resposta");
    } finally {
      setSending(false);
    }
  };

  const handleCloseConversation = async () => {
    if (!selectedConversation) return;

    try {
      const { error } = await supabase
        .from("chat_conversations")
        .update({ 
          status: "closed",
          closed_at: new Date().toISOString()
        })
        .eq("id", selectedConversation.id);

      if (error) throw error;

      setSelectedConversation({ ...selectedConversation, status: "closed" });
      toast.success("Conversa encerrada");
      fetchConversations();
      fetchMetrics();
    } catch (error) {
      console.error("Error closing conversation:", error);
      toast.error("Erro ao encerrar conversa");
    }
  };

  const handleReopenConversation = async () => {
    if (!selectedConversation) return;

    try {
      const { error } = await supabase
        .from("chat_conversations")
        .update({ 
          status: "open",
          closed_at: null
        })
        .eq("id", selectedConversation.id);

      if (error) throw error;

      setSelectedConversation({ ...selectedConversation, status: "open" });
      toast.success("Conversa reaberta");
      fetchConversations();
      fetchMetrics();
    } catch (error) {
      console.error("Error reopening conversation:", error);
      toast.error("Erro ao reabrir conversa");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Aberta</Badge>;
      case "escalated":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Escalada</Badge>;
      case "closed":
        return <Badge variant="secondary">Encerrada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid grid-cols-3 gap-6">
            <Skeleton className="h-[500px]" />
            <Skeleton className="h-[500px] col-span-2" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  const escalatedCount = metrics?.escalatedConversations || 0;

  const escalatedConversationsList = useMemo(
    () => conversations.filter((c) => c.status === "escalated"),
    [conversations]
  );

  return (
    <AdminLayout>
      <div className="space-y-6 overflow-y-auto">
        {/* Escalation Alert Banner */}
        {escalatedCount > 0 && (
          <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
            <BellRing className="h-5 w-5 animate-pulse" />
            <AlertTitle className="text-lg font-bold flex items-center gap-2">
              Atenção: {escalatedCount} conversa{escalatedCount > 1 ? "s" : ""} aguardando atendimento humano!
            </AlertTitle>
            <AlertDescription className="mt-1 text-sm">
              A Silvia escalou {escalatedCount === 1 ? "uma conversa" : `${escalatedCount} conversas`} para você.
              Clique em uma conversa "Escalada" na lista abaixo para responder.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Conversas de Suporte</h1>
            <p className="text-muted-foreground">Gerencie as conversas do chat de suporte</p>
          </div>
          <Button variant="outline" onClick={() => { fetchConversations(); fetchMetrics(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loadingMetrics ? "-" : metrics?.totalConversations || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loadingMetrics ? "-" : metrics?.openConversations || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Abertas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loadingMetrics ? "-" : metrics?.escalatedConversations || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Escaladas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loadingMetrics ? "-" : metrics?.closedConversations || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Encerradas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loadingMetrics ? "-" : metrics?.todayConversations || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Hoje</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loadingMetrics ? "-" : metrics?.returningVisitors || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Retornando</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <Timer className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loadingMetrics ? "-" : (metrics?.avgResponseTime !== null ? `${metrics.avgResponseTime}m` : "N/A")}
                  </p>
                  <p className="text-xs text-muted-foreground">Tempo médio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[400px]">
          {/* Conversations List */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Conversas</CardTitle>
              <CardDescription>{conversations.length} conversa(s)</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-full">
                <div className="space-y-1 p-4 pt-0">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma conversa ainda
                    </p>
                  ) : (
                    conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-colors",
                          selectedConversation?.id === conv.id
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">
                                {conv.visitor_name || "Visitante"}
                              </span>
                            </div>
                            {conv.visitor_email && (
                              <div className="flex items-center gap-2 mt-1">
                                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {conv.visitor_email}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(conv.updated_at), { 
                                  addSuffix: true, 
                                  locale: ptBR 
                                })}
                              </span>
                            </div>
                          </div>
                          {getStatusBadge(conv.status)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="lg:col-span-2 flex flex-col">
            {selectedConversation ? (
              <>
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-primary" />
                        {selectedConversation.visitor_name || "Visitante"}
                      </CardTitle>
                      <CardDescription>
                        {selectedConversation.visitor_email || selectedConversation.visitor_id}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedConversation.status)}
                      {selectedConversation.status !== "closed" ? (
                        <Button variant="outline" size="sm" onClick={handleCloseConversation}>
                          <XCircle className="h-4 w-4 mr-1" />
                          Encerrar
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={handleReopenConversation}>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Reabrir
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  <ScrollArea className="flex-1 p-4">
                    {loadingMessages ? (
                      <div className="space-y-3">
                        <Skeleton className="h-12 w-3/4" />
                        <Skeleton className="h-12 w-1/2 ml-auto" />
                        <Skeleton className="h-12 w-2/3" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex flex-col gap-1 max-w-[80%]",
                              msg.is_from_user ? "items-start" : "ml-auto items-end"
                            )}
                          >
                            <div
                              className={cn(
                                "rounded-2xl px-4 py-2.5 text-sm",
                                msg.is_from_user
                                  ? "bg-muted text-foreground rounded-bl-md"
                                  : "bg-primary text-primary-foreground rounded-br-md"
                              )}
                            >
                              {msg.message}
                            </div>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {!msg.is_from_user && (
                                <Sparkles className="h-3 w-3" />
                              )}
                              {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>
                  
                  {selectedConversation.status !== "closed" && (
                    <div className="border-t p-4">
                      <div className="flex gap-2">
                        <Input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Digite sua resposta..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendReply();
                            }
                          }}
                        />
                        <Button onClick={handleSendReply} disabled={!replyText.trim() || sending}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione uma conversa para visualizar</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
