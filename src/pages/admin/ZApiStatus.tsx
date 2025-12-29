import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertTriangle,
  Activity,
  Clock,
  Server,
  Bell,
  History,
  Settings
} from "lucide-react";

interface ServiceStatus {
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  lastCheck: Date | null;
  responseTime: number | null;
  details: string;
  connected: boolean;
}

interface MessageLog {
  id: string;
  timestamp: Date;
  phone: string;
  message: string;
  status: 'success' | 'error';
  messageId?: string;
  error?: string;
  responseTime?: number;
}

interface StatusHistory {
  id: string;
  timestamp: Date;
  status: 'operational' | 'degraded' | 'down';
  details: string;
}

const ZApiStatus = () => {
  const { toast } = useToast();
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    status: 'unknown',
    lastCheck: null,
    responseTime: null,
    details: 'Aguardando verificação inicial...',
    connected: false
  });
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60); // seconds
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  
  // Test message state
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);

  const checkServiceStatus = useCallback(async (showToast = true) => {
    setIsCheckingStatus(true);
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('zapi-whatsapp', {
        body: { action: 'test_connection' }
      });

      const responseTime = Date.now() - startTime;
      const timestamp = new Date();

      if (error) {
        const newStatus: ServiceStatus = {
          status: 'down',
          lastCheck: timestamp,
          responseTime: null,
          details: error.message || 'Erro ao conectar com o serviço',
          connected: false
        };
        setServiceStatus(newStatus);
        addToHistory('down', error.message || 'Erro de conexão');
        
        if (showToast) {
          toast({
            title: "Serviço Indisponível",
            description: "Não foi possível conectar ao Z-API",
            variant: "destructive",
          });
        }
        return;
      }

      let status: 'operational' | 'degraded' | 'down' = 'down';
      
      if (data.connected) {
        // Check response time for degraded status
        if (responseTime > 5000) {
          status = 'degraded';
        } else {
          status = 'operational';
        }
      }

      const newStatus: ServiceStatus = {
        status,
        lastCheck: timestamp,
        responseTime,
        details: data.status || (data.connected ? 'Serviço operacional' : 'Desconectado'),
        connected: data.connected
      };
      
      setServiceStatus(newStatus);
      addToHistory(status, newStatus.details);

      if (showToast) {
        if (status === 'operational') {
          toast({
            title: "Serviço Operacional",
            description: `Tempo de resposta: ${responseTime}ms`,
          });
        } else if (status === 'degraded') {
          toast({
            title: "Serviço Lento",
            description: `Tempo de resposta elevado: ${responseTime}ms`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Serviço Indisponível",
            description: data.error || "WhatsApp não conectado",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      const newStatus: ServiceStatus = {
        status: 'down',
        lastCheck: new Date(),
        responseTime: null,
        details: error.message || 'Erro de conexão',
        connected: false
      };
      setServiceStatus(newStatus);
      addToHistory('down', error.message || 'Erro de conexão');
      
      if (showToast) {
        toast({
          title: "Erro de Verificação",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsCheckingStatus(false);
    }
  }, [toast]);

  const addToHistory = (status: 'operational' | 'degraded' | 'down', details: string) => {
    const entry: StatusHistory = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      status,
      details
    };
    setStatusHistory(prev => [entry, ...prev].slice(0, 50)); // Keep last 50 entries
  };

  // Auto-refresh effect
  useEffect(() => {
    // Initial check
    checkServiceStatus(false);

    if (autoRefresh) {
      const interval = setInterval(() => {
        checkServiceStatus(false);
      }, refreshInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, checkServiceStatus]);

  const sendTestMessage = async () => {
    if (!phone.trim() || !message.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe o telefone e a mensagem",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    const startTime = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('zapi-whatsapp', {
        body: { 
          action: 'send_message',
          phone: phone.trim(),
          message: message.trim()
        }
      });

      const responseTime = Date.now() - startTime;

      const logEntry: MessageLog = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        phone: phone.trim(),
        message: message.trim(),
        status: 'error',
        responseTime
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
          description: `ID: ${data.messageId} (${responseTime}ms)`,
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
    const cleaned = value.replace(/\D/g, '');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'down': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational': 
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Operacional</Badge>;
      case 'degraded': 
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Degradado</Badge>;
      case 'down': 
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">Indisponível</Badge>;
      default: 
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  const uptime = statusHistory.length > 0 
    ? Math.round((statusHistory.filter(h => h.status === 'operational').length / statusHistory.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Status Z-API</h1>
          <p className="text-muted-foreground">
            Monitoramento e testes da integração WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(serviceStatus.status)}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => checkServiceStatus()}
            disabled={isCheckingStatus}
          >
            {isCheckingStatus ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${getStatusColor(serviceStatus.status)}`} />
              <div>
                <p className="text-sm text-muted-foreground">Status Atual</p>
                <p className="text-xl font-bold capitalize">
                  {serviceStatus.status === 'operational' ? 'Operacional' :
                   serviceStatus.status === 'degraded' ? 'Degradado' :
                   serviceStatus.status === 'down' ? 'Indisponível' : 'Desconhecido'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Tempo de Resposta</p>
                <p className="text-xl font-bold">
                  {serviceStatus.responseTime ? `${serviceStatus.responseTime}ms` : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Activity className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Uptime (sessão)</p>
                <p className="text-xl font-bold">{uptime}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Server className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Última Verificação</p>
                <p className="text-xl font-bold">
                  {serviceStatus.lastCheck 
                    ? serviceStatus.lastCheck.toLocaleTimeString('pt-BR') 
                    : 'Nunca'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Banner */}
      {serviceStatus.status === 'down' && (
        <Card className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-200">
                  Serviço Indisponível
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {serviceStatus.details}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Verifique as credenciais Z_API_INSTANCE_ID e Z_API_TOKEN, e confirme que a instância está conectada ao WhatsApp.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {serviceStatus.status === 'degraded' && (
        <Card className="border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Performance Degradada
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  O serviço está respondendo mais lentamente que o esperado ({serviceStatus.responseTime}ms).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="monitoring" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitoramento
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Teste de Envio
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Connection Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {serviceStatus.connected ? (
                    <Wifi className="h-5 w-5 text-green-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-red-500" />
                  )}
                  Detalhes da Conexão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">WhatsApp Conectado</span>
                    <span className={serviceStatus.connected ? 'text-green-600' : 'text-red-600'}>
                      {serviceStatus.connected ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Status do Serviço</span>
                    <span>{serviceStatus.details}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Auto-refresh</span>
                    <span className={autoRefresh ? 'text-green-600' : 'text-muted-foreground'}>
                      {autoRefresh ? `A cada ${refreshInterval}s` : 'Desativado'}
                    </span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => checkServiceStatus()} 
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
                      Verificar Agora
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Recent Status Changes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Alterações Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statusHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum registro ainda</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {statusHistory.slice(0, 10).map((entry) => (
                      <div 
                        key={entry.id}
                        className="flex items-center gap-3 p-2 rounded border bg-muted/30"
                      >
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(entry.status)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {entry.status === 'operational' ? 'Operacional' :
                             entry.status === 'degraded' ? 'Degradado' : 'Indisponível'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.timestamp.toLocaleTimeString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Send Message Form */}
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
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      className="pl-10"
                      maxLength={16}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato: DDD + número (código 55 adicionado automaticamente)
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

            {/* Message Logs */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Envios</CardTitle>
                <CardDescription>
                  Mensagens enviadas nesta sessão
                </CardDescription>
              </CardHeader>
              <CardContent>
                {messageLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma mensagem enviada</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {messageLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className={`p-3 rounded-lg border ${
                          log.status === 'success' 
                            ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                            : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {log.status === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium text-sm">{log.phone}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {log.timestamp.toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {log.message}
                        </p>
                        {log.responseTime && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Tempo: {log.responseTime}ms
                          </p>
                        )}
                        {log.error && (
                          <p className="text-xs text-red-600 mt-1">
                            Erro: {log.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Status</CardTitle>
              <CardDescription>
                Registro das últimas 50 verificações de status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum registro de status ainda</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {statusHistory.map((entry) => (
                    <div 
                      key={entry.id}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30"
                    >
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(entry.status)}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {entry.status === 'operational' ? 'Operacional' :
                             entry.status === 'degraded' ? 'Degradado' : 'Indisponível'}
                          </span>
                          {getStatusBadge(entry.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{entry.details}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {entry.timestamp.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Monitoramento</CardTitle>
              <CardDescription>
                Configure o comportamento do monitoramento automático
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-refresh</p>
                  <p className="text-sm text-muted-foreground">
                    Verificar status automaticamente
                  </p>
                </div>
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  {autoRefresh ? 'Ativado' : 'Desativado'}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Intervalo de verificação (segundos)</Label>
                <div className="flex gap-2">
                  {[30, 60, 120, 300].map((interval) => (
                    <Button
                      key={interval}
                      variant={refreshInterval === interval ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRefreshInterval(interval)}
                    >
                      {interval}s
                    </Button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Credenciais Configuradas</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Z_API_INSTANCE_ID</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Z_API_TOKEN</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  As credenciais são gerenciadas via secrets do projeto.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ZApiStatus;
