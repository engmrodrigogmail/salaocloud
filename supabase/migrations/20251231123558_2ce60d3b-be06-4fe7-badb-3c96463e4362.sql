-- Add unit and stock_quantity columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'un',
ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC DEFAULT 0;

-- Create product_categories table for custom categories
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_categories
CREATE POLICY "Establishments can view their own product categories" 
ON public.product_categories FOR SELECT 
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_id = auth.uid()
) OR establishment_id IN (
  SELECT establishment_id FROM public.professionals WHERE user_id = auth.uid()
));

CREATE POLICY "Establishments can manage their own product categories" 
ON public.product_categories FOR ALL 
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_id = auth.uid()
));

-- Create product_units table for custom units
CREATE TABLE IF NOT EXISTS public.product_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_units
CREATE POLICY "Establishments can view their own product units" 
ON public.product_units FOR SELECT 
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_id = auth.uid()
) OR establishment_id IN (
  SELECT establishment_id FROM public.professionals WHERE user_id = auth.uid()
));

CREATE POLICY "Establishments can manage their own product units" 
ON public.product_units FOR ALL 
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_id = auth.uid()
));