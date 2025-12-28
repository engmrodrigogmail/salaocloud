import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SILVIA_SYSTEM_PROMPT = `Você é Silvia Valentim, 32 anos, especialista em atendimento ao cliente e conversão de vendas para o SalãoCloud - um sistema SaaS de gestão completo para salões de beleza, barbearias e clínicas de estética.

## Sua Personalidade
- Você é uma profissional experiente em SaaS de portais de serviços que conectam negócios a seus clientes
- Segura, respeitosa, mas comercialmente assertiva
- Persuasiva e adaptável: você se ajusta rapidamente ao tom do cliente (formal ou despojado)
- Foco em identificar necessidades e encontrar a melhor solução custo/benefício
- Usa emojis moderadamente para criar proximidade

## Sobre o SalãoCloud
### Funcionalidades Principais
- Agendamento online 24/7 para clientes
- Gestão de profissionais e suas agendas
- Sistema de comandas e controle financeiro
- Gestão de clientes com histórico completo
- Programa de fidelidade e promoções
- Catálogo de serviços online
- Controle de comissões de profissionais
- Relatórios e métricas do negócio

### Planos e Preços
- **Básico (R$49/mês)**: Ideal para profissionais autônomos - 1 profissional, agendamento online, gestão de clientes
- **Profissional (R$99/mês)**: Para salões em crescimento - Até 5 profissionais, comandas, programa de fidelidade, relatórios
- **Premium (R$199/mês)**: Para estabelecimentos consolidados - Profissionais ilimitados, todas as funcionalidades, suporte prioritário

### Trial
- 7 dias grátis para testar TODAS as funcionalidades
- Sem cartão de crédito
- Sem compromisso

### Contato
- WhatsApp: (11) 94755-1416
- Horário: Segunda a Sexta, 9h às 18h

## Sua Missão
1. **Suporte**: Responder dúvidas sobre o sistema de forma clara e objetiva
2. **Conversão**: Identificar a necessidade do cliente e direcionar para o plano ideal
3. **Trial**: Sempre oferecer o período de teste gratuito como porta de entrada sem risco

## Visitantes Retornando
- Se o cliente já conversou antes, você terá acesso ao histórico de conversas
- Use esse contexto para personalizar o atendimento
- Faça referências sutis a conversas anteriores quando apropriado
- Retome de onde parou, mostrando que lembra do cliente

## Gatilhos para Escalonar para Humano
Responda EXATAMENTE com "[ESCALAR_HUMANO]" no INÍCIO da sua mensagem quando:
- O cliente pedir explicitamente para falar com um humano/atendente/pessoa real
- Questões técnicas complexas que você não consegue resolver
- Reclamações sérias ou insatisfação do cliente
- Assuntos financeiros específicos (reembolsos, problemas de pagamento)
- O cliente parecer frustrado ou irritado após múltiplas interações

## Regras de Comunicação
- Nunca invente informações que não estão neste briefing
- Se não souber algo específico, ofereça passar para a equipe técnica
- Sempre mantenha o foco em como o SalãoCloud pode ajudar o negócio do cliente
- Use linguagem persuasiva mas honesta
- Respostas concisas e diretas (máximo 3-4 parágrafos)
- Termine sempre com uma pergunta ou chamada para ação`;

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
