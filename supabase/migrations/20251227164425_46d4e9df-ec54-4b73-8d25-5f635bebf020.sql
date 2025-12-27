
-- Tabela de formas de pagamento do estabelecimento
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other', -- pix, debit_card, credit_card, cash, other
  allows_installments BOOLEAN NOT NULL DEFAULT false,
  max_installments INTEGER DEFAULT 1,
  has_interest BOOLEAN DEFAULT false,
  interest_rate NUMERIC DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de produtos do estabelecimento (catálogo opcional)
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de comandas
CREATE TABLE public.tabs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id),
  appointment_id UUID REFERENCES public.appointments(id),
  professional_id UUID REFERENCES public.professionals(id),
  client_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open, closed, cancelled
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  discount_type TEXT, -- percentage, fixed
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  closed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de itens da comanda
CREATE TABLE public.tab_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tab_id UUID NOT NULL REFERENCES public.tabs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  service_id UUID REFERENCES public.services(id),
  professional_id UUID REFERENCES public.professionals(id),
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'product', -- product, service, custom
  added_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de pagamentos da comanda
CREATE TABLE public.tab_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tab_id UUID NOT NULL REFERENCES public.tabs(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_method_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  installments INTEGER DEFAULT 1,
  has_interest BOOLEAN DEFAULT false,
  interest_amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configurações da plataforma (para dias de trial dinâmicos)
CREATE TABLE public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir configuração padrão de dias de trial
INSERT INTO public.platform_settings (key, value, description) 
VALUES ('trial_days', '14', 'Número de dias do período de teste gratuito');

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tab_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tab_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies para payment_methods
CREATE POLICY "Establishment owners can manage their payment methods" 
ON public.payment_methods FOR ALL 
USING (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Professionals can view payment methods of their establishment" 
ON public.payment_methods FOR SELECT 
USING (establishment_id = get_professional_establishment_id(auth.uid()));

CREATE POLICY "Super admins can manage all payment methods" 
ON public.payment_methods FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies para products
CREATE POLICY "Establishment owners can manage their products" 
ON public.products FOR ALL 
USING (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Professionals can view products of their establishment" 
ON public.products FOR SELECT 
USING (establishment_id = get_professional_establishment_id(auth.uid()));

CREATE POLICY "Super admins can manage all products" 
ON public.products FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies para tabs
CREATE POLICY "Establishment owners can manage their tabs" 
ON public.tabs FOR ALL 
USING (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Professionals can view and update tabs of their establishment" 
ON public.tabs FOR SELECT 
USING (establishment_id = get_professional_establishment_id(auth.uid()));

CREATE POLICY "Professionals can insert tabs in their establishment" 
ON public.tabs FOR INSERT 
WITH CHECK (establishment_id = get_professional_establishment_id(auth.uid()));

CREATE POLICY "Professionals can update tabs in their establishment" 
ON public.tabs FOR UPDATE 
USING (establishment_id = get_professional_establishment_id(auth.uid()));

CREATE POLICY "Super admins can manage all tabs" 
ON public.tabs FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies para tab_items
CREATE POLICY "Establishment owners can manage tab items" 
ON public.tab_items FOR ALL 
USING (tab_id IN (SELECT id FROM tabs WHERE establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid())));

CREATE POLICY "Professionals can view tab items of their establishment" 
ON public.tab_items FOR SELECT 
USING (tab_id IN (SELECT id FROM tabs WHERE establishment_id = get_professional_establishment_id(auth.uid())));

CREATE POLICY "Professionals can insert tab items in their establishment" 
ON public.tab_items FOR INSERT 
WITH CHECK (tab_id IN (SELECT id FROM tabs WHERE establishment_id = get_professional_establishment_id(auth.uid())));

CREATE POLICY "Professionals can update tab items in their establishment" 
ON public.tab_items FOR UPDATE 
USING (tab_id IN (SELECT id FROM tabs WHERE establishment_id = get_professional_establishment_id(auth.uid())));

CREATE POLICY "Professionals can delete tab items in their establishment" 
ON public.tab_items FOR DELETE 
USING (tab_id IN (SELECT id FROM tabs WHERE establishment_id = get_professional_establishment_id(auth.uid())));

CREATE POLICY "Super admins can manage all tab items" 
ON public.tab_items FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies para tab_payments
CREATE POLICY "Establishment owners can manage tab payments" 
ON public.tab_payments FOR ALL 
USING (tab_id IN (SELECT id FROM tabs WHERE establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid())));

CREATE POLICY "Professionals can view tab payments of their establishment" 
ON public.tab_payments FOR SELECT 
USING (tab_id IN (SELECT id FROM tabs WHERE establishment_id = get_professional_establishment_id(auth.uid())));

CREATE POLICY "Professionals can insert tab payments in their establishment" 
ON public.tab_payments FOR INSERT 
WITH CHECK (tab_id IN (SELECT id FROM tabs WHERE establishment_id = get_professional_establishment_id(auth.uid())));

CREATE POLICY "Super admins can manage all tab payments" 
ON public.tab_payments FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies para platform_settings
CREATE POLICY "Anyone can view platform settings" 
ON public.platform_settings FOR SELECT 
USING (true);

CREATE POLICY "Super admins can manage platform settings" 
ON public.platform_settings FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Triggers para updated_at
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tabs_updated_at
BEFORE UPDATE ON public.tabs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
