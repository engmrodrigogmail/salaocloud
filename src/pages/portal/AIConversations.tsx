import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageCircle,
  Search,
  Phone,
  User,
  Bot,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  PhoneForwarded,
  Trash2,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow, subDays, subMonths, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  status: string;
  channel: string;
  created_at: string;
  updated_at: string;
  escalated_at: string | null;
  message_count?: number;
  last_message?: string;
}

interface Message {
  id: string;
  content: string;
  sender_type: string;
  message_type: string;
  created_at: string;
}

const CONVERSATIONS_PER_PAGE = 10;

export default function AIConversations() {
  const { slug } = useParams<{ slug: string }>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'close' | 'escalate';
    conversationId: string | null;
  }>({ open: false, type: 'close', conversationId: null });

  // Pagination state
  const [displayCount, setDisplayCount] = useState(CONVERSATIONS_PER_PAGE);

  // Delete functionality state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteFilter, setDeleteFilter] = useState<'period' | 'client' | 'selection'>('period');
  const [deletePeriod, setDeletePeriod] = useState<string>('7days');
  const [selectedClientForDelete, setSelectedClientForDelete] = useState<string>('');
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchEstablishment();
  }, [slug]);

  useEffect(() => {
    if (establishmentId) {
      fetchConversations();
    }
  }, [establishmentId, statusFilter]);

  const fetchEstablishment = async () => {
    if (!slug) return;

    const { data, error } = await supabase
      .from("establishments")
      .select("id")
      .eq("slug", slug)
      .single();

    if (error) {
      console.error("Error fetching establishment:", error);
      toast.error("Erro ao carregar estabelecimento");
      return;
    }

    setEstablishmentId(data.id);
  };

  const fetchConversations = async () => {
    if (!establishmentId) return;

    setIsLoading(true);

    try {
      let query = supabase
        .from("ai_assistant_conversations")
        .select("*")
        .eq("establishment_id", establishmentId)
        .order("updated_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: convData, error: convError } = await query;

      if (convError) throw convError;

      // Fetch message counts and last messages for each conversation
      const conversationsWithStats = await Promise.all(
        (convData || []).map(async (conv) => {
          const { data: msgData } = await supabase
            .from("ai_assistant_messages")
            .select("content, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const { count } = await supabase
            .from("ai_assistant_messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id);

          return {
            ...conv,
            message_count: count || 0,
            last_message: msgData?.[0]?.content || "",
          };
        })
      );

      setConversations(conversationsWithStats);
      setDisplayCount(CONVERSATIONS_PER_PAGE);
      setSelectedForDelete(new Set());
    } catch (error) {
      console.error("Error fetching conversations:", error);
      toast.error("Erro ao carregar conversas");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);

    try {
      const { data, error } = await supabase
        .from("ai_assistant_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleConversationClick = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setIsSheetOpen(true);
    fetchMessages(conversation.id);
  };

  const handleStatusChange = async (conversationId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === "escalated") {
        updateData.escalated_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("ai_assistant_conversations")
        .update(updateData)
        .eq("id", conversationId);

      if (error) throw error;

      toast.success(
        newStatus === "closed" 
          ? "Conversa encerrada" 
          : "Conversa escalada para atendimento humano"
      );
      
      fetchConversations();
      setActionDialog({ open: false, type: 'close', conversationId: null });
      
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error("Error updating conversation:", error);
      toast.error("Erro ao atualizar conversa");
    }
  };

  const handleDeleteConversations = async () => {
    if (!establishmentId) return;
    
    setIsDeleting(true);

    try {
      let idsToDelete: string[] = [];

      if (deleteFilter === 'selection') {
        idsToDelete = Array.from(selectedForDelete);
      } else if (deleteFilter === 'period') {
        let cutoffDate: Date;
        switch (deletePeriod) {
          case '7days':
            cutoffDate = subDays(new Date(), 7);
            break;
          case '30days':
            cutoffDate = subDays(new Date(), 30);
            break;
          case '3months':
            cutoffDate = subMonths(new Date(), 3);
            break;
          case '6months':
            cutoffDate = subMonths(new Date(), 6);
            break;
          default:
            cutoffDate = subDays(new Date(), 7);
        }

        idsToDelete = conversations
          .filter(conv => !isAfter(new Date(conv.created_at), cutoffDate))
          .map(conv => conv.id);
      } else if (deleteFilter === 'client' && selectedClientForDelete) {
        idsToDelete = conversations
          .filter(conv => conv.client_phone === selectedClientForDelete || conv.client_name === selectedClientForDelete)
          .map(conv => conv.id);
      }

      if (idsToDelete.length === 0) {
        toast.error("Nenhuma conversa encontrada para excluir");
        setIsDeleting(false);
        return;
      }

      // Delete messages first (cascade should handle this, but being explicit)
      const { error: msgError } = await supabase
        .from("ai_assistant_messages")
        .delete()
        .in("conversation_id", idsToDelete);

      if (msgError) throw msgError;

      // Delete conversations
      const { error: convError } = await supabase
        .from("ai_assistant_conversations")
        .delete()
        .in("id", idsToDelete);

      if (convError) throw convError;

      toast.success(`${idsToDelete.length} conversa(s) excluída(s)`);
      setIsDeleteDialogOpen(false);
      setSelectedForDelete(new Set());
      fetchConversations();
    } catch (error) {
      console.error("Error deleting conversations:", error);
      toast.error("Erro ao excluir conversas");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectConversation = (id: string) => {
    setSelectedForDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">Ativa</Badge>;
      case "closed":
        return <Badge variant="secondary">Encerrada</Badge>;
      case "escalated":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">Escalada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (conv.client_name?.toLowerCase().includes(searchLower) || false) ||
      (conv.client_phone?.includes(searchTerm) || false)
    );
  });

  const displayedConversations = filteredConversations.slice(0, displayCount);
  const hasMore = filteredConversations.length > displayCount;

  const uniqueClients = [...new Set(conversations.map(c => c.client_phone || c.client_name).filter(Boolean))];

  const stats = {
    total: conversations.length,
    active: conversations.filter((c) => c.status === "active").length,
    escalated: conversations.filter((c) => c.status === "escalated").length,
    closed: conversations.filter((c) => c.status === "closed").length,
  };

  const getDeleteCount = () => {
    if (deleteFilter === 'selection') {
      return selectedForDelete.size;
    } else if (deleteFilter === 'period') {
      let cutoffDate: Date;
      switch (deletePeriod) {
        case '7days':
          cutoffDate = subDays(new Date(), 7);
          break;
        case '30days':
          cutoffDate = subDays(new Date(), 30);
          break;
        case '3months':
          cutoffDate = subMonths(new Date(), 3);
          break;
        case '6months':
          cutoffDate = subMonths(new Date(), 6);
          break;
        default:
          cutoffDate = subDays(new Date(), 7);
      }
      return conversations.filter(conv => !isAfter(new Date(conv.created_at), cutoffDate)).length;
    } else if (deleteFilter === 'client' && selectedClientForDelete) {
      return conversations.filter(conv => conv.client_phone === selectedClientForDelete || conv.client_name === selectedClientForDelete).length;
    }
    return 0;
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Conversas do Assistente IA</h1>
            <p className="text-muted-foreground">
              Visualize e gerencie as conversas dos clientes com o assistente virtual
            </p>
          </div>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={conversations.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Conversas
          </Button>
        </div>

        {/* Stats Cards - Compact */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Ativas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.escalated}</p>
                <p className="text-xs text-muted-foreground">Escaladas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.closed}</p>
                <p className="text-xs text-muted-foreground">Encerradas</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters - Inline */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="escalated">Escaladas</SelectItem>
              <SelectItem value="closed">Encerradas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchConversations}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Conversations List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Conversas</CardTitle>
                <CardDescription>
                  Mostrando {displayedConversations.length} de {filteredConversations.length}
                </CardDescription>
              </div>
              {selectedForDelete.size > 0 && (
                <Badge variant="secondary">
                  {selectedForDelete.size} selecionada(s)
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                  >
                    <Checkbox
                      checked={selectedForDelete.has(conversation.id)}
                      onCheckedChange={() => toggleSelectConversation(conversation.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
                    />
                    <div 
                      className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                      onClick={() => handleConversationClick(conversation)}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium truncate text-sm">
                            {conversation.client_name || "Cliente"}
                          </span>
                          {getStatusBadge(conversation.status)}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {conversation.last_message || "Sem mensagens"}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {conversation.client_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {conversation.client_phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {conversation.message_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(conversation.updated_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Load More Button */}
                {hasMore && (
                  <div className="pt-4 text-center">
                    <Button
                      variant="outline"
                      onClick={() => setDisplayCount(prev => prev + CONVERSATIONS_PER_PAGE)}
                      className="w-full sm:w-auto"
                    >
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Carregar mais ({filteredConversations.length - displayCount} restantes)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversation Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedConversation?.client_name || "Cliente"}
            </SheetTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {selectedConversation?.client_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {selectedConversation.client_phone}
                </span>
              )}
              {selectedConversation && getStatusBadge(selectedConversation.status)}
            </div>
          </SheetHeader>

          <Separator className="my-4" />

          {/* Actions */}
          {selectedConversation && selectedConversation.status === "active" && (
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setActionDialog({
                  open: true,
                  type: 'escalate',
                  conversationId: selectedConversation.id
                })}
              >
                <PhoneForwarded className="h-4 w-4 mr-2" />
                Escalar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setActionDialog({
                  open: true,
                  type: 'close',
                  conversationId: selectedConversation.id
                })}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Encerrar
              </Button>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma mensagem nesta conversa
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2",
                      message.sender_type === "client" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.sender_type === "assistant" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2",
                        message.sender_type === "client"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <span
                        className={cn(
                          "text-[10px] opacity-60 mt-1 block",
                          message.sender_type === "client" ? "text-right" : "text-left"
                        )}
                      >
                        {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {message.sender_type === "client" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Conversation Info */}
          {selectedConversation && (
            <>
              <Separator className="my-4" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Iniciada em:{" "}
                  {format(new Date(selectedConversation.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
                {selectedConversation.escalated_at && (
                  <p>
                    Escalada em:{" "}
                    {format(new Date(selectedConversation.escalated_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Action Confirmation Dialog */}
      <AlertDialog 
        open={actionDialog.open} 
        onOpenChange={(open) => setActionDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.type === 'close' ? 'Encerrar conversa?' : 'Escalar conversa?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.type === 'close'
                ? 'Ao encerrar, a conversa será marcada como finalizada.'
                : 'Ao escalar, a conversa será marcada para atendimento humano.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionDialog.conversationId) {
                  handleStatusChange(
                    actionDialog.conversationId,
                    actionDialog.type === 'close' ? 'closed' : 'escalated'
                  );
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Conversations Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir Conversas
            </DialogTitle>
            <DialogDescription>
              Selecione como deseja filtrar as conversas para exclusão
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Delete Filter Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Filtrar por:</label>
              <Select value={deleteFilter} onValueChange={(v: 'period' | 'client' | 'selection') => setDeleteFilter(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="selection">Seleção manual</SelectItem>
                  <SelectItem value="period">Período</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Period Filter */}
            {deleteFilter === 'period' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Excluir conversas anteriores a:</label>
                <Select value={deletePeriod} onValueChange={setDeletePeriod}>
                  <SelectTrigger>
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">7 dias atrás</SelectItem>
                    <SelectItem value="30days">30 dias atrás</SelectItem>
                    <SelectItem value="3months">3 meses atrás</SelectItem>
                    <SelectItem value="6months">6 meses atrás</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Client Filter */}
            {deleteFilter === 'client' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Selecione o cliente:</label>
                <Select value={selectedClientForDelete} onValueChange={setSelectedClientForDelete}>
                  <SelectTrigger>
                    <User className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Escolha um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueClients.map((client) => (
                      <SelectItem key={client} value={client || ''}>
                        {client}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Selection Info */}
            {deleteFilter === 'selection' && (
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                <p>Use os checkboxes na lista de conversas para selecionar quais deseja excluir.</p>
                <p className="mt-2 font-medium">{selectedForDelete.size} conversa(s) selecionada(s)</p>
              </div>
            )}

            {/* Preview count */}
            <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm text-destructive font-medium">
                {getDeleteCount()} conversa(s) serão excluídas permanentemente
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Esta ação não pode ser desfeita
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConversations}
              disabled={isDeleting || getDeleteCount() === 0}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir {getDeleteCount()} conversa(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
