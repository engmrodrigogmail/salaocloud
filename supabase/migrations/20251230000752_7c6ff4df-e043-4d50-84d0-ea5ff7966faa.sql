-- Add commission fields to professional_services table for per-professional-per-service rates
ALTER TABLE public.professional_services 
ADD COLUMN commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('fixed', 'percentage')),
ADD COLUMN commission_value NUMERIC NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.professional_services.commission_type IS 'Type of commission: percentage or fixed value';
COMMENT ON COLUMN public.professional_services.commission_value IS 'Commission value: percentage (0-100) or fixed amount';