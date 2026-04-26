import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  MessageCircle, 
  X, 
  Send, 
  Loader2,
  Bot,
  User,
  AlertCircle,
  Calendar,
  Check,
  Tag,
  Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import silviaAvatar from "@/assets/silvia-avatar.png";

interface Message {
  id: string;
  content: string;
  senderType: 'client' | 'assistant';
  createdAt: Date;
  showAppointmentsList?: boolean;
}

interface Appointment {
  id: string;
  serviceName: string;
  professionalName: string;
  dateTime: string;
  status: string;
  price: number;
}

interface Promotion {
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
}

interface PromotionData {
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  endDate: string;
  allPromotions: Promotion[];
}

interface ClientData {
  name: string;
  phone: string;
  id?: string;
}

interface EstablishmentAIChatProps {
  establishmentId: string;
  establishmentName: string;
  clientData?: ClientData | null;
  className?: string;
}

export function EstablishmentAIChat({
  establishmentId,
  establishmentName,
  clientData,
  className,
}: EstablishmentAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [assistantName, setAssistantName] = useState("Assistente");
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  
  // Appointment management state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
  const [showAppointmentManagement, setShowAppointmentManagement] = useState(false);
  const [managementAction, setManagementAction] = useState<'cancel' | 'reschedule' | 'confirm' | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Promotion state
  const [promotionData, setPromotionData] = useState<PromotionData | null>(null);
  const [showPromotionBanner, setShowPromotionBanner] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showAppointmentManagement, showConfirmation]);

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

      // Check if there are existing messages (conversation history from last 24h)
      if (data.existingMessages && data.existingMessages.length > 0) {
        const restoredMessages: Message[] = data.existingMessages.map((m: any, idx: number) => ({
          id: `restored-${idx}`,
          content: m.content,
          senderType: m.senderType === 'client' ? 'client' : 'assistant',
          createdAt: new Date(m.createdAt),
        }));
        setMessages(restoredMessages);
        
        // Add a system message indicating conversation was resumed
        setMessages(prev => [...prev, {
          id: 'resumed-notice',
          content: 'Conversa retomada. Como posso ajudar?',
          senderType: 'assistant',
          createdAt: new Date(),
        }]);
      } else {
        // New conversation - check for promotions first
        if (data.promotionData && data.promotionData.allPromotions?.length > 0) {
          setPromotionData(data.promotionData);
          setShowPromotionBanner(true);
        }
        
        // Add welcome message
        if (data.welcomeMessage) {
          setMessages([{
            id: 'welcome',
            content: data.welcomeMessage,
            senderType: 'assistant',
            createdAt: new Date(),
          }]);
        }
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
  }, [conversationId, establishmentId, clientData]);

  useEffect(() => {
    if (isOpen && !conversationId) {
      startConversation();
    }
  }, [isOpen, conversationId, startConversation]);

  const fetchAppointments = async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('establishment-ai-assistant', {
        body: {
          action: 'get_appointments',
          establishmentId,
          clientId: clientData?.id,
          clientPhone: clientData?.phone,
        },
      });

      if (fnError) throw fnError;

      if (data.appointments && data.appointments.length > 0) {
        setAppointments(data.appointments);
        setShowAppointmentManagement(true);
        setManagementAction(null);
        setSelectedAppointments([]);
      } else {
        // No appointments found
        const noApptMessage: Message = {
          id: `no-appt-${Date.now()}`,
          content: 'Não encontrei agendamentos futuros para você. Posso ajudar com algo mais?',
          senderType: 'assistant',
          createdAt: new Date(),
        };
        setMessages(prev => [...prev, noApptMessage]);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Erro ao buscar agendamentos.');
    }
  };

  const handleCancelAppointments = async () => {
    if (selectedAppointments.length === 0) return;

    setIsCancelling(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('establishment-ai-assistant', {
        body: {
          action: 'cancel_appointments',
          establishmentId,
          conversationId,
          appointmentIds: selectedAppointments,
          cancelReason: 'Cancelado pelo cliente via assistente virtual',
        },
      });

      if (fnError) throw fnError;

      // Add confirmation message
      const confirmMessage: Message = {
        id: `cancel-confirm-${Date.now()}`,
        content: data.message || 'Agendamento(s) cancelado(s) com sucesso!',
        senderType: 'assistant',
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, confirmMessage]);

      // Reset state
      setShowAppointmentManagement(false);
      setManagementAction(null);
      setShowConfirmation(false);
      setAppointments([]);
      setSelectedAppointments([]);
    } catch (err) {
      console.error('Error cancelling appointments:', err);
      setError('Erro ao cancelar agendamentos. Tente novamente.');
    } finally {
      setIsCancelling(false);
    }
  };

  const toggleAppointmentSelection = (id: string) => {
    setSelectedAppointments(prev => 
      prev.includes(id) 
        ? prev.filter(a => a !== id) 
        : [...prev, id]
    );
  };

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
        showAppointmentsList: data.showAppointmentsList,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If AI triggered appointments list, fetch them
      if (data.showAppointmentsList) {
        await fetchAppointments();
      }

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

  const primaryColor = 'hsl(var(--primary))';

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
            {/* Promotion Banner - Shows at start of new conversations */}
            {showPromotionBanner && promotionData && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Promoção Especial!
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Aproveite antes que acabe!
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {promotionData.allPromotions.map((promo, idx) => (
                    <div
                      key={idx}
                      className="bg-white/60 dark:bg-white/5 rounded-lg p-3 border border-amber-100 dark:border-amber-800/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{promo.name}</p>
                        <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full whitespace-nowrap">
                          {promo.discountType === 'percentage' 
                            ? `${promo.discountValue}% OFF` 
                            : `R$ ${promo.discountValue} OFF`}
                        </span>
                      </div>
                      {promo.description && (
                        <p className="text-xs text-muted-foreground mt-1">{promo.description}</p>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                    onClick={() => {
                      setShowPromotionBanner(false);
                      sendMessage('Quero aproveitar a promoção! Me mostre os horários disponíveis.');
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Quero Aproveitar!
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPromotionBanner(false)}
                  >
                    Depois
                  </Button>
                </div>
              </div>
            )}
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

            {/* Appointment Management UI */}
            {showAppointmentManagement && appointments.length > 0 && !managementAction && (
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Seus agendamentos:
                </p>
                <div className="space-y-2">
                  {appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-3 rounded-lg border border-border bg-background"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {apt.serviceName}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>{apt.dateTime}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        com {apt.professionalName}
                      </p>
                    </div>
                  ))}
                </div>
                
                <p className="text-sm text-muted-foreground pt-2">
                  O que você gostaria de fazer?
                </p>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Send message to AI about rescheduling
                      setShowAppointmentManagement(false);
                      sendMessage('Gostaria de remarcar um agendamento');
                    }}
                  >
                    📅 Remarcar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Send message to AI about confirming
                      setShowAppointmentManagement(false);
                      const confirmMsg: Message = {
                        id: `confirm-info-${Date.now()}`,
                        content: 'Seus agendamentos estão confirmados! Você receberá lembretes próximo à data.',
                        senderType: 'assistant',
                        createdAt: new Date(),
                      };
                      setMessages(prev => [...prev, confirmMsg]);
                      setAppointments([]);
                    }}
                  >
                    ✅ Confirmar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Send message to AI about changing professional
                      setShowAppointmentManagement(false);
                      sendMessage('Gostaria de alterar o profissional de um agendamento');
                    }}
                  >
                    👤 Alterar profissional
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Send message to AI about adding service
                      setShowAppointmentManagement(false);
                      sendMessage('Gostaria de adicionar um serviço ao meu agendamento');
                    }}
                  >
                    ➕ Adicionar serviço
                  </Button>
                </div>
                
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => setManagementAction('cancel')}
                >
                  ❌ Cancelar agendamento
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    setShowAppointmentManagement(false);
                    setAppointments([]);
                  }}
                >
                  Fechar
                </Button>
              </div>
            )}

            {/* Cancel Selection UI */}
            {showAppointmentManagement && managementAction === 'cancel' && !showConfirmation && appointments.length > 0 && (
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Selecione os agendamentos que deseja cancelar:
                </p>
                <div className="space-y-2">
                  {appointments.map((apt) => (
                    <div
                      key={apt.id}
                      onClick={() => toggleAppointmentSelection(apt.id)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedAppointments.includes(apt.id)
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-muted/50"
                      )}
                    >
                      <Checkbox
                        checked={selectedAppointments.includes(apt.id)}
                        onCheckedChange={() => toggleAppointmentSelection(apt.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {apt.serviceName}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>{apt.dateTime}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          com {apt.professionalName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setManagementAction(null);
                      setSelectedAppointments([]);
                    }}
                    className="flex-1"
                  >
                    Voltar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowConfirmation(true)}
                    disabled={selectedAppointments.length === 0}
                    className="flex-1"
                  >
                    Continuar ({selectedAppointments.length})
                  </Button>
                </div>
              </div>
            )}

            {/* Confirmation Dialog */}
            {showConfirmation && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Confirmar cancelamento de {selectedAppointments.length} agendamento(s)?
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {appointments
                    .filter(apt => selectedAppointments.includes(apt.id))
                    .map(apt => (
                      <li key={apt.id} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                        {apt.serviceName} - {apt.dateTime}
                      </li>
                    ))
                  }
                </ul>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfirmation(false)}
                    disabled={isCancelling}
                    className="flex-1"
                  >
                    Voltar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelAppointments}
                    disabled={isCancelling}
                    className="flex-1"
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cancelando...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Confirmar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

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
              disabled={isLoading || showAppointmentManagement}
              className="flex-1"
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!inputValue.trim() || isLoading || showAppointmentManagement}
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
