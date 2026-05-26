ALTER TABLE public.services ADD COLUMN IF NOT EXISTS visible_to_clients boolean NOT NULL DEFAULT true;
UPDATE public.services SET visible_to_clients = true WHERE visible_to_clients IS NULL;