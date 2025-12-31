-- Add leasing/rental (arrendamento) fields to professional_services table
ALTER TABLE public.professional_services 
ADD COLUMN IF NOT EXISTS is_leasing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS leasing_type text CHECK (leasing_type IN ('fixed_monthly', 'proportional_time', 'proportional_space', 'per_service')),
ADD COLUMN IF NOT EXISTS leasing_value numeric DEFAULT 0;

-- Add comment to explain the leasing concept
COMMENT ON COLUMN public.professional_services.is_leasing IS 'When true, the professional pays the establishment instead of receiving commission';
COMMENT ON COLUMN public.professional_services.leasing_type IS 'Type of leasing: fixed_monthly, proportional_time, proportional_space, per_service';
COMMENT ON COLUMN public.professional_services.leasing_value IS 'Value of the leasing fee';