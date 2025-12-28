import { useState, useRef, useEffect } from "react";
import { X, Send, User, Mail, Sparkles, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import silviaAvatar from "@/assets/silvia-avatar.png";
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

const CHAT_CACHE_KEY = "salaocloud_support_chat_cache_v1";

type ChatCache = {
  visitorId: string;
  conversationId: string | null;
  isEscalated: boolean;
  messages: { id: string; text: string; isUser: boolean; timestamp: string; isAI?: boolean }[];
  updatedAt: string;
};

const loadChatCache = (): ChatCache | null => {
  const raw = localStorage.getItem(CHAT_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChatCache;
  } catch {
    return null;
  }
};

const saveChatCache = (cache: ChatCache) => {
  localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(cache));
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
  const [historyReady, setHistoryReady] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation history and restore current session for returning visitors
  useEffect(() => {
    if (!visitorInfo) return;

    setHistoryReady(false);
    void loadConversationHistory().finally(() => setHistoryReady(true));
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

      if (!conversations || conversations.length === 0) {
        setConversationHistory([]);
        return;
      }

      // Check if there's a recent open conversation (within last 24 hours)
      const recentConv = conversations.find((conv) => {
        const convDate = new Date(conv.created_at);
        const now = new Date();
        const diffHours = (now.getTime() - convDate.getTime()) / (1000 * 60 * 60);
        return (conv.status === "open" || conv.status === "escalated") && diffHours < 24;
      });

      // If there's a recent conversation, restore it
      if (recentConv) {
        const { data: msgs, error: msgsError } = await supabase
          .from("chat_messages")
          .select("id, message, is_from_user, created_at")
          .eq("conversation_id", recentConv.id)
          .order("created_at", { ascending: true });

        if (msgsError) throw msgsError;

        if (msgs && msgs.length > 0) {
          setConversationId(recentConv.id);
          setIsEscalated(recentConv.status === "escalated");

          // Restore messages to current chat
          const restoredMessages: Message[] = msgs.map((m) => ({
            id: m.id,
            text: m.message,
            isUser: m.is_from_user,
            timestamp: new Date(m.created_at),
            isAI: !m.is_from_user,
          }));

          setMessages(restoredMessages);
        }
      }

      // Fetch messages for history (excluding current conversation)
      const historyConversations = conversations.filter((c) => c.id !== recentConv?.id);
      const historyPromises = historyConversations.map(async (conv) => {
        const { data: msgs, error: historyMsgsError } = await supabase
          .from("chat_messages")
          .select("message, is_from_user, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true });

        if (historyMsgsError) throw historyMsgsError;

        return {
          id: conv.id,
          created_at: conv.created_at,
          messages: (msgs || []).map((m) => ({
            text: m.message,
            isUser: m.is_from_user,
            timestamp: m.created_at,
          })),
        };
      });

      const history = await Promise.all(historyPromises);
      setConversationHistory(history.filter((h) => h.messages.length > 0));
    } catch (error) {
      console.error("Error loading conversation history:", error);
    } finally {
      setLoadingHistory(false);
      setHistoryReady(true);
    }
  };

  // Set welcome message when visitor info is available (only after history load attempt)
  useEffect(() => {
    if (!visitorInfo) return;
    if (!historyReady) return;
    if (messages.length > 0) return;

    const hasHistory = conversationHistory.length > 0;
    const welcomeText = hasHistory
      ? `Olá novamente, ${visitorInfo.name}! 👋 Que bom ver você de volta! Sou a Silvia, lembra? Como posso ajudar hoje?`
      : `Olá, ${visitorInfo.name}! 👋 Sou a Silvia, sua consultora aqui no SalãoCloud. Como posso ajudar você hoje?`;

    setMessages([
      {
        id: "welcome",
        text: welcomeText,
        isUser: false,
        timestamp: new Date(),
        isAI: true,
      },
    ]);
  }, [visitorInfo, historyReady, messages.length, conversationHistory.length]);


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

  // Calculate humanized typing delay based on response length
  const calculateTypingDelay = (text: string): number => {
    const wordCount = text.split(/\s+/).length;
    const charCount = text.length;
    
    // Base delay calculation
    // Short responses (< 30 chars or < 8 words): 2-3 seconds
    // Medium responses (30-100 chars or 8-25 words): 3-4.5 seconds
    // Long responses (> 100 chars or > 25 words): 4.5-6 seconds
    
    let minDelay: number;
    let maxDelay: number;
    
    if (charCount < 30 || wordCount < 8) {
      minDelay = 2000;
      maxDelay = 3000;
    } else if (charCount < 100 || wordCount < 25) {
      minDelay = 3000;
      maxDelay = 4500;
    } else {
      minDelay = 4500;
      maxDelay = 6000;
    }
    
    // Add some randomness within the range
    return minDelay + Math.random() * (maxDelay - minDelay);
  };

  // Split response into message blocks if it contains [CONTINUA]
  const splitResponseIntoBlocks = (text: string): string[] => {
    // Split by [CONTINUA] marker
    const blocks = text.split(/\s*\[CONTINUA\]\s*/i).filter(block => block.trim());
    return blocks.length > 0 ? blocks : [text];
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
      return;
    }

    // Get AI response first (in background)
    const aiResponsePromise = getAIResponse(updatedMessages);

    // Wait 1 second before showing "typing" indicator
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsTyping(true);

    // Get the AI response
    const { response: aiResponseText, escalate } = await aiResponsePromise;

    // Split response into blocks
    const messageBlocks = splitResponseIntoBlocks(aiResponseText);
    
    // Send each block as a separate message with typing delays
    for (let i = 0; i < messageBlocks.length; i++) {
      const blockText = messageBlocks[i].trim();
      
      // Calculate humanized delay based on this block's length
      const typingDelay = calculateTypingDelay(blockText);
      
      // Wait for the calculated typing delay
      await new Promise(resolve => setTimeout(resolve, typingDelay));
      
      const botResponse: Message = {
        id: `bot-${Date.now()}-${i}`,
        text: blockText,
        isUser: false,
        timestamp: new Date(),
        isAI: !escalate,
      };
      
      setMessages((prev) => [...prev, botResponse]);
      
      // Save this block to database
      if (convId) {
        await saveMessage(convId, blockText, false);
      }
      
      // If there are more blocks, show typing again
      if (i < messageBlocks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
        // Keep typing indicator on for next message
      }
    }
    
    setIsTyping(false);

    // If escalated, update conversation status
    if (convId && escalate) {
      setIsEscalated(true);
      await updateConversationStatus(convId, 'escalated');
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
      {/* Chat Button - WhatsApp style */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Label */}
        {!isOpen && (
          <div className="absolute -top-10 right-0 bg-white dark:bg-gray-800 text-foreground text-sm px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap animate-bounce">
            <span className="font-medium">Fale com a Silvia!</span>
            <div className="absolute -bottom-1 right-6 w-2 h-2 bg-white dark:bg-gray-800 transform rotate-45" />
          </div>
        )}
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "relative flex items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110",
            isOpen ? "h-14 w-14 bg-[#25D366]" : "h-16 w-16"
          )}
          aria-label={isOpen ? "Fechar chat" : "Abrir chat de suporte"}
        >
          {isOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <>
              <img 
                src={silviaAvatar} 
                alt="Silvia - Suporte" 
                className="h-full w-full rounded-full object-cover border-4 border-[#25D366]"
              />
              {/* Online indicator */}
              <span className="absolute bottom-0 right-0 h-4 w-4 bg-[#25D366] rounded-full border-2 border-white" />
            </>
          )}
        </button>
      </div>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-300",
          isOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        {/* Header - WhatsApp green */}
        <div className="bg-[#075E54] p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src={silviaAvatar} 
                alt="Silvia Valentim" 
                className="h-12 w-12 rounded-full object-cover border-2 border-white/30"
              />
              <span className="absolute bottom-0 right-0 h-3 w-3 bg-[#25D366] rounded-full border-2 border-[#075E54]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold flex items-center gap-2">
                Silvia Valentim
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  IA
                </span>
              </h3>
              <p className="text-sm text-white/80">Online • Consultora SalãoCloud</p>
            </div>
            {visitorInfo && conversationHistory.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
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
