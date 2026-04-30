-- Add global discount threshold (% of total) that triggers manager PIN
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS discount_pin_threshold_percent numeric NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.establishments.discount_pin_threshold_percent IS
  'Percentual máximo de desconto manual permitido sem PIN de gerente. Acima disso, exige autorização.';