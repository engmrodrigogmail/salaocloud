-- Permitir que o mesmo dispositivo (endpoint) seja inscrito em múltiplos perfis profissionais
-- (caso o mesmo usuário seja profissional em mais de um salão).
ALTER TABLE public.professional_push_subscriptions
  DROP CONSTRAINT IF EXISTS professional_push_subscriptions_user_id_endpoint_key;

DROP INDEX IF EXISTS public.professional_push_subscriptions_user_id_endpoint_key;

ALTER TABLE public.professional_push_subscriptions
  ADD CONSTRAINT professional_push_subscriptions_professional_id_endpoint_key
  UNIQUE (professional_id, endpoint);