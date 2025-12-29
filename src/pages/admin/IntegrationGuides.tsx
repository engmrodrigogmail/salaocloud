import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CreditCard, 
  MessageCircle, 
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
  Smartphone,
  DollarSign,
  Users,
  Zap
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
            <TabsTrigger value="zapi" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Z-API (WhatsApp)
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

          {/* Z-API GUIDE */}
          <TabsContent value="zapi" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-6 w-6 text-[#25D366]" />
                      Integração com Z-API
                    </CardTitle>
                    <CardDescription>
                      API para envio de mensagens e notificações via WhatsApp
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30">
                    WhatsApp
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Overview */}
                <Alert>
                  <Smartphone className="h-4 w-4" />
                  <AlertTitle>O que é a Z-API?</AlertTitle>
                  <AlertDescription>
                    A Z-API é uma plataforma brasileira que permite enviar e receber mensagens do WhatsApp 
                    de forma automatizada. É ideal para enviar lembretes de agendamentos, confirmações e 
                    notificações aos clientes.
                  </AlertDescription>
                </Alert>

                <Accordion type="single" collapsible className="w-full">
                  {/* Step 1 */}
                  <AccordionItem value="step1">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366] text-white text-sm font-bold">1</span>
                        <span>Criar conta na Z-API</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Primeiro, crie uma conta na plataforma Z-API:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Acesse <a href="https://z-api.io" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">z-api.io <ExternalLink className="h-3 w-3" /></a></li>
                          <li>Clique em <strong>"Criar conta grátis"</strong></li>
                          <li>Preencha seus dados (nome, email, telefone)</li>
                          <li>Confirme seu email</li>
                          <li>Acesse o painel de controle</li>
                        </ol>
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm font-medium mb-2">Planos disponíveis:</p>
                          <div className="grid gap-2 text-sm">
                            <div className="flex justify-between items-center p-2 bg-background rounded">
                              <span>Gratuito</span>
                              <Badge variant="outline">20 msg/dia</Badge>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-background rounded">
                              <span>Start</span>
                              <Badge>R$ 59,90/mês</Badge>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-background rounded">
                              <span>Pro</span>
                              <Badge>R$ 129,90/mês</Badge>
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
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366] text-white text-sm font-bold">2</span>
                        <span>Criar uma instância</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Uma instância é a "conexão" entre seu WhatsApp e a API:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>No painel, clique em <strong>"Criar Instância"</strong></li>
                          <li>Dê um nome para sua instância (ex: "SalaoCloud")</li>
                          <li>Escolha o tipo: <strong>"WhatsApp Padrão"</strong></li>
                          <li>Clique em <strong>"Criar"</strong></li>
                          <li>Você receberá:
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-muted-foreground">
                              <li><strong>Instance ID:</strong> Identificador único da instância</li>
                              <li><strong>Token:</strong> Chave de autenticação</li>
                              <li><strong>Client Token:</strong> Token do cliente</li>
                            </ul>
                          </li>
                        </ol>
                        <Alert variant="default" className="bg-amber-50 border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800">
                            <strong>Guarde essas informações!</strong> Você precisará delas para configurar 
                            a integração no Salão Cloud.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 3 */}
                  <AccordionItem value="step3">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366] text-white text-sm font-bold">3</span>
                        <span>Conectar o WhatsApp</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Agora você precisa vincular seu número de WhatsApp à instância:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Na sua instância, clique em <strong>"Conectar"</strong></li>
                          <li>Um QR Code será exibido na tela</li>
                          <li>No seu celular:
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-muted-foreground">
                              <li>Abra o WhatsApp</li>
                              <li>Vá em <strong>"Configurações" → "Aparelhos conectados"</strong></li>
                              <li>Toque em <strong>"Conectar um aparelho"</strong></li>
                              <li>Escaneie o QR Code mostrado na Z-API</li>
                            </ul>
                          </li>
                          <li>Aguarde a conexão ser estabelecida</li>
                          <li>O status mudará para <strong>"Conectado"</strong> (verde)</li>
                        </ol>
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                              <p className="font-medium text-green-800">Conexão Estabelecida!</p>
                              <p className="text-sm text-green-700">
                                Seu WhatsApp agora pode enviar mensagens automaticamente.
                              </p>
                            </div>
                          </div>
                        </div>
                        <Alert>
                          <Shield className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Dica:</strong> Use um chip dedicado para o WhatsApp Business do salão. 
                            Evite usar seu número pessoal.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 4 */}
                  <AccordionItem value="step4">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366] text-white text-sm font-bold">4</span>
                        <span>Copiar credenciais da API</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Copie as credenciais para usar na integração:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Na sua instância, vá em <strong>"Configurações"</strong> ou <strong>"Credenciais"</strong></li>
                          <li>Copie as seguintes informações:</li>
                        </ol>
                        <div className="bg-muted p-4 rounded-lg space-y-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Instance ID</label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-xs bg-background px-2 py-1 rounded flex-1">3C5A7B9D2E1F...</code>
                              <Button variant="outline" size="sm" onClick={() => copyToClipboard("3C5A7B9D2E1F...")}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Token</label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-xs bg-background px-2 py-1 rounded flex-1">A1B2C3D4E5F6G7H8...</code>
                              <Button variant="outline" size="sm" onClick={() => copyToClipboard("A1B2C3D4E5F6G7H8...")}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Client Token (opcional)</label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-xs bg-background px-2 py-1 rounded flex-1">X9Y8Z7W6V5U4...</code>
                              <Button variant="outline" size="sm" onClick={() => copyToClipboard("X9Y8Z7W6V5U4...")}>
                                <Copy className="h-3 w-3" />
                              </Button>
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
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366] text-white text-sm font-bold">5</span>
                        <span>Testar o envio de mensagens</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Antes de integrar, teste se o envio está funcionando:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Na Z-API, vá em <strong>"Testar API"</strong> ou use a documentação</li>
                          <li>Escolha <strong>"Enviar Texto"</strong></li>
                          <li>Preencha:
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                              <li><strong>Número:</strong> Seu número (para teste)</li>
                              <li><strong>Mensagem:</strong> "Teste de integração"</li>
                            </ul>
                          </li>
                          <li>Clique em <strong>"Enviar"</strong></li>
                          <li>Verifique se recebeu a mensagem no WhatsApp</li>
                        </ol>
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm font-medium mb-2">Exemplo de requisição:</p>
                          <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`POST https://api.z-api.io/instances/{instanceId}/token/{token}/send-text

{
  "phone": "5511999999999",
  "message": "Olá! Este é um teste."
}`}
                          </pre>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 6 */}
                  <AccordionItem value="step6">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366] text-white text-sm font-bold">6</span>
                        <span>Configurar Webhook para Lembretes Automáticos</span>
                        <Badge className="ml-2 bg-red-500">IMPORTANTE</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <Alert variant="default" className="bg-amber-50 border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800">
                            <strong>Esta etapa é obrigatória</strong> para que os clientes possam confirmar ou cancelar 
                            agendamentos via WhatsApp. Sem ela, os botões de resposta não funcionarão.
                          </AlertDescription>
                        </Alert>
                        
                        <p className="text-sm text-muted-foreground">
                          Configure o webhook para receber as respostas dos clientes quando clicarem nos botões de confirmação:
                        </p>
                        
                        <ol className="list-decimal list-inside space-y-3 text-sm">
                          <li>No painel da Z-API, acesse sua instância</li>
                          <li>Vá em <strong>"Webhooks"</strong> ou <strong>"Configurações" → "Webhooks"</strong></li>
                          <li>
                            <strong>Configure a URL do webhook:</strong>
                            <div className="bg-muted p-3 rounded mt-2 space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">URL do Webhook (copie exatamente):</label>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-background px-3 py-2 rounded flex-1 break-all">
                                  https://gdjlajktmjskhpugzinh.supabase.co/functions/v1/zapi-webhook
                                </code>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => copyToClipboard("https://gdjlajktmjskhpugzinh.supabase.co/functions/v1/zapi-webhook")}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </li>
                          <li>
                            <strong>Selecione os eventos a receber:</strong>
                            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                              <li className="text-muted-foreground">✅ <code>on-button-response-message</code> - Resposta de botões (OBRIGATÓRIO)</li>
                              <li className="text-muted-foreground">✅ <code>on-message-received</code> - Mensagens recebidas</li>
                              <li className="text-muted-foreground">⚡ <code>on-connection-update</code> - Status da conexão (opcional)</li>
                            </ul>
                          </li>
                          <li>Clique em <strong>"Salvar"</strong> ou <strong>"Atualizar"</strong></li>
                          <li>
                            <strong>Teste a configuração:</strong>
                            <p className="text-muted-foreground mt-1">
                              Envie uma mensagem de teste com botões pelo painel de Status Z-API e verifique se a resposta é processada.
                            </p>
                          </li>
                        </ol>

                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg mt-4">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                              <p className="font-medium text-green-800">Como funciona o sistema de lembretes:</p>
                              <ul className="text-sm text-green-700 mt-2 space-y-1">
                                <li>• <strong>24h antes:</strong> Cliente recebe lembrete com botões de confirmação</li>
                                <li>• <strong>1h antes:</strong> Segundo lembrete para quem não respondeu</li>
                                <li>• <strong>"Com certeza estarei aí":</strong> Agendamento marcado como confirmado (luz verde)</li>
                                <li>• <strong>"Não conseguirei ir":</strong> Agendamento cancelado automaticamente, horário liberado</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm font-medium mb-2">Exemplo de payload recebido:</p>
                          <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`{
  "phone": "5511999999999",
  "buttonPayload": "confirm_abc123-def456",
  "buttonText": "Com certeza estarei aí",
  "messageId": "3EB0C767..."
}`}
                          </pre>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Step 7 */}
                  <AccordionItem value="step7">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366] text-white text-sm font-bold">7</span>
                        <span>Tipos de mensagens suportadas</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          A Z-API suporta diversos tipos de mensagens:
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageCircle className="h-4 w-4 text-[#25D366]" />
                              <span className="font-medium text-sm">Texto</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Mensagens de texto simples com emojis e formatação
                            </p>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="h-4 w-4 text-[#25D366]" />
                              <span className="font-medium text-sm">Imagens</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Envie fotos com legendas (promoções, antes/depois)
                            </p>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="h-4 w-4 text-[#25D366]" />
                              <span className="font-medium text-sm">Documentos</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              PDFs, catálogos de serviços, tabelas de preços
                            </p>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="h-4 w-4 text-[#25D366]" />
                              <span className="font-medium text-sm">Botões</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Mensagens interativas com botões de ação
                            </p>
                          </div>
                        </div>
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
                            <a href="https://z-api.io" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                              Site da Z-API <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                          <li>
                            <a href="https://developer.z-api.io" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                              Documentação da API <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                          <li>
                            <a href="https://app.z-api.io" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                              Painel de Controle <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Key className="h-4 w-4 text-primary" />
                          Credenciais Necessárias
                        </h4>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          <li>• Instance ID</li>
                          <li>• Token de Autenticação</li>
                          <li>• Client Token (opcional)</li>
                          <li>• Número do WhatsApp conectado</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Use Cases */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Casos de Uso no Salão Cloud
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Lembretes de Agendamento</p>
                          <p className="text-xs text-muted-foreground">
                            Envie lembretes 24h e 1h antes do horário marcado
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Confirmação de Agendamento</p>
                          <p className="text-xs text-muted-foreground">
                            Confirme automaticamente quando cliente agendar
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Aniversariantes</p>
                          <p className="text-xs text-muted-foreground">
                            Envie parabéns e cupons especiais
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Promoções</p>
                          <p className="text-xs text-muted-foreground">
                            Divulgue ofertas e novidades para clientes
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
