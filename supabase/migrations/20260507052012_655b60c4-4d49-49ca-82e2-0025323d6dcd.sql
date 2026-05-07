ALTER TABLE public.establishments ALTER COLUMN subscription_plan SET DEFAULT 'pro'::subscription_plan;

UPDATE public.establishments
SET subscription_plan = 'pro'::subscription_plan,
    updated_at = now()
WHERE subscription_plan = 'trial'::subscription_plan
  AND trial_ends_at IS NULL
  AND stripe_subscription_id IS NULL
  AND admin_trial_granted_at IS NULL;