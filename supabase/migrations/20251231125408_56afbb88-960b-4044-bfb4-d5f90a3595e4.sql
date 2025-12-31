-- Add leasing fields to professionals table
ALTER TABLE public.professionals
ADD COLUMN leasing_type TEXT DEFAULT 'none',
ADD COLUMN leasing_value NUMERIC DEFAULT 0,
ADD COLUMN leasing_base_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN public.professionals.leasing_type IS 'Type of leasing: none, fixed_monthly, or proportional';
COMMENT ON COLUMN public.professionals.leasing_value IS 'Leasing value: absolute amount for fixed_monthly or percentage for proportional';
COMMENT ON COLUMN public.professionals.leasing_base_date IS 'Base date for monthly leasing calculations (only used with fixed_monthly)';