import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Bot, 
  Settings, 
  MessageSquare, 
  Clock, 
  Sparkles, 
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Phone,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerEstablishment } from "@/hooks/useOwnerEstablishment";

interface WorkingHours {
  [key: string]: {
    start: string;
    end: string;
    enabled: boolean;
  };
}

interface AIAssistantConfig {
  id?: string;
  is_enabled: boolean;
  assistant_name: string;
  language_style: 'casual' | 'formal';
  availability_mode: 'only_business_hours' | '24h_with_message';
  working_hours: WorkingHours;
  welcome_message: string;
  offline_message: string;
  escalation_whatsapp: string;
  custom_instructions: string;
}

interface AISubscription {
  status: 'trial' | 'active' | 'cancelled' | 'past_due';
  trial_messages_used: number;
}

interface UsageStats {
  total_conversations: number;
  total_messages: number;
  escalated_count: number;
}

const DAYS = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_CONFIG: AIAssistantConfig = {
  is_enabled: false,
  assistant_name: 'Silvia',
  language_style: 'casual',
  availability_mode: '24h_with_message',
  working_hours: {
    monday: { start: '09:00', end: '18:00', enabled: true },
    tuesday: { start: '09:00', end: '18:00', enabled: true },
    wednesday: { start: '09:00', end: '18:00', enabled: true },
    thursday: { start: '09:00', end: '18:00', enabled: true },
    friday: { start: '09:00', end: '18:00', enabled: true },
    saturday: { start: '09:00', end: '13:00', enabled: true },
    sunday: { start: '09:00', end: '13:00', enabled: false },
  },
  welcome_message: '',
  offline_message: 'Olá! No momento estou fora do horário de atendimento. Deixe sua mensagem e entrarei em contato assim que possível.',
  escalation_whatsapp: '',
  custom_instructions: '',
};

export default function AIAssistant() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { guard, establishmentId: ownerEstId } = useOwnerEstablishment(slug);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<AIAssistantConfig>(DEFAULT_CONFIG);
  const [subscription, setSubscription] = useState<AISubscription | null>(null);
  const [addonInfo, setAddonInfo] = useState<{ price_monthly: number; trial_message_limit: number } | null>(null);
  const [stats, setStats] = useState<UsageStats>({ total_conversations: 0, total_messages: 0, escalated_count: 0 });
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Get establishment
        const { data: establishment } = await supabase
          .from('establishments')
          .select('id')
          .eq('slug', slug)
          .single();

        if (!establishment) return;
        setEstablishmentId(establishment.id);

        // Get addon info
        const { data: addon } = await supabase
          .from('platform_ai_addon')
          .select('price_monthly, trial_message_limit')
          .single();

        if (addon) setAddonInfo(addon);

        // Get AI config
        const { data: aiConfig } = await supabase
          .from('establishment_ai_assistant')
          .select('*')
          .eq('establishment_id', establishment.id)
          .single();

        if (aiConfig) {
          setConfig({
            id: aiConfig.id,
            is_enabled: aiConfig.is_enabled,
            assistant_name: aiConfig.assistant_name,
            language_style: aiConfig.language_style as 'casual' | 'formal',
            availability_mode: aiConfig.availability_mode as 'only_business_hours' | '24h_with_message',
            working_hours: (aiConfig.working_hours as WorkingHours) || DEFAULT_CONFIG.working_hours,
            welcome_message: aiConfig.welcome_message || '',
            offline_message: aiConfig.offline_message || DEFAULT_CONFIG.offline_message,
            escalation_whatsapp: aiConfig.escalation_whatsapp || '',
            custom_instructions: aiConfig.custom_instructions || '',
          });
        }

        // Get subscription
        const { data: sub } = await supabase
          .from('establishment_ai_subscriptions')
          .select('status, trial_messages_used')
          .eq('establishment_id', establishment.id)
          .single();

        if (sub) {
          setSubscription({
            status: sub.status as AISubscription['status'],
            trial_messages_used: sub.trial_messages_used,
          });
        }

        // Get stats
        const { count: totalConversations } = await supabase
          .from('ai_assistant_conversations')
          .select('*', { count: 'exact', head: true })
          .eq('establishment_id', establishment.id);

        const { count: totalMessages } = await supabase
          .from('ai_assistant_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', establishment.id); // This needs proper join

        const { count: escalatedCount } = await supabase
          .from('ai_assistant_conversations')
          .select('*', { count: 'exact', head: true })
          .eq('establishment_id', establishment.id)
          .eq('status', 'escalated');

        setStats({
          total_conversations: totalConversations || 0,
          total_messages: totalMessages || 0,
          escalated_count: escalatedCount || 0,
        });

      } catch (error) {
        console.error('Error fetching AI config:', error);
        toast.error('Erro ao carregar configurações');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, slug]);

  const handleSave = async () => {
    if (!establishmentId) return;

    setIsSaving(true);

    try {
      const dataToSave = {
        establishment_id: establishmentId,
        is_enabled: config.is_enabled,
        assistant_name: config.assistant_name,
        language_style: config.language_style,
        availability_mode: config.availability_mode,
        working_hours: config.working_hours,
        welcome_message: config.welcome_message || null,
        offline_message: config.offline_message,
        escalation_whatsapp: config.escalation_whatsapp || null,
        custom_instructions: config.custom_instructions || null,
      };

      if (config.id) {
        const { error } = await supabase
          .from('establishment_ai_assistant')
          .update(dataToSave)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('establishment_ai_assistant')
          .insert(dataToSave)
          .select()
          .single();

        if (error) throw error;
        setConfig(prev => ({ ...prev, id: data.id }));
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const updateWorkingHours = (day: string, field: 'start' | 'end' | 'enabled', value: string | boolean) => {
    setConfig(prev => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [day]: {
          ...prev.working_hours[day],
          [field]: value,
        },
      },
    }));
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  const trialLimit = addonInfo?.trial_message_limit || 200;
  const trialUsed = subscription?.trial_messages_used || 0;
  const trialRemaining = Math.max(0, trialLimit - trialUsed);
  const trialPercentage = (trialUsed / trialLimit) * 100;

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-7 w-7 text-primary" />
              Assistente Virtual IA
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure sua assistente virtual para atendimento automático
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={config.is_enabled}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, is_enabled: checked }))}
              />
              <span className="text-sm font-medium">
                {config.is_enabled ? 'Ativa' : 'Inativa'}
              </span>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {subscription?.status === 'active' ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="font-semibold text-green-600">Ativo</span>
                      </>
                    ) : subscription?.status === 'trial' ? (
                      <>
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-amber-600">Teste Grátis</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-gray-500" />
                        <span className="font-semibold text-gray-600">Não configurado</span>
                      </>
                    )}
                  </div>
                </div>
                {addonInfo && (
                  <Badge variant="outline" className="text-xs">
                    R$ {addonInfo.price_monthly.toFixed(2)}/mês
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Mensagens Restantes (Trial)</p>
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-semibold">{trialRemaining} restantes</span>
                  <span className="text-muted-foreground">{trialUsed}/{trialLimit}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all" 
                    style={{ width: `${Math.min(100, trialPercentage)}%` }} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Conversas</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total_conversations}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Escaladas</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.escalated_count}</p>
            </CardContent>
          </Card>
        </div>


        {/* Configuration Tabs */}
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-2" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="h-4 w-4 mr-2" />
              Mensagens
            </TabsTrigger>
            <TabsTrigger value="schedule">
              <Clock className="h-4 w-4 mr-2" />
              Horários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
                <CardDescription>
                  Personalize a identidade e comportamento da sua assistente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="language_style">Estilo de Linguagem</Label>
                    <Select
                      value={config.language_style}
                      onValueChange={(value: 'casual' | 'formal') => 
                        setConfig(prev => ({ ...prev, language_style: value }))
                      }
                    >
                      <SelectTrigger id="language_style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="casual">Casual e amigável</SelectItem>
                        <SelectItem value="formal">Formal e profissional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="availability_mode">Modo de Disponibilidade</Label>
                    <Select
                      value={config.availability_mode}
                      onValueChange={(value: 'only_business_hours' | '24h_with_message') =>
                        setConfig(prev => ({ ...prev, availability_mode: value }))
                      }
                    >
                      <SelectTrigger id="availability_mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h_with_message">24h (com mensagem de ausência)</SelectItem>
                        <SelectItem value="only_business_hours">Apenas no horário comercial</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Define se o chat ficará disponível fora do expediente
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="escalation_whatsapp">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        WhatsApp para Escalação
                      </div>
                    </Label>
                    <Input
                      id="escalation_whatsapp"
                      value={config.escalation_whatsapp}
                      onChange={(e) => setConfig(prev => ({ ...prev, escalation_whatsapp: e.target.value }))}
                      placeholder="Ex: 5511999999999"
                    />
                    <p className="text-xs text-muted-foreground">
                      Número para receber notificações quando a IA não conseguir resolver
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="custom_instructions">Instruções Personalizadas</Label>
                  <Textarea
                    id="custom_instructions"
                    value={config.custom_instructions}
                    onChange={(e) => setConfig(prev => ({ ...prev, custom_instructions: e.target.value }))}
                    placeholder="Adicione instruções específicas para a assistente. Ex: 'Sempre ofereça o serviço de hidratação para clientes que perguntarem sobre corte de cabelo.'"
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Regras e comportamentos específicos para o seu negócio
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Mensagens Automáticas</CardTitle>
                <CardDescription>
                  Configure as mensagens que a assistente enviará
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="welcome_message">Mensagem de Boas-vindas</Label>
                  <Textarea
                    id="welcome_message"
                    value={config.welcome_message}
                    onChange={(e) => setConfig(prev => ({ ...prev, welcome_message: e.target.value }))}
                    placeholder="Deixe em branco para usar a mensagem padrão"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Primeira mensagem enviada quando o cliente inicia uma conversa
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offline_message">Mensagem de Ausência</Label>
                  <Textarea
                    id="offline_message"
                    value={config.offline_message}
                    onChange={(e) => setConfig(prev => ({ ...prev, offline_message: e.target.value }))}
                    placeholder="Mensagem exibida fora do horário de atendimento"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Exibida quando o chat está fora do horário configurado (modo 24h)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Horário de Atendimento</CardTitle>
                <CardDescription>
                  Configure os horários em que a assistente estará "online"
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {DAYS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-4 py-2 border-b last:border-0">
                      <div className="w-32 flex items-center gap-2">
                        <Switch
                          checked={config.working_hours[key]?.enabled}
                          onCheckedChange={(checked) => updateWorkingHours(key, 'enabled', checked)}
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={config.working_hours[key]?.start || '09:00'}
                          onChange={(e) => updateWorkingHours(key, 'start', e.target.value)}
                          disabled={!config.working_hours[key]?.enabled}
                          className="w-28"
                        />
                        <span className="text-muted-foreground">até</span>
                        <Input
                          type="time"
                          value={config.working_hours[key]?.end || '18:00'}
                          onChange={(e) => updateWorkingHours(key, 'end', e.target.value)}
                          disabled={!config.working_hours[key]?.enabled}
                          className="w-28"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </PortalLayout>
  );
}
