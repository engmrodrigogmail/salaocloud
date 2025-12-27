-- Adicionar política de cancelamento aos estabelecimentos
ALTER TABLE public.establishments 
ADD COLUMN IF NOT EXISTS cancellation_policy text DEFAULT NULL;

-- Criar tabela para bloqueio de agenda dos profissionais
CREATE TABLE IF NOT EXISTS public.professional_blocked_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.professional_blocked_times ENABLE ROW LEVEL SECURITY;

-- Policies para professional_blocked_times
CREATE POLICY "Establishment owners can manage blocked times"
ON public.professional_blocked_times
FOR ALL
USING (
  professional_id IN (
    SELECT p.id FROM professionals p
    JOIN establishments e ON p.establishment_id = e.id
    WHERE e.owner_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view blocked times of active establishments"
ON public.professional_blocked_times
FOR SELECT
USING (
  professional_id IN (
    SELECT p.id FROM professionals p
    JOIN establishments e ON p.establishment_id = e.id
    WHERE e.status = 'active'
  )
);

CREATE POLICY "Super admins can manage all blocked times"
ON public.professional_blocked_times
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));