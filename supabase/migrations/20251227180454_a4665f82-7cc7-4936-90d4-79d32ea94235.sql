-- Create commission_rules table for configuring commission rules
CREATE TABLE public.commission_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('fixed', 'percentage')),
  commission_value NUMERIC NOT NULL DEFAULT 0,
  applies_to TEXT NOT NULL DEFAULT 'own_services' CHECK (applies_to IN ('own_services', 'all_services', 'products', 'specific_services', 'specific_products')),
  applicable_service_ids UUID[] DEFAULT '{}',
  applicable_product_ids UUID[] DEFAULT '{}',
  is_challenge BOOLEAN NOT NULL DEFAULT false,
  challenge_target NUMERIC DEFAULT NULL,
  challenge_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  challenge_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create professional_commissions table for tracking earned commissions
CREATE TABLE public.professional_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  commission_rule_id UUID REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  tab_item_id UUID REFERENCES public.tab_items(id) ON DELETE SET NULL,
  reference_value NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  paid_at TIMESTAMP WITH TIME ZONE,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commission_rules
CREATE POLICY "Establishment owners can manage their commission rules"
ON public.commission_rules
FOR ALL
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_id = auth.uid()
));

CREATE POLICY "Professionals can view commission rules of their establishment"
ON public.commission_rules
FOR SELECT
USING (establishment_id = get_professional_establishment_id(auth.uid()));

CREATE POLICY "Super admins can manage all commission rules"
ON public.commission_rules
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for professional_commissions
CREATE POLICY "Establishment owners can manage their professional commissions"
ON public.professional_commissions
FOR ALL
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_id = auth.uid()
));

CREATE POLICY "Professionals can view their own commissions"
ON public.professional_commissions
FOR SELECT
USING (professional_id = get_user_professional_id(auth.uid()));

CREATE POLICY "Super admins can manage all professional commissions"
ON public.professional_commissions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Create indexes for better performance
CREATE INDEX idx_commission_rules_establishment ON public.commission_rules(establishment_id);
CREATE INDEX idx_professional_commissions_establishment ON public.professional_commissions(establishment_id);
CREATE INDEX idx_professional_commissions_professional ON public.professional_commissions(professional_id);
CREATE INDEX idx_professional_commissions_status ON public.professional_commissions(status);

-- Triggers for updated_at
CREATE TRIGGER update_commission_rules_updated_at
BEFORE UPDATE ON public.commission_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_professional_commissions_updated_at
BEFORE UPDATE ON public.professional_commissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();