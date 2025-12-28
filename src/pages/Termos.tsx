import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Termos() {
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
          <h1 className="text-3xl font-bold mb-8">Termos de Uso</h1>
          
          <p className="text-muted-foreground mb-6">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground">
              Ao acessar e utilizar a plataforma Salão Cloud, você concorda em cumprir e estar sujeito a estes Termos de Uso. 
              Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground">
              O Salão Cloud é uma plataforma de gestão para salões de beleza e barbearias que oferece funcionalidades como:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mt-2">
              <li>Agendamento online de serviços</li>
              <li>Gestão de profissionais e clientes</li>
              <li>Controle financeiro e de comissões</li>
              <li>Relatórios e análises</li>
              <li>Programa de fidelidade</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Cadastro e Conta</h2>
            <p className="text-muted-foreground">
              Para utilizar nossos serviços, você deve criar uma conta fornecendo informações precisas e completas. 
              Você é responsável por manter a confidencialidade de sua senha e por todas as atividades realizadas em sua conta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Uso Aceitável</h2>
            <p className="text-muted-foreground">
              Você concorda em não utilizar a plataforma para:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mt-2">
              <li>Violar qualquer lei ou regulamento aplicável</li>
              <li>Transmitir conteúdo ilegal, ofensivo ou prejudicial</li>
              <li>Interferir no funcionamento adequado da plataforma</li>
              <li>Tentar acessar áreas restritas do sistema</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Pagamentos e Assinaturas</h2>
            <p className="text-muted-foreground">
              Os planos de assinatura são cobrados de acordo com o período escolhido (mensal ou anual). 
              Os pagamentos são processados de forma segura através de nossos parceiros de pagamento. 
              Você pode cancelar sua assinatura a qualquer momento, sem multas ou taxas adicionais.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Propriedade Intelectual</h2>
            <p className="text-muted-foreground">
              Todo o conteúdo da plataforma, incluindo textos, gráficos, logos, ícones e software, 
              é propriedade do Salão Cloud ou de seus licenciadores e está protegido por leis de propriedade intelectual.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground">
              O Salão Cloud não será responsável por danos indiretos, incidentais, especiais ou consequentes 
              resultantes do uso ou incapacidade de usar nossos serviços.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Modificações dos Termos</h2>
            <p className="text-muted-foreground">
              Reservamo-nos o direito de modificar estes termos a qualquer momento. 
              As alterações entrarão em vigor imediatamente após a publicação. 
              O uso continuado da plataforma após as modificações constitui aceitação dos novos termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Contato</h2>
            <p className="text-muted-foreground">
              Para dúvidas sobre estes Termos de Uso, entre em contato conosco:
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
