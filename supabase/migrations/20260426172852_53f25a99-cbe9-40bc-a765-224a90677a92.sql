ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS show_professional_names boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_prices boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_service_duration boolean NOT NULL DEFAULT true;