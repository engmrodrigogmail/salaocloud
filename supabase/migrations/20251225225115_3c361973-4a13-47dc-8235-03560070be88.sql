
-- Platform/SaaS level coupons (different from establishment discount_coupons)
CREATE TABLE public.platform_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL,
  applies_to TEXT NOT NULL DEFAULT 'subscription',
  applicable_plans TEXT[] DEFAULT '{}',
  max_redemptions INTEGER,
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  min_months INTEGER DEFAULT 1,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Track platform coupon redemptions by establishments
CREATE TABLE public.platform_coupon_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.platform_coupons(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  applied_to_plan TEXT,
  discount_amount NUMERIC,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(coupon_id, establishment_id)
);

-- Enable RLS
ALTER TABLE public.platform_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Platform Coupons policies
CREATE POLICY "Super admins can manage all platform coupons"
ON public.platform_coupons FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Anyone can view active platform coupons"
ON public.platform_coupons FOR SELECT
USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

-- Platform Coupon Redemptions policies
CREATE POLICY "Super admins can manage all redemptions"
ON public.platform_coupon_redemptions FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishment owners can view their own redemptions"
ON public.platform_coupon_redemptions FOR SELECT
USING (establishment_id IN (
  SELECT id FROM establishments WHERE owner_id = auth.uid()
));

CREATE POLICY "Establishment owners can redeem coupons"
ON public.platform_coupon_redemptions FOR INSERT
WITH CHECK (establishment_id IN (
  SELECT id FROM establishments WHERE owner_id = auth.uid()
));

-- Function to increment coupon redemptions
CREATE OR REPLACE FUNCTION public.increment_platform_coupon_redemptions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.platform_coupons
  SET current_redemptions = current_redemptions + 1,
      updated_at = now()
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-increment redemptions
CREATE TRIGGER on_platform_coupon_redeemed
AFTER INSERT ON public.platform_coupon_redemptions
FOR EACH ROW
EXECUTE FUNCTION public.increment_platform_coupon_redemptions();
