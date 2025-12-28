import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <Button variant="ghost" asChild className="mb-8">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
          <h1 className="text-3xl font-bold mb-8">Política de Privacidade</h1>
          
          <p className="text-muted-foreground mb-6">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Introdução</h2>
            <p className="text-muted-foreground">
              O Salão Cloud está comprometido em proteger sua privacidade. Esta Política de Privacidade explica como 
              coletamos, usamos, divulgamos e protegemos suas informações pessoais quando você utiliza nossa plataforma.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Informações que Coletamos</h2>
            <p className="text-muted-foreground">
              Podemos coletar os seguintes tipos de informações:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mt-2">
              <li><strong>Informações de Cadastro:</strong> nome, email, telefone, endereço do estabelecimento</li>
              <li><strong>Informações de Uso:</strong> dados de agendamentos, serviços realizados, histórico de atendimentos</li>
              <li><strong>Informações Técnicas:</strong> endereço IP, tipo de dispositivo, navegador utilizado</li>
              <li><strong>Informações de Pagamento:</strong> dados necessários para processar pagamentos (processados por terceiros seguros)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Como Usamos suas Informações</h2>
            <p className="text-muted-foreground">
              Utilizamos suas informações para:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mt-2">
              <li>Fornecer e melhorar nossos serviços</li>
              <li>Processar agendamentos e transações</li>
              <li>Enviar comunicações importantes sobre sua conta</li>
              <li>Personalizar sua experiência na plataforma</li>
              <li>Analisar o uso da plataforma para melhorias</li>
              <li>Cumprir obrigações legais</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Compartilhamento de Informações</h2>
            <p className="text-muted-foreground">
              Não vendemos suas informações pessoais. Podemos compartilhar informações com:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mt-2">
              <li>Prestadores de serviços que nos auxiliam na operação da plataforma</li>
              <li>Processadores de pagamento para transações financeiras</li>
              <li>Autoridades legais quando exigido por lei</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Segurança dos Dados</h2>
            <p className="text-muted-foreground">
              Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações, incluindo:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mt-2">
              <li>Criptografia de dados em trânsito e em repouso</li>
              <li>Controles de acesso restritos</li>
              <li>Monitoramento contínuo de segurança</li>
              <li>Backups regulares</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Seus Direitos (LGPD)</h2>
            <p className="text-muted-foreground">
              De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mt-2">
              <li>Confirmar a existência de tratamento de dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Portabilidade dos dados</li>
              <li>Revogar o consentimento a qualquer momento</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Cookies e Tecnologias Similares</h2>
            <p className="text-muted-foreground">
              Utilizamos cookies e tecnologias similares para melhorar sua experiência, analisar o uso da plataforma 
              e personalizar conteúdo. Você pode configurar seu navegador para recusar cookies, mas isso pode 
              afetar algumas funcionalidades.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Retenção de Dados</h2>
            <p className="text-muted-foreground">
              Mantemos suas informações pelo tempo necessário para fornecer nossos serviços e cumprir obrigações legais. 
              Quando não forem mais necessárias, as informações serão excluídas ou anonimizadas de forma segura.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Alterações nesta Política</h2>
            <p className="text-muted-foreground">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre alterações 
              significativas através da plataforma ou por email.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Contato</h2>
            <p className="text-muted-foreground">
              Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:
            </p>
            <ul className="list-none text-muted-foreground mt-2">
              <li>Email: contato@salaocloud.com.br</li>
              <li>WhatsApp: 11 94755-1416</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
