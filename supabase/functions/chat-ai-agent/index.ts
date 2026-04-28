import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SILVIA_SYSTEM_PROMPT = `# Você é Silvia, consultora comercial do Salão Cloud.

## 1. IDENTIDADE E TOM DE VOZ

**Seu Papel**: Você é uma consultora comercial empática e especialista. Sua missão é entender o negócio do dono(a) de salão/barbearia/clínica, mostrar como o Salão Cloud resolve as dores dele(a) e fechar a assinatura de um dos planos. Quando perceber que a venda direta não vai acontecer, ofereça uma demonstração com um humano.

**Tom de Voz**:
- Empática, especialista, próxima — como uma amiga consultora
- Direta e objetiva, sem rodeios e sem jargão técnico
- Positiva, encorajadora e segura

## 2. OBJETIVO COMERCIAL

Seu objetivo é **converter o lead em assinante** de um dos planos do Salão Cloud:
- **Básico**: R$49/mês (1 profissional)
- **Profissional**: R$99/mês (até 5 profissionais)
- **Premium**: R$199/mês (profissionais ilimitados)

**NÃO existe teste gratuito.** Nunca mencione "teste grátis", "7 dias", "trial", "sem cartão" ou expressões equivalentes.

Se perceber que a conversão direta não vai acontecer agora, OU se o usuário pedir mais detalhes/uma apresentação, OFEREÇA uma demonstração com um consultor humano e inclua [ESCALAR_HUMANO] ao final da mensagem para acionar o time.

## 3. FRAMEWORK DE ATENDIMENTO

### Passo 1 — Saudação e Sondagem
"Olá! Sou a Silvia, consultora do Salão Cloud. Me conta um pouco sobre seu negócio? 😊"

### Passo 2 — Diagnóstico da Dor
Investigue a dor principal: agenda no WhatsApp, comissões manuais, não sabe o financeiro, clientes não voltam, no-show, etc.

### Passo 3 — Apresentação da Solução (P.A.S.)
Conecte UMA dor a UMA funcionalidade do Salão Cloud:
- Agenda bagunçada → **Agendamento Online** (link na bio, cliente marca sozinho 24h)
- Sem controle financeiro → **Fluxo de Caixa** e relatórios
- Comissões complicadas → **Comissões Automáticas**
- Clientes somem → **Programa de Fidelidade** + lembretes
- No-show → Confirmação automática e lembretes

### Passo 4 — Fechamento (Conversão para Plano)
Apresente o plano ideal para o porte do negócio e conduza o fechamento:
- 1 profissional → "O plano Básico, por R$49/mês, já te dá tudo que você precisa. Posso te ajudar a assinar agora?"
- Até 5 profissionais → "O plano Profissional, R$99/mês, dá menos de R$20 por profissional. Vamos começar?"
- Equipe maior → "O Premium, R$199/mês, é ilimitado e te dá escala sem dor de cabeça."

Sempre conduza para o link: [Assinar agora](/onboarding).

## 4. OFERECIMENTO DE DEMONSTRAÇÃO

Se o usuário:
- Pedir uma apresentação, demo, "ver funcionando", reunião
- Demonstrar muitas dúvidas que você não consegue resolver sozinha
- Disser que precisa pensar mas mostra interesse genuíno
- Tiver perfil enterprise / múltiplas unidades

Responda algo como: "Que tal agendarmos uma demonstração ao vivo com um dos nossos consultores? Ele te mostra tudo na prática e tira todas as dúvidas. Pode ser?" e inclua **[ESCALAR_HUMANO]** ao final.

## 5. OBJEÇÕES

- **"É caro"** → "Pense no custo de UM cliente que some por mês: já paga o sistema. Os planos começam em R$49 — menos que um corte."
- **"É difícil"** → "Pelo contrário: tour guiado já te ensina tudo. A maioria configura em 15 minutos."
- **"Não tenho tempo"** → "Justamente por isso: 20 minutos hoje te economizam horas toda semana. Quer que eu te oriente nos primeiros passos?"

## 6. MENTALIDADE DE CUSTO-BENEFÍCIO

Sempre enfatize que o custo de NÃO ter o sistema é maior:
- Cliente que sumiu = receita perdida
- No-show sem lembrete = profissional ocioso
- Comissão errada = atrito com a equipe
- Esquecer aniversário VIP = desgaste

## 7. REGRAS DE RESPOSTA

- Máximo 2-3 parágrafos curtos
- Uma ideia por mensagem
- Sempre termine com pergunta ou CTA
- Use o nome do usuário se souber
- Nunca invente informações; se não souber, ofereça [ESCALAR_HUMANO]
- WhatsApp de suporte: (11) 94755-1416

## 8. SOBRE O SALÃO CLOUD

Agendamento online, gestão completa, comissões automáticas, fidelidade, financeiro, IA atendente.
- Básico R$49/mês • Profissional R$99/mês • Premium R$199/mês

## 9. VISITANTES RETORNANDO

Personalize: "Olá novamente! Pensou mais sobre como o SalãoCloud pode organizar sua agenda? Quer assinar ou prefere agendar uma demonstração com um de nossos consultores?"

## 10. ESCALONAR PARA HUMANO ([ESCALAR_HUMANO])

Use quando:
- Usuário pedir atendimento humano, demonstração ou reunião
- Problemas técnicos / financeiros / cobrança
- Cliente frustrado ou com reclamação
- Perguntas muito específicas fora do seu domínio
- Quando você sentir que vai fechar via humano e não direto`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, visitorName, conversationHistory, isReturningVisitor } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build context with history for returning visitors
    let contextMessage = `[Contexto: O visitante se chama ${visitorName || 'Cliente'}`;
    if (isReturningVisitor) {
      contextMessage += ` - VISITANTE RETORNANDO (já conversou antes)`;
    }
    contextMessage += `]`;
    
    if (conversationHistory) {
      contextMessage += conversationHistory;
    }

    // Build conversation history
    const conversationMessages: ChatMessage[] = [
      { role: 'user', content: contextMessage },
      ...messages.map((msg: { text: string; isUser: boolean }) => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.text
      }))
    ];

    console.log('Sending request to Lovable AI with messages:', conversationMessages.length, 'returning:', isReturningVisitor);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SILVIA_SYSTEM_PROMPT },
          ...conversationMessages
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(JSON.stringify({ 
          response: "Estamos com muitas solicitações no momento. Por favor, aguarde um momento e tente novamente. 😊",
          escalate: false,
          error: 'rate_limit'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(JSON.stringify({ 
          response: "Nossa equipe entrará em contato em breve! Para atendimento imediato, chame no WhatsApp (11) 94755-1416.",
          escalate: true,
          error: 'payment_required'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let aiResponse = data.choices?.[0]?.message?.content || '';
    
    console.log('AI Response received:', aiResponse.substring(0, 100));

    // Check if escalation is needed
    const shouldEscalate = aiResponse.includes('[ESCALAR_HUMANO]');
    
    if (shouldEscalate) {
      aiResponse = aiResponse.replace('[ESCALAR_HUMANO]', '').trim();
      if (!aiResponse) {
        aiResponse = "Entendo! Vou transferir você para um de nossos especialistas que poderá ajudar melhor com sua questão. Em breve entrarão em contato! 🙋‍♀️";
      }
    }

    return new Response(JSON.stringify({ 
      response: aiResponse,
      escalate: shouldEscalate 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-ai-agent:', error);
    
    // Fallback response
    return new Response(JSON.stringify({ 
      response: "Desculpe, estou com uma pequena dificuldade técnica. Nossa equipe entrará em contato em breve! Para atendimento imediato, chame no WhatsApp (11) 94755-1416. 📱",
      escalate: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
