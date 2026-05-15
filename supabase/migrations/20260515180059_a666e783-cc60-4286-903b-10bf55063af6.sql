ALTER TABLE public.establishment_push_subscriptions
  DROP CONSTRAINT IF EXISTS establishment_push_subscriptions_user_id_endpoint_key;

ALTER TABLE public.establishment_push_subscriptions
  ADD CONSTRAINT establishment_push_subscriptions_establishment_user_endpoint_key
  UNIQUE (establishment_id, user_id, endpoint);