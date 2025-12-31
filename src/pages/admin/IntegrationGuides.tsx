import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CreditCard, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle,
  Copy,
  BookOpen,
  Settings,
  Key,
  Webhook,
  Globe,
  Shield,
  DollarSign,
  Users,
  Zap,
  Bot,
  Calendar,
  Clock,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function IntegrationGuides() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            Guias de Integração
          </h1>
          <p className="text-muted-foreground mt-1">
            Documentação completa e passo a passo para configurar integrações externas
          </p>
        </div>

        {/* Tabs for different integrations */}
        <Tabs defaultValue="stripe" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="stripe" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Stripe
            </TabsTrigger>
            <TabsTrigger value="ai-assistant" className="gap-2">
              <Bot className="h-4 w-4" />
              Assistente IA
            </TabsTrigger>
          </TabsList>

          {/* STRIPE GUIDE */}
          <TabsContent value="stripe" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-6 w-6 text-[#635BFF]" />
                      Integração com Stripe
                    </CardTitle>
                    <CardDescription>
                      Plataforma de pagamentos para cobranças recorrentes e avulsas
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-[#635BFF]/10 text-[#635BFF] border-[#635BFF]/30">
                    Pagamentos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Overview */}
                <Alert>
                  <Zap className="h-4 w-4" />
                  <AlertTitle>O que é o Stripe?</AlertTitle>
                  <AlertDescription>
                    O Stripe é uma plataforma de pagamentos online que permite aceitar cartões de crédito, 
                    débito e outras formas de pagamento. É usado no Salão Cloud para gerenciar assinaturas 
                    dos estabelecimentos.
                  </AlertDescription>
                </Alert>

                <Accordion type="single" collapsible className="w-full">
                  {/* Step 1 */}
                  <AccordionItem value="step1">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                        <span>Criar conta no Stripe</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Primeiro, você precisa criar uma conta no Stripe:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Acesse <a href="https://stripe.com" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">stripe.com <ExternalLink className="h-3 w-3" /></a></li>
                          <li>Clique em <strong>"Começar agora"</strong> ou <strong>"Start now"</strong></li>
                          <li>Preencha seu email e crie uma senha</li>
                          <li>Confirme seu email clicando no link enviado</li>
                          <li>Complete o cadastro da sua empresa (nome, CNPJ, endereço)</li>
                          <li>Adicione uma conta bancária para receber os pagamentos</li>
                        </ol>
                        <Alert variant="default" className="bg-amber-50 border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800">
                            <strong>Importante:</strong> Use dados reais da empresa. O Stripe verifica as informações 
                            para liberar pagamentos reais.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 2 */}
                  <AccordionItem value="step2">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                        <span>Obter as chaves de API</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Após criar a conta, você precisa obter as chaves de API:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>No painel do Stripe, vá em <strong>"Developers"</strong> (Desenvolvedores) no menu lateral</li>
                          <li>Clique em <strong>"API keys"</strong> (Chaves de API)</li>
                          <li>Você verá duas chaves:
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                              <li><strong>Publishable key</strong> (pk_live_...): Usada no frontend, pode ser pública</li>
                              <li><strong>Secret key</strong> (sk_live_...): Usada no backend, NUNCA compartilhe!</li>
                            </ul>
                          </li>
                        </ol>
                        <div className="bg-muted p-4 rounded-lg space-y-2">
                          <p className="text-sm font-medium">Exemplo de chaves (modo teste):</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-background px-2 py-1 rounded flex-1">pk_test_51ABC123...</code>
                            <Button variant="outline" size="sm" onClick={() => copyToClipboard("pk_test_51ABC123...")}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-background px-2 py-1 rounded flex-1">sk_test_51ABC123...</code>
                            <Button variant="outline" size="sm" onClick={() => copyToClipboard("sk_test_51ABC123...")}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <Alert>
                          <Key className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Modo Teste vs Produção:</strong> Chaves que começam com <code>pk_test_</code> e <code>sk_test_</code> 
                            são de teste. Para produção, use <code>pk_live_</code> e <code>sk_live_</code>.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 3 */}
                  <AccordionItem value="step3">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                        <span>Criar produtos e preços</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Crie os planos de assinatura no Stripe:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>No painel, vá em <strong>"Products"</strong> (Produtos)</li>
                          <li>Clique em <strong>"+ Add product"</strong></li>
                          <li>Preencha:
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                              <li><strong>Name:</strong> Nome do plano (ex: "Plano Básico")</li>
                              <li><strong>Description:</strong> Descrição do que está incluso</li>
                            </ul>
                          </li>
                          <li>Em <strong>"Pricing"</strong>, configure:
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                              <li><strong>Pricing model:</strong> Standard pricing</li>
                              <li><strong>Price:</strong> Valor mensal (ex: R$ 49,90)</li>
                              <li><strong>Billing period:</strong> Monthly (mensal) ou Yearly (anual)</li>
                            </ul>
                          </li>
                          <li>Clique em <strong>"Save product"</strong></li>
                        </ol>
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm font-medium mb-2">Exemplo de estrutura de planos:</p>
                          <div className="grid gap-2 text-sm">
                            <div className="flex justify-between items-center p-2 bg-background rounded">
                              <span>Plano Básico</span>
                              <Badge>R$ 49,90/mês</Badge>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-background rounded">
                              <span>Plano Profissional</span>
                              <Badge>R$ 99,90/mês</Badge>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-background rounded">
                              <span>Plano Premium</span>
                              <Badge>R$ 199,90/mês</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 4 */}
                  <AccordionItem value="step4">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">4</span>
                        <span>Configurar Webhooks</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Webhooks permitem que o Stripe notifique o sistema quando eventos ocorrem (pagamento confirmado, assinatura cancelada, etc.):
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Vá em <strong>"Developers" → "Webhooks"</strong></li>
                          <li>Clique em <strong>"+ Add endpoint"</strong></li>
                          <li>Em <strong>"Endpoint URL"</strong>, insira:
                            <div className="bg-muted p-2 rounded mt-2 flex items-center gap-2">
                              <code className="text-xs flex-1">https://seu-projeto.supabase.co/functions/v1/stripe-webhook</code>
                              <Button variant="outline" size="sm" onClick={() => copyToClipboard("https://seu-projeto.supabase.co/functions/v1/stripe-webhook")}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </li>
                          <li>Selecione os eventos para escutar:
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-muted-foreground">
                              <li>checkout.session.completed</li>
                              <li>customer.subscription.created</li>
                              <li>customer.subscription.updated</li>
                              <li>customer.subscription.deleted</li>
                              <li>invoice.payment_succeeded</li>
                              <li>invoice.payment_failed</li>
                            </ul>
                          </li>
                          <li>Copie o <strong>"Signing secret"</strong> (whsec_...) após criar</li>
                        </ol>
                        <Alert>
                          <Webhook className="h-4 w-4" />
                          <AlertDescription>
                            O <strong>Signing secret</strong> é usado para verificar que as requisições 
                            realmente vêm do Stripe. Guarde-o com segurança!
                          </AlertDescription>
                        </Alert>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 5 */}
                  <AccordionItem value="step5">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">5</span>
                        <span>Configurar Portal do Cliente</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          O Portal do Cliente permite que usuários gerenciem suas assinaturas:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Vá em <strong>"Settings" → "Billing" → "Customer portal"</strong></li>
                          <li>Ative o portal clicando em <strong>"Activate test link"</strong> ou <strong>"Activate link"</strong></li>
                          <li>Configure as opções:
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-muted-foreground">
                              <li>✅ Permitir cancelamento de assinatura</li>
                              <li>✅ Permitir atualização de método de pagamento</li>
                              <li>✅ Permitir visualização de faturas</li>
                              <li>✅ Permitir troca de plano (upgrade/downgrade)</li>
                            </ul>
                          </li>
                          <li>Personalize a aparência com sua logo e cores</li>
                          <li>Salve as configurações</li>
                        </ol>
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                              <p className="font-medium text-green-800">Pronto!</p>
                              <p className="text-sm text-green-700">
                                Seus clientes agora podem gerenciar suas assinaturas de forma autônoma.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 6 */}
                  <AccordionItem value="step6">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">6</span>
                        <span>Sincronizar com o Salão Cloud</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Após configurar o Stripe, sincronize com o Salão Cloud:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Vá para <strong>Admin → Stripe</strong> no painel do Salão Cloud</li>
                          <li>Os planos criados aqui serão sincronizados automaticamente</li>
                          <li>Use o botão <strong>"Sincronizar com Stripe"</strong> para:
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-muted-foreground">
                              <li>Criar produtos no Stripe baseado nos planos locais</li>
                              <li>Atualizar preços quando necessário</li>
                              <li>Manter tudo sincronizado</li>
                            </ul>
                          </li>
                        </ol>
                        <Alert>
                          <Settings className="h-4 w-4" />
                          <AlertDescription>
                            A sincronização cria automaticamente os <code>stripe_product_id</code> e <code>stripe_price_id</code> 
                            necessários para o checkout funcionar.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Quick Reference */}
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Referência Rápida</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Globe className="h-4 w-4 text-primary" />
                          Links Úteis
                        </h4>
                        <ul className="text-sm space-y-1">
                          <li>
                            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                              Dashboard do Stripe <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                          <li>
                            <a href="https://stripe.com/docs" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                              Documentação Oficial <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                          <li>
                            <a href="https://stripe.com/docs/testing" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                              Cartões de Teste <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-primary" />
                          Cartão de Teste
                        </h4>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Número:</span>
                            <code className="bg-background px-2 py-0.5 rounded">4242 4242 4242 4242</code>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Validade:</span>
                            <code className="bg-background px-2 py-0.5 rounded">Qualquer data futura</code>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">CVC:</span>
                            <code className="bg-background px-2 py-0.5 rounded">Qualquer 3 dígitos</code>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>


          {/* AI ASSISTANT GUIDE */}
          <TabsContent value="ai-assistant" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-6 w-6 text-purple-600" />
                      Assistente Virtual IA
                    </CardTitle>
                    <CardDescription>
                      Atendimento automatizado 24h no portal com agendamento inteligente
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                    IA
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Overview */}
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertTitle>O que é a Assistente Virtual?</AlertTitle>
                  <AlertDescription>
                    A Assistente Virtual é uma IA que atende seus clientes automaticamente no portal de agendamentos. 
                    Ela pode agendar serviços, responder dúvidas sobre preços, horários e promoções, 
                    e até gerenciar fila de espera quando não há horários disponíveis.
                  </AlertDescription>
                </Alert>

                <Accordion type="single" collapsible className="w-full">
                  {/* Step 1 */}
                  <AccordionItem value="step1">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white text-sm font-bold">1</span>
                        <span>Pré-requisitos</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Antes de configurar a assistente, certifique-se de que:
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 p-3 border rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                              <p className="font-medium text-sm">Serviços Cadastrados</p>
                              <p className="text-xs text-muted-foreground">
                                O estabelecimento deve ter serviços com preços e duração configurados
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-3 border rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                              <p className="font-medium text-sm">Profissionais Cadastrados</p>
                              <p className="text-xs text-muted-foreground">
                                Pelo menos um profissional ativo para realizar os agendamentos
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-3 border rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                              <p className="font-medium text-sm">Horário de Funcionamento</p>
                              <p className="text-xs text-muted-foreground">
                                Horários de funcionamento configurados em "Configurações"
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 2 */}
                  <AccordionItem value="step2">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white text-sm font-bold">2</span>
                        <span>Acessar configurações da Assistente</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Acesse o painel de configuração da assistente:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>No menu lateral do Portal, clique em <strong>"Assistente IA"</strong></li>
                          <li>Ou acesse diretamente: <code>/portal/seu-slug/assistente-ia</code></li>
                        </ol>
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm font-medium mb-2">Abas disponíveis:</p>
                          <div className="grid gap-2 text-sm">
                            <div className="flex items-center gap-2 p-2 bg-background rounded">
                              <Settings className="h-4 w-4 text-purple-600" />
                              <span><strong>Configuração</strong> - Personalizar nome, estilo e comportamento</span>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-background rounded">
                              <Calendar className="h-4 w-4 text-purple-600" />
                              <span><strong>Horários</strong> - Definir quando a assistente atende</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 3 */}
                  <AccordionItem value="step3">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white text-sm font-bold">3</span>
                        <span>Personalizar a Assistente</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Configure a personalidade da sua assistente:
                        </p>
                        <div className="space-y-4">
                          <div className="p-3 border rounded-lg">
                            <label className="text-sm font-medium">Nome da Assistente</label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Dê um nome humanizado (ex: "Ana", "Lia", "Sofia"). A IA se apresentará com esse nome.
                            </p>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <label className="text-sm font-medium">Estilo de Comunicação</label>
                            <div className="grid gap-2 mt-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Badge variant="outline">Casual</Badge>
                                <span className="text-muted-foreground">Usa emojis, linguagem amigável</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Badge variant="outline">Formal</Badge>
                                <span className="text-muted-foreground">Linguagem profissional, sem emojis</span>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <label className="text-sm font-medium">Mensagem de Boas-Vindas</label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Primeira mensagem que o cliente recebe ao iniciar conversa.
                            </p>
                            <div className="bg-muted p-2 rounded mt-2 text-sm">
                              Exemplo: "Olá! Sou a Ana, assistente virtual do Salão Beleza. Como posso ajudar? 💇‍♀️"
                            </div>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <label className="text-sm font-medium">Instruções Personalizadas</label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Regras específicas do seu negócio que a IA deve seguir.
                            </p>
                            <div className="bg-muted p-2 rounded mt-2 text-sm">
                              Exemplo: "Sempre mencione que temos estacionamento gratuito. Não aceite agendamentos com menos de 2h de antecedência."
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 4 */}
                  <AccordionItem value="step4">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white text-sm font-bold">4</span>
                        <span>Configurar Horários de Atendimento</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Defina quando a assistente deve atender:
                        </p>
                        <div className="space-y-4">
                          <div className="p-3 border rounded-lg">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Modo de Disponibilidade
                            </label>
                            <div className="grid gap-2 mt-2">
                              <div className="flex items-start gap-2 p-2 bg-muted rounded">
                                <Badge className="bg-green-500">24h</Badge>
                                <div>
                                  <p className="text-sm font-medium">Atende 24 horas</p>
                                  <p className="text-xs text-muted-foreground">
                                    A IA responde a qualquer hora, mas avisa quando está fora do expediente
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2 p-2 bg-muted rounded">
                                <Badge variant="outline">Horário Comercial</Badge>
                                <div>
                                  <p className="text-sm font-medium">Apenas no expediente</p>
                                  <p className="text-xs text-muted-foreground">
                                    Fora do horário, envia mensagem automática de "fora do ar"
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <label className="text-sm font-medium">Mensagem Fora do Horário</label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Mensagem enviada quando cliente tenta contato fora do expediente.
                            </p>
                            <div className="bg-muted p-2 rounded mt-2 text-sm">
                              Exemplo: "Olá! Estamos fora do horário de atendimento. Retornaremos amanhã às 9h. 🌙"
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 5 */}
                  <AccordionItem value="step5">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white text-sm font-bold">5</span>
                        <span>Ativar a Assistente</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Para ativar o atendimento automático:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Na aba <strong>"Configuração"</strong>, ative o switch <strong>"Assistente Habilitada"</strong></li>
                          <li>Salve as configurações</li>
                          <li>A assistente começará a responder automaticamente no WhatsApp</li>
                        </ol>
                        <Alert variant="default" className="bg-amber-50 border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800">
                            <strong>Importante:</strong> O cliente deve ser reconhecido pelo sistema (ter agendamento anterior ou estar cadastrado) 
                            para que a assistente saiba qual estabelecimento atender.
                          </AlertDescription>
                        </Alert>
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                              <p className="font-medium text-green-800">Pronto!</p>
                              <p className="text-sm text-green-700">
                                Sua assistente virtual está ativa e pronta para atender clientes 24h!
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 6 */}
                  <AccordionItem value="step6">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white text-sm font-bold">6</span>
                        <span>Monitorar Conversas</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Acompanhe o desempenho da assistente:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Acesse <strong>"Conversas IA"</strong> no menu lateral</li>
                          <li>Veja estatísticas de atendimento:
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-muted-foreground">
                              <li>Total de conversas</li>
                              <li>Conversas ativas</li>
                              <li>Taxa de resolução</li>
                              <li>Agendamentos feitos pela IA</li>
                            </ul>
                          </li>
                          <li>Filtre por status: Ativas, Finalizadas, Escaladas</li>
                          <li>Clique em uma conversa para ver o histórico completo</li>
                        </ol>
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm font-medium mb-2">Status das conversas:</p>
                          <div className="grid gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-500">Ativa</Badge>
                              <span className="text-muted-foreground">Conversa em andamento</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">Fechada</Badge>
                              <span className="text-muted-foreground">Conversa finalizada</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-amber-500">Escalada</Badge>
                              <span className="text-muted-foreground">Precisa de atendimento humano</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Capabilities */}
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      O que a Assistente pode fazer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-background">
                        <Calendar className="h-5 w-5 text-purple-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Agendar Serviços</p>
                          <p className="text-xs text-muted-foreground">
                            Coleta dados do cliente, verifica disponibilidade e cria agendamentos automaticamente
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-background">
                        <Clock className="h-5 w-5 text-purple-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Gerenciar Fila de Espera</p>
                          <p className="text-xs text-muted-foreground">
                            Adiciona clientes à lista de espera quando não há horário disponível
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-background">
                        <DollarSign className="h-5 w-5 text-purple-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Informar Preços</p>
                          <p className="text-xs text-muted-foreground">
                            Responde sobre valores, duração e descrição dos serviços
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-background">
                        <Zap className="h-5 w-5 text-purple-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Divulgar Promoções</p>
                          <p className="text-xs text-muted-foreground">
                            Informa automaticamente sobre promoções ativas do estabelecimento
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-background">
                        <Users className="h-5 w-5 text-purple-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Apresentar Profissionais</p>
                          <p className="text-xs text-muted-foreground">
                            Mostra os profissionais disponíveis e suas especialidades
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-background">
                        <Users className="h-5 w-5 text-purple-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Escalar para Humano</p>
                          <p className="text-xs text-muted-foreground">
                            Transfere para atendimento humano quando necessário
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pricing */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Modelo de Cobrança
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Alert>
                        <Sparkles className="h-4 w-4" />
                        <AlertDescription>
                          A Assistente Virtual é um <strong>addon opcional</strong> com período de teste gratuito.
                        </AlertDescription>
                      </Alert>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="p-4 border rounded-lg">
                          <Badge variant="outline" className="mb-2">Período de Teste</Badge>
                          <p className="text-2xl font-bold">200 mensagens</p>
                          <p className="text-sm text-muted-foreground">
                            Teste gratuito para experimentar a funcionalidade
                          </p>
                        </div>
                        <div className="p-4 border rounded-lg bg-purple-50">
                          <Badge className="bg-purple-600 mb-2">Assinatura</Badge>
                          <p className="text-2xl font-bold">R$ 49,90/mês</p>
                          <p className="text-sm text-muted-foreground">
                            Mensagens ilimitadas após o período de teste
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
