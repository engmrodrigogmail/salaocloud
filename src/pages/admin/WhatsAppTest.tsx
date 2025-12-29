import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  Send, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Phone,
  AlertTriangle
} from "lucide-react";

interface MessageLog {
  id: string;
  timestamp: Date;
  phone: string;
  message: string;
  status: 'success' | 'error';
  messageId?: string;
  error?: string;
}

const WhatsAppTest = () => {
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking' | 'unknown'>('unknown');
  const [statusDetails, setStatusDetails] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);

  const checkConnection = async () => {
    setIsCheckingStatus(true);
    setConnectionStatus('checking');
    
    try {
      const { data, error } = await supabase.functions.invoke('zapi-whatsapp', {
        body: { action: 'test_connection' }
      });

      if (error) {
        console.error('Error checking Z-API status:', error);
        setConnectionStatus('disconnected');
        setStatusDetails(error.message || 'Erro ao verificar conexão');
        toast({
          title: "Erro ao verificar conexão",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.connected) {
        setConnectionStatus('connected');
        setStatusDetails(data.status || 'Conectado');
        toast({
          title: "Z-API Conectado",
          description: "Conexão com WhatsApp ativa",
        });
      } else {
        setConnectionStatus('disconnected');
        setStatusDetails(data.error || data.status || 'Desconectado');
        toast({
          title: "Z-API Desconectado",
          description: data.error || "Verifique as configurações da instância",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error checking Z-API status:', error);
      setConnectionStatus('disconnected');
      setStatusDetails(error.message || 'Erro de conexão');
      toast({
        title: "Erro de conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const sendTestMessage = async () => {
    if (!phone.trim()) {
      toast({
        title: "Telefone obrigatório",
        description: "Informe o número de telefone para enviar a mensagem",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Mensagem obrigatória",
        description: "Digite uma mensagem para enviar",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('zapi-whatsapp', {
        body: { 
          action: 'send_message',
          phone: phone.trim(),
          message: message.trim()
        }
      });

      const logEntry: MessageLog = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        phone: phone.trim(),
        message: message.trim(),
        status: 'error',
      };

      if (error) {
        logEntry.error = error.message;
        setMessageLogs(prev => [logEntry, ...prev]);
        toast({
          title: "Erro ao enviar mensagem",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.success) {
        logEntry.status = 'success';
        logEntry.messageId = data.messageId;
        setMessageLogs(prev => [logEntry, ...prev]);
        toast({
          title: "Mensagem enviada!",
          description: `ID: ${data.messageId}`,
        });
        setMessage('');
      } else {
        logEntry.error = data.error;
        setMessageLogs(prev => [logEntry, ...prev]);
        toast({
          title: "Falha no envio",
          description: data.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const logEntry: MessageLog = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        phone: phone.trim(),
        message: message.trim(),
        status: 'error',
        error: error.message,
      };
      setMessageLogs(prev => [logEntry, ...prev]);
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatPhone = (value: string) => {
    // Remove non-numeric characters for display formatting
    const cleaned = value.replace(/\D/g, '');
    
    // Format as Brazilian phone: (XX) XXXXX-XXXX
    if (cleaned.length <= 2) {
      return cleaned;
    } else if (cleaned.length <= 7) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    } else if (cleaned.length <= 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teste WhatsApp (Z-API)</h1>
          <p className="text-muted-foreground">
            Tela provisória para teste de envio e recebimento de mensagens
          </p>
        </div>
        <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Ambiente de Teste
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Connection Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : connectionStatus === 'checking' ? (
                <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              Status da Conexão
            </CardTitle>
            <CardDescription>
              Verifique se o Z-API está conectado ao WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/50">
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'checking' ? 'bg-blue-500 animate-pulse' :
                connectionStatus === 'disconnected' ? 'bg-red-500' :
                'bg-gray-400'
              }`} />
              <div className="flex-1">
                <p className="font-medium">
                  {connectionStatus === 'connected' ? 'Conectado' :
                   connectionStatus === 'checking' ? 'Verificando...' :
                   connectionStatus === 'disconnected' ? 'Desconectado' :
                   'Status desconhecido'}
                </p>
                {statusDetails && (
                  <p className="text-sm text-muted-foreground">{statusDetails}</p>
                )}
              </div>
            </div>
            
            <Button 
              onClick={checkConnection} 
              disabled={isCheckingStatus}
              className="w-full"
            >
              {isCheckingStatus ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Verificar Conexão
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Send Message Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Enviar Mensagem de Teste
            </CardTitle>
            <CardDescription>
              Teste o envio de mensagens via WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="pl-10"
                  maxLength={16}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Formato: DDD + número (o código 55 será adicionado automaticamente)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                placeholder="Digite sua mensagem de teste..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
              />
            </div>

            <Button 
              onClick={sendTestMessage} 
              disabled={isSending || !phone.trim() || !message.trim()}
              className="w-full"
            >
              {isSending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Mensagem
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Message Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Mensagens</CardTitle>
          <CardDescription>
            Registro das mensagens enviadas nesta sessão
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messageLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma mensagem enviada ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messageLogs.map((log) => (
                <div 
                  key={log.id} 
                  className={`p-4 rounded-lg border ${
                    log.status === 'success' 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                      : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {log.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium text-sm">{log.phone}</span>
                        <span className="text-xs text-muted-foreground">
                          {log.timestamp.toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {log.message}
                      </p>
                      {log.messageId && (
                        <p className="text-xs text-green-600 mt-1">
                          ID: {log.messageId}
                        </p>
                      )}
                      {log.error && (
                        <p className="text-xs text-red-600 mt-1">
                          Erro: {log.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instruções de Configuração</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ol className="space-y-2">
            <li>Acesse sua conta no <strong>Z-API</strong> e crie uma instância</li>
            <li>Conecte seu WhatsApp Business escaneando o QR Code</li>
            <li>Copie o <strong>Instance ID</strong> e o <strong>Token</strong> da instância</li>
            <li>Configure os secrets <code>Z_API_INSTANCE_ID</code> e <code>Z_API_TOKEN</code></li>
            <li>Clique em "Verificar Conexão" para confirmar que está tudo certo</li>
            <li>Envie uma mensagem de teste para validar a integração</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppTest;
