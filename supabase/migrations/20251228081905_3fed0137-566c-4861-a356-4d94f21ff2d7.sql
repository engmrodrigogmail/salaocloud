-- Criar tabela para fechamentos do estabelecimento (feriados, eventos, etc)
CREATE TABLE IF NOT EXISTS public.establishment_closures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME DEFAULT NULL, -- Se null, fecha o dia inteiro
  end_time TIME DEFAULT NULL,
  reason TEXT,
  is_recurring BOOLEAN DEFAULT false, -- Para feriados anuais
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.establishment_closures ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Establishment owners can manage closures" 
ON public.establishment_closures 
FOR ALL 
USING (
  establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Professionals can view closures" 
ON public.establishment_closures 
FOR SELECT 
USING (
  establishment_id IN (
    SELECT establishment_id FROM public.professionals WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Public can view closures for booking" 
ON public.establishment_closures 
FOR SELECT 
USING (true);

-- Index for faster queries
CREATE INDEX idx_establishment_closures_dates ON public.establishment_closures(establishment_id, start_date, end_date);
CREATE INDEX idx_professional_blocked_times_dates ON public.professional_blocked_times(professional_id, start_time, end_time);