-- Tabela de aprendizados da IA por estabelecimento
CREATE TABLE public.establishment_ai_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  learning_type TEXT NOT NULL DEFAULT 'auto', -- 'auto', 'manual', 'faq'
  trigger_pattern TEXT, -- Padrão que ativa este aprendizado (pergunta, intenção)
  ideal_response TEXT, -- Resposta ideal/aprovada
  context_tags TEXT[], -- Tags de contexto (agendamento, preço, horário, etc)
  success_count INTEGER DEFAULT 0, -- Quantas vezes levou a sucesso (agendamento, satisfação)
  failure_count INTEGER DEFAULT 0, -- Quantas vezes falhou
  confidence_score NUMERIC(3,2) DEFAULT 0.5, -- Score de confiança (0-1)
  source_conversation_id UUID REFERENCES public.ai_assistant_conversations(id) ON DELETE SET NULL,
  approved_by UUID, -- User que aprovou (para feedback manual)
  approved_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para busca eficiente
CREATE INDEX idx_ai_learnings_establishment ON public.establishment_ai_learnings(establishment_id);
CREATE INDEX idx_ai_learnings_active ON public.establishment_ai_learnings(establishment_id, is_active) WHERE is_active = true;
CREATE INDEX idx_ai_learnings_confidence ON public.establishment_ai_learnings(establishment_id, confidence_score DESC);
CREATE INDEX idx_ai_learnings_tags ON public.establishment_ai_learnings USING GIN(context_tags);

-- Tabela de feedback de conversas (para aprendizado automático)
CREATE TABLE public.ai_conversation_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_assistant_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.ai_assistant_messages(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL, -- 'success', 'failure', 'correction', 'rating'
  feedback_value TEXT, -- Para correções: resposta correta. Para rating: 1-5
  outcome TEXT, -- 'appointment_created', 'appointment_cancelled', 'escalated', 'abandoned'
  notes TEXT,
  created_by UUID, -- User que deu feedback (null = automático)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_feedback_conv ON public.ai_conversation_feedback(conversation_id);

-- Enable RLS
ALTER TABLE public.establishment_ai_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_feedback ENABLE ROW LEVEL SECURITY;

-- Policies para establishment_ai_learnings
CREATE POLICY "Establishments can view own learnings" 
ON public.establishment_ai_learnings 
FOR SELECT 
USING (establishment_id IN (
  SELECT id FROM establishments WHERE owner_id = auth.uid()
));

CREATE POLICY "Establishments can manage own learnings" 
ON public.establishment_ai_learnings 
FOR ALL 
USING (establishment_id IN (
  SELECT id FROM establishments WHERE owner_id = auth.uid()
));

-- Policy para service role (edge functions)
CREATE POLICY "Service role full access to learnings"
ON public.establishment_ai_learnings
FOR ALL
USING (true)
WITH CHECK (true);

-- Policies para ai_conversation_feedback
CREATE POLICY "Establishments can view own feedback" 
ON public.ai_conversation_feedback 
FOR SELECT 
USING (conversation_id IN (
  SELECT c.id FROM ai_assistant_conversations c
  JOIN establishments e ON c.establishment_id = e.id
  WHERE e.owner_id = auth.uid()
));

CREATE POLICY "Service role full access to feedback"
ON public.ai_conversation_feedback
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_ai_learnings_updated_at
BEFORE UPDATE ON public.establishment_ai_learnings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();