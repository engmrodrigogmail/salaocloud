-- Add brand colors to establishments for booking page customization
ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS brand_primary_color VARCHAR(7) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS brand_secondary_color VARCHAR(7) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS brand_accent_color VARCHAR(7) DEFAULT NULL;

COMMENT ON COLUMN public.establishments.brand_primary_color IS 'Primary brand color for booking page (hex format)';
COMMENT ON COLUMN public.establishments.brand_secondary_color IS 'Secondary brand color for booking page (hex format)';
COMMENT ON COLUMN public.establishments.brand_accent_color IS 'Accent brand color for booking page (hex format)';