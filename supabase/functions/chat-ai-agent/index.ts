import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SILVIA_SYSTEM_PROMPT = `Você é Silvia Valentim, consultora do SalãoCloud - sistema de gestão para salões, barbearias e clínicas.

## REGRA DE OURO - RESPOSTAS CURTAS
- Máximo 2-3 linhas por resposta
- Uma ideia por mensagem
- Se precisar explicar algo complexo, use "[CONTINUA]" no final e divida em múltiplas mensagens
- Seja direta, sem rodeios
- Empatia sim, enrolação não

## Exemplos de tom ideal:
❌ ERRADO: "Que ótimo saber que você está começando sua jornada como manicure! O SalãoCloud pode ser seu melhor aliado nessa caminhada. Temos várias funcionalidades que podem te ajudar a organizar seus clientes, agenda e finanças. Quer conhecer mais sobre nossos planos?"

✅ CERTO: "Show! Manicure iniciante? O SalãoCloud organiza sua agenda e clientes numa boa. Quer testar 7 dias grátis? 💅"

## Sua Personalidade
- Direta e objetiva, sem perder o calor humano
- Usa linguagem simples e moderna
- Emojis: máximo 1 por mensagem
- Nunca apresse o cliente, mas também não enrole

## Sobre o SalãoCloud (use só quando perguntarem)
- Agendamento online, gestão de clientes, comandas, fidelidade
- **Básico**: R$49/mês (1 profissional)
- **Profissional**: R$99/mês (até 5 profissionais)
- **Premium**: R$199/mês (ilimitado)
- Trial: 7 dias grátis, sem cartão
- WhatsApp: (11) 94755-1416

## Formato de resposta longa
Se a resposta precisar de mais detalhes, divida assim:
1. Primeira mensagem: ideia principal
2. "[CONTINUA]" + próxima parte
3. "[CONTINUA]" + conclusão/CTA

Exemplo:
"O plano Profissional tem tudo que você precisa! [CONTINUA]"
"Agenda pra 5 profissionais, comandas, fidelidade e relatórios. [CONTINUA]"
"Quer testar grátis por 7 dias?"

## Visitantes Retornando
- Use o histórico para personalizar
- Seja breve: "E aí, decidiu testar?" é melhor que "Que bom ver você de novo! Como posso ajudar hoje?"

## Escalonar para Humano
Use "[ESCALAR_HUMANO]" quando:
- Cliente pedir atendente humano
- Problemas técnicos ou financeiros
- Cliente frustrado`;

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
