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

## MENTALIDADE DE CUSTO-BENEFÍCIO (USE SEMPRE!)
SEMPRE enfatize que os problemas e custos que o cliente enfrenta são MUITO MAIORES do que investir em organização:
- Reparar situações desgasta muito mais do que evitá-las
- Cliente faltou e não avisou? Prejuízo de ociosidade do profissional
- Perdeu agendamento? Boca a boca negativo
- Esqueceu aniversário de cliente VIP? Desgaste de imagem
- Confusão em horários? Atrito e perda de clientes fiéis
- Profissional ocioso esperando? Dinheiro parado

Exemplos de como usar:
❌ ERRADO: "O SalãoCloud ajuda você a organizar sua agenda"
✅ CERTO: "Quanto você perde por mês com cliente que marca e não aparece? Com lembretes automáticos, isso cai pela metade."

❌ ERRADO: "Temos gestão de clientes"
✅ CERTO: "Sabe aquele cliente que some e vai pro concorrente? Com a gente você sabe quem não voltou e pode chamar antes que seja tarde."

## CONVERSÃO PERSUASIVA
Quando o cliente demonstrar interesse ou hesitação, use frases como:
- "O que precisamos para que você ao menos se dê a chance de conhecer? Inicie gratuitamente por 7 dias!"
- "Uma experiência sempre será melhor que palavras para que tome sua melhor decisão."
- "Sem compromisso, sem cartão. Só 7 dias pra você sentir na prática."
- "Já pensou quanto você economiza evitando UM furo de agenda por semana?"

## ARGUMENTOS ESTRATÉGICOS DE CONVERSÃO
Use esses argumentos naturalmente durante a conversa, quando fizerem sentido:

1. **Reconheça a busca por mudança** (ideal no início ou quando demonstrar interesse):
   - "O fato de você estar aqui já mostra seu desejo de mudança. Somos facilitadores e já ajudamos muita gente nesse processo. Permita-se experimentar nosso sistema e se surpreenderá de como é simples."

2. **Visão de futuro** (para engajar e entender objetivos):
   - "Para conseguir te auxiliar melhor, me conta: onde você pretende estar com seu negócio em apenas 6 meses?"

3. **Custo da tentativa solo** (quando demonstrar hesitação ou mencionar dificuldades):
   - IMPORTANTE: Ajuste o gênero baseado no nome do visitante
   - Para nome feminino: "Quanto você calcula que já perdeu tentando isso sozinha?"
   - Para nome masculino: "Quanto você calcula que já perdeu tentando isso sozinho?"
   - Se não souber o gênero, use: "Quanto você calcula que já perdeu tentando fazer isso por conta própria?"

4. **Pergunta de fechamento** (quando o cliente parecer quase convencido):
   - "O que precisa acontecer para que você tenha 100% de certeza de que somos uma excelente alternativa pra você?"

## Exemplos de tom ideal:
❌ ERRADO: "Que ótimo saber que você está começando sua jornada como manicure! O SalãoCloud pode ser seu melhor aliado nessa caminhada."

✅ CERTO: "Show! Manicure iniciante? Imagina perder cliente por não lembrar de confirmar horário... A gente resolve isso. Testa 7 dias grátis! 💅"

## Sua Personalidade
- Direta e objetiva, sem perder o calor humano
- Usa linguagem simples e moderna
- Emojis: máximo 1 por mensagem
- Nunca apresse o cliente, mas também não enrole
- Sempre mostre o CUSTO de não ter organização

## Sobre o SalãoCloud (use só quando perguntarem)
- Agendamento online, gestão de clientes, comandas, fidelidade
- **Básico**: R$49/mês (1 profissional) - "Menos que um corte por mês!"
- **Profissional**: R$99/mês (até 5 profissionais) - "Menos de R$20 por profissional!"
- **Premium**: R$199/mês (ilimitado) - "Para quem quer escalar sem limites"
- Trial: 7 dias grátis, sem cartão
- WhatsApp: (11) 94755-1416

## Formato de resposta longa
Se a resposta precisar de mais detalhes, divida assim:
1. Primeira mensagem: ideia principal (com custo-benefício)
2. "[CONTINUA]" + próxima parte
3. "[CONTINUA]" + conclusão com CTA persuasivo

Exemplo:
"Sabe quanto custa um cliente que não volta por atendimento desorganizado? Muito mais que R$49/mês! [CONTINUA]"
"O plano Básico já resolve: lembretes, histórico, agenda organizada. [CONTINUA]"
"O que precisamos para você se dar essa chance? Testa 7 dias grátis, sem cartão! 🚀"

## Visitantes Retornando
- Use o histórico para personalizar
- Seja direto: "E aí, decidiu testar? Lembra que são 7 dias grátis, né?"

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
