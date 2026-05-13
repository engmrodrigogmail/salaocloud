ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_trainee';

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_establishments_is_demo ON public.establishments(is_demo) WHERE is_demo = true;