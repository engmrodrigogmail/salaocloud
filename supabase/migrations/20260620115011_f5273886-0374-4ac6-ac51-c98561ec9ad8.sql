ALTER TABLE public.admin_push_subscriptions ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE public.establishment_push_subscriptions ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE public.professional_push_subscriptions ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE public.client_push_subscriptions ADD COLUMN IF NOT EXISTS device_type TEXT;