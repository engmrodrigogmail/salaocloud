import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const AUTO_RESPONSES: Record<string, string> = {
  "preço": "Nossos planos começam em R$49/mês. Você pode ver todos os detalhes na seção de preços acima!",
  "plano": "Temos 3 planos: Básico, Profissional e Premium. Cada um com funcionalidades específicas para o seu negócio.",
  "teste": "Sim! Oferecemos 7 dias grátis para você testar todas as funcionalidades.",
  "trial": "Sim! Oferecemos 7 dias grátis para você testar todas as funcionalidades.",
  "grátis": "Oferecemos 7 dias de teste grátis! Sem compromisso.",
  "funciona": "O SalãoCloud é um sistema completo de gestão para salões. Você pode agendar clientes, gerenciar profissionais, controlar comandas e muito mais!",
  "ajuda": "Estou aqui para ajudar! Me conte qual é sua dúvida sobre o SalãoCloud.",
  "contato": "Você pode nos contatar pelo WhatsApp (11) 94755-1416 ou por este chat. Como posso ajudar?",
  "whatsapp": "Nosso WhatsApp é (11) 94755-1416. Estamos disponíveis de segunda a sexta, das 9h às 18h.",
};

const getAutoResponse = (message: string): string => {
  const lowerMessage = message.toLowerCase();
  
  for (const [keyword, response] of Object.entries(AUTO_RESPONSES)) {
    if (lowerMessage.includes(keyword)) {
      return response;
    }
  }
  
  return "Obrigado pela mensagem! Nossa equipe entrará em contato em breve. Para atendimento imediato, chame no WhatsApp (11) 94755-1416.";
};

const getVisitorId = (): string => {
  const storageKey = "salaocloud_visitor_id";
  let visitorId = localStorage.getItem(storageKey);
  
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(storageKey, visitorId);
  }
  
  return visitorId;
};

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Olá! 👋 Bem-vindo ao SalãoCloud. Como posso ajudar você hoje?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const createConversation = async (): Promise<string | null> => {
    try {
      const visitorId = getVisitorId();
      
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          visitor_id: visitorId,
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

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
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

    // Simulate bot response
    setTimeout(async () => {
      const responseText = getAutoResponse(messageText);
      
      const botResponse: Message = {
        id: `bot-${Date.now()}`,
        text: responseText,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
      setIsTyping(false);

      // Save bot response to database
      if (convId) {
        await saveMessage(convId, responseText, false);
      }
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Suporte SalãoCloud</h3>
              <p className="text-sm opacity-90">Normalmente respondemos em minutos</p>
            </div>
          </div>
        </div>

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
                <span className="text-xs text-muted-foreground">
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
              disabled={!inputValue.trim()}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
