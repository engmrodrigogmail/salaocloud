import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  MessageCircle, 
  X, 
  Send, 
  Loader2,
  Bot,
  User,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import silviaAvatar from "@/assets/silvia-avatar.png";

interface Message {
  id: string;
  content: string;
  senderType: 'client' | 'assistant';
  createdAt: Date;
}

interface BrandColors {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
}

interface ClientData {
  name: string;
  phone: string;
  id?: string;
}

interface EstablishmentAIChatProps {
  establishmentId: string;
  establishmentName: string;
  brandColors?: BrandColors;
  clientData?: ClientData | null;
  className?: string;
}

export function EstablishmentAIChat({ 
  establishmentId, 
  establishmentName,
  brandColors,
  clientData,
  className 
}: EstablishmentAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [assistantName, setAssistantName] = useState("Assistente");
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Start conversation when chat opens
  const startConversation = useCallback(async () => {
    if (conversationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('establishment-ai-assistant', {
        body: {
          action: 'start_conversation',
          establishmentId,
          clientName: clientData?.name,
          clientPhone: clientData?.phone,
          clientId: clientData?.id,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        return;
      }

      setConversationId(data.conversationId);
      setAssistantName(data.assistantName || 'Assistente');

      // Add welcome message
      if (data.welcomeMessage) {
        setMessages([{
          id: 'welcome',
          content: data.welcomeMessage,
          senderType: 'assistant',
          createdAt: new Date(),
        }]);
      }

      // Add offline notice if exists
      if (data.offlineNotice) {
        setMessages(prev => [...prev, {
          id: 'offline',
          content: data.offlineNotice,
          senderType: 'assistant',
          createdAt: new Date(),
        }]);
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError('Não foi possível iniciar o chat. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, establishmentId]);

  useEffect(() => {
    if (isOpen && !conversationId) {
      startConversation();
    }
  }, [isOpen, conversationId, startConversation]);

  const sendMessage = async (messageContent: string) => {
    if (!messageContent.trim() || !conversationId || isLoading || limitReached) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: messageContent,
      senderType: 'client',
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('establishment-ai-assistant', {
        body: {
          action: 'send_message',
          establishmentId,
          conversationId,
          message: messageContent,
          messageType: 'text',
          clientName: clientData?.name,
          clientPhone: clientData?.phone,
          clientId: clientData?.id,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        if (data.limitReached) {
          setLimitReached(true);
        }
        setError(data.error);
        return;
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        content: data.message,
        senderType: 'assistant',
        createdAt: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Handle escalation
      if (data.shouldEscalate) {
        setMessages(prev => [...prev, {
          id: `escalated-${Date.now()}`,
          content: '📞 Sua conversa foi encaminhada para atendimento humano. Em breve entrarão em contato!',
          senderType: 'assistant',
          createdAt: new Date(),
        }]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const primaryColor = brandColors?.primary || 'hsl(var(--primary))';

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-3 group",
          "transition-all duration-300 hover:scale-105",
          className
        )}
      >
        <div 
          className="px-4 py-2 rounded-full shadow-lg text-white font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap"
          style={{ backgroundColor: primaryColor }}
        >
          Fale com {assistantName}
        </div>
        <div 
          className="h-16 w-16 rounded-full shadow-xl border-4 overflow-hidden ring-2 ring-offset-2 transition-shadow hover:ring-4"
          style={{ 
            borderColor: 'white',
            boxShadow: `0 0 0 2px ${primaryColor}` 
          }}
        >
          <img 
            src={silviaAvatar} 
            alt={`Fale com ${assistantName}`}
            className="h-full w-full object-cover"
          />
        </div>
      </button>
    );
  }

  return (
    <Card className={cn(
      "fixed bottom-6 right-6 w-[380px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-6rem)]",
      "shadow-2xl z-50 flex flex-col overflow-hidden",
      className
    )}>
      <CardHeader 
        className="flex flex-row items-center justify-between p-4 border-b text-white rounded-t-lg"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-white/30">
            <AvatarImage src={silviaAvatar} alt={assistantName} />
            <AvatarFallback className="bg-white/20 text-white">
              <Bot className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{assistantName}</h3>
            <p className="text-xs text-white/70">{establishmentName}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setIsOpen(false)}
          className="text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  message.senderType === 'client' ? "justify-end" : "justify-start"
                )}
              >
                {message.senderType === 'assistant' && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2",
                    message.senderType === 'client'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <span className={cn(
                    "text-[10px] opacity-60 mt-1 block",
                    message.senderType === 'client' ? "text-right" : "text-left"
                  )}>
                    {message.createdAt.toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                {message.senderType === 'client' && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {error && (
          <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {limitReached ? (
          <div className="p-4 border-t bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground">
              Limite de mensagens gratuitas atingido.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!inputValue.trim() || isLoading}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
