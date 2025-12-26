-- Add applicable_features column to platform_coupons for feature-specific discounts
ALTER TABLE public.platform_coupons 
ADD COLUMN applicable_features text[] DEFAULT '{}'::text[];

-- Add a comment explaining the purpose
COMMENT ON COLUMN public.platform_coupons.applicable_features IS 'Features that this coupon applies to: whatsapp_reminders, reports, commissions, api_access, multi_units';