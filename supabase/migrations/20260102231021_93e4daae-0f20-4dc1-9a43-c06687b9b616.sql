-- Add discount target options to discount_coupons table
ALTER TABLE public.discount_coupons 
ADD COLUMN discount_target text NOT NULL DEFAULT 'total',
ADD COLUMN applicable_service_ids uuid[] DEFAULT '{}',
ADD COLUMN applicable_product_ids uuid[] DEFAULT '{}',
ADD COLUMN calculate_commission_after_discount boolean NOT NULL DEFAULT true;

-- Add comment explaining the discount_target options
COMMENT ON COLUMN public.discount_coupons.discount_target IS 'Where to apply the discount: total (entire tab), services (specific or all services), products (specific or all products)';
COMMENT ON COLUMN public.discount_coupons.applicable_service_ids IS 'Specific service IDs this coupon applies to. Empty array means all services.';
COMMENT ON COLUMN public.discount_coupons.applicable_product_ids IS 'Specific product IDs this coupon applies to. Empty array means all products.';
COMMENT ON COLUMN public.discount_coupons.calculate_commission_after_discount IS 'If true, professional commission is calculated on the discounted value. If false, commission is calculated on the original value.';