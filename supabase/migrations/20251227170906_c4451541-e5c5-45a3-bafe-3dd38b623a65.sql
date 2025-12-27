-- Add limits column to subscription_plans for configurable plan features
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS limits jsonb DEFAULT '{
  "max_professionals": 2,
  "max_services": 20,
  "max_clients": -1,
  "whatsapp_reminders": false,
  "email_reminders": true,
  "reports_basic": true,
  "reports_advanced": false,
  "commissions": false,
  "loyalty_program": false,
  "discount_coupons": false,
  "portfolio_catalog": false,
  "internal_tabs": false,
  "api_access": false,
  "multi_units": false,
  "priority_support": false,
  "dedicated_manager": false,
  "custom_branding": false
}'::jsonb;

-- Update existing plans with appropriate limits
UPDATE public.subscription_plans 
SET limits = '{
  "max_professionals": 3,
  "max_services": 20,
  "max_clients": -1,
  "whatsapp_reminders": false,
  "email_reminders": true,
  "reports_basic": true,
  "reports_advanced": false,
  "commissions": false,
  "loyalty_program": false,
  "discount_coupons": false,
  "portfolio_catalog": true,
  "internal_tabs": false,
  "api_access": false,
  "multi_units": false,
  "priority_support": false,
  "dedicated_manager": false,
  "custom_branding": false
}'::jsonb
WHERE slug = 'basic';

UPDATE public.subscription_plans 
SET limits = '{
  "max_professionals": 10,
  "max_services": 50,
  "max_clients": -1,
  "whatsapp_reminders": true,
  "email_reminders": true,
  "reports_basic": true,
  "reports_advanced": true,
  "commissions": true,
  "loyalty_program": true,
  "discount_coupons": true,
  "portfolio_catalog": true,
  "internal_tabs": true,
  "api_access": false,
  "multi_units": false,
  "priority_support": true,
  "dedicated_manager": false,
  "custom_branding": false
}'::jsonb
WHERE slug = 'professional';

UPDATE public.subscription_plans 
SET limits = '{
  "max_professionals": -1,
  "max_services": -1,
  "max_clients": -1,
  "whatsapp_reminders": true,
  "email_reminders": true,
  "reports_basic": true,
  "reports_advanced": true,
  "commissions": true,
  "loyalty_program": true,
  "discount_coupons": true,
  "portfolio_catalog": true,
  "internal_tabs": true,
  "api_access": true,
  "multi_units": true,
  "priority_support": true,
  "dedicated_manager": true,
  "custom_branding": true
}'::jsonb
WHERE slug = 'premium';