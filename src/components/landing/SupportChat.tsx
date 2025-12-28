import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, User, Mail, Sparkles, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isAI?: boolean;
}

interface VisitorInfo {
  name: string;
  email: string;
}

interface ConversationHistory {
  id: string;
  created_at: string;
  messages: { text: string; isUser: boolean; timestamp: string }[];
}

const getVisitorId = (): string => {
  const storageKey = "salaocloud_visitor_id";
  let visitorId = localStorage.getItem(storageKey);
  
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(storageKey, visitorId);
  }
  
  return visitorId;
};

const getStoredVisitorInfo = (): VisitorInfo | null => {
  const stored = localStorage.getItem("salaocloud_visitor_info");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

const storeVisitorInfo = (info: VisitorInfo) => {
  localStorage.setItem("salaocloud_visitor_info", JSON.stringify(info));
};

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo | null>(getStoredVisitorInfo());
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isEscalated, setIsEscalated] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation history for returning visitors
  useEffect(() => {
    if (visitorInfo) {
      loadConversationHistory();
    }
  }, [visitorInfo]);

  const loadConversationHistory = async () => {
    setLoadingHistory(true);
    try {
      const visitorId = getVisitorId();
      
      // Fetch previous conversations for this visitor
      const { data: conversations, error: convError } = await supabase
        .from("chat_conversations")
        .select("id, created_at, status")
        .eq("visitor_id", visitorId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (convError) throw convError;

      if (conversations && conversations.length > 0) {
        // Fetch messages for each conversation
        const historyPromises = conversations.map(async (conv) => {
          const { data: msgs } = await supabase
            .from("chat_messages")
            .select("message, is_from_user, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: true });

          return {
            id: conv.id,
            created_at: conv.created_at,
            messages: (msgs || []).map(m => ({
              text: m.message,
              isUser: m.is_from_user,
              timestamp: m.created_at
            }))
          };
        });

        const history = await Promise.all(historyPromises);
        setConversationHistory(history.filter(h => h.messages.length > 0));
      }
    } catch (error) {
      console.error("Error loading conversation history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Set welcome message when visitor info is available
  useEffect(() => {
    if (visitorInfo && messages.length === 0) {
      const hasHistory = conversationHistory.length > 0;
      const welcomeText = hasHistory
        ? `Olá novamente, ${visitorInfo.name}! 👋 Que bom ver você de volta! Sou a Silvia, lembra? Como posso ajudar hoje?`
        : `Olá, ${visitorInfo.name}! 👋 Sou a Silvia, sua consultora aqui no SalãoCloud. Como posso ajudar você hoje?`;
      
      setMessages([{
        id: "welcome",
        text: welcomeText,
        isUser: false,
        timestamp: new Date(),
        isAI: true,
      }]);
    }
  }, [visitorInfo, messages.length, conversationHistory.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current && visitorInfo) {
      inputRef.current.focus();
    }
  }, [isOpen, visitorInfo]);

  // Subscribe to realtime messages from admin
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as { id: string; message: string; is_from_user: boolean; created_at: string };
          
          // Only add messages from admin (not from user, as those are already added locally)
          if (!newMessage.is_from_user) {
            setMessages((prev) => {
              // Check if message already exists
              if (prev.some(m => m.id === newMessage.id)) {
                return prev;
              }
              return [...prev, {
                id: newMessage.id,
                text: newMessage.message,
                isUser: false,
                timestamp: new Date(newMessage.created_at),
                isAI: false,
              }];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim() || !visitorEmail.trim()) return;
    
    const info = { name: visitorName.trim(), email: visitorEmail.trim() };
    setVisitorInfo(info);
    storeVisitorInfo(info);
  };

  const createConversation = async (): Promise<string | null> => {
    try {
      const visitorId = getVisitorId();
      
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          visitor_id: visitorId,
          visitor_name: visitorInfo?.name || null,
          visitor_email: visitorInfo?.email || null,
          status: "open",
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error creating conversation:", error);
        return null;
      }

      return data.id;
    } catch (err) {
      console.error("Error creating conversation:", err);
      return null;
    }
  };

  const saveMessage = async (convId: string, message: string, isFromUser: boolean) => {
    try {
      await supabase.from("chat_messages").insert({
        conversation_id: convId,
        message,
        is_from_user: isFromUser,
      });
    } catch (err) {
      console.error("Error saving message:", err);
    }
  };

  const updateConversationStatus = async (convId: string, status: string) => {
    try {
      await supabase
        .from("chat_conversations")
        .update({ status })
        .eq("id", convId);
    } catch (err) {
      console.error("Error updating conversation status:", err);
    }
  };

  const buildHistorySummary = (): string => {
    if (conversationHistory.length === 0) return "";
    
    let summary = "\n\n[HISTÓRICO DE CONVERSAS ANTERIORES DO CLIENTE]\n";
    
    conversationHistory.slice(0, 3).forEach((conv, idx) => {
      const date = new Date(conv.created_at).toLocaleDateString("pt-BR");
      summary += `\n--- Conversa ${idx + 1} (${date}) ---\n`;
      conv.messages.slice(-6).forEach(msg => {
        summary += `${msg.isUser ? "Cliente" : "Atendente"}: ${msg.text}\n`;
      });
    });
    
    summary += "\n[FIM DO HISTÓRICO - Use este contexto para personalizar o atendimento]\n";
    return summary;
  };

  const getAIResponse = async (allMessages: Message[]): Promise<{ response: string; escalate: boolean }> => {
    try {
      const historySummary = buildHistorySummary();
      
      const { data, error } = await supabase.functions.invoke('chat-ai-agent', {
        body: { 
          messages: allMessages.map(m => ({ text: m.text, isUser: m.isUser })),
          visitorName: visitorInfo?.name,
          conversationHistory: historySummary,
          isReturningVisitor: conversationHistory.length > 0
        }
      });

      if (error) {
        console.error('Error calling AI agent:', error);
        throw error;
      }

      return {
        response: data.response,
        escalate: data.escalate || false
      };
    } catch (err) {
      console.error('Error getting AI response:', err);
      return {
        response: "Desculpe, estou com uma pequena dificuldade. Nossa equipe entrará em contato em breve! Para atendimento imediato, chame no WhatsApp (11) 94755-1416. 📱",
        escalate: true
      };
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    const messageText = inputValue;
    setInputValue("");
    setIsTyping(true);

    // Create conversation if it doesn't exist
    let convId = conversationId;
    if (!convId) {
      convId = await createConversation();
      setConversationId(convId);
    }

    // Save user message to database
    if (convId) {
      await saveMessage(convId, messageText, true);
    }

    // If already escalated, don't call AI
    if (isEscalated) {
      setIsTyping(false);
      return;
    }

    // Get AI response
    const { response: aiResponseText, escalate } = await getAIResponse(updatedMessages);
    
    const botResponse: Message = {
      id: `bot-${Date.now()}`,
      text: aiResponseText,
      isUser: false,
      timestamp: new Date(),
      isAI: !escalate,
    };
    
    setMessages((prev) => [...prev, botResponse]);
    setIsTyping(false);

    // Save bot response to database
    if (convId) {
      await saveMessage(convId, aiResponseText, false);
      
      // If escalated, update conversation status
      if (escalate) {
        setIsEscalated(true);
        await updateConversationStatus(convId, 'escalated');
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatHistoryDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110",
          "bg-primary text-primary-foreground",
          isOpen && "rotate-90"
        )}
        aria-label={isOpen ? "Fechar chat" : "Abrir chat de suporte"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-300",
          isOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        {/* Header */}
        <div className="bg-primary p-4 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold flex items-center gap-2">
                Silvia Valentim
                <span className="text-xs bg-primary-foreground/20 px-2 py-0.5 rounded-full">
                  IA
                </span>
              </h3>
              <p className="text-sm opacity-90">Consultora SalãoCloud</p>
            </div>
            {visitorInfo && conversationHistory.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setShowHistory(!showHistory)}
                title="Ver histórico"
              >
                <History className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Visitor Info Form */}
        {!visitorInfo ? (
          <form onSubmit={handleStartChat} className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Por favor, informe seus dados para iniciar o atendimento:
            </p>
            <div className="space-y-2">
              <Label htmlFor="visitor-name">Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="visitor-name"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Seu nome"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitor-email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="visitor-email"
                  type="email"
                  value={visitorEmail}
                  onChange={(e) => setVisitorEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Iniciar conversa
            </Button>
          </form>
        ) : showHistory ? (
          /* History View */
          <div className="h-[380px] flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <span className="text-sm font-medium">Conversas anteriores</span>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                Voltar
              </Button>
            </div>
            <ScrollArea className="flex-1 p-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : conversationHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma conversa anterior
                </p>
              ) : (
                <div className="space-y-3">
                  {conversationHistory.map((conv) => (
                    <div key={conv.id} className="p-3 rounded-lg bg-muted/50 border">
                      <div className="text-xs text-muted-foreground mb-2">
                        {formatHistoryDate(conv.created_at)}
                      </div>
                      <div className="space-y-1.5">
                        {conv.messages.slice(-3).map((msg, idx) => (
                          <div key={idx} className="text-sm">
                            <span className={cn(
                              "font-medium",
                              msg.isUser ? "text-primary" : "text-muted-foreground"
                            )}>
                              {msg.isUser ? "Você" : "Silvia"}:
                            </span>{" "}
                            <span className="text-foreground/80">
                              {msg.text.length > 60 ? msg.text.substring(0, 60) + "..." : msg.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <>
            {/* Returning Visitor Notice */}
            {conversationHistory.length > 0 && (
              <div className="bg-primary/5 px-4 py-2 text-sm text-primary border-b border-primary/10 flex items-center gap-2">
                <History className="h-3.5 w-3.5" />
                <span>Bem-vindo de volta! Temos {conversationHistory.length} conversa(s) anterior(es)</span>
              </div>
            )}

            {/* Escalation Notice */}
            {isEscalated && (
              <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-sm text-amber-700 dark:text-amber-400 border-b border-amber-200 dark:border-amber-800">
                Conversa transferida para atendimento humano
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="h-[320px] p-4" ref={scrollRef}>
              <div className="flex flex-col gap-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex max-w-[85%] flex-col gap-1",
                      message.isUser ? "ml-auto items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm",
                        message.isUser
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      )}
                    >
                      {message.text}
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {!message.isUser && message.isAI && (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {message.timestamp.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex max-w-[85%] flex-col gap-1 items-start">
                    <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Digite sua mensagem..."
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  size="icon"
                  disabled={!inputValue.trim() || isTyping}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
