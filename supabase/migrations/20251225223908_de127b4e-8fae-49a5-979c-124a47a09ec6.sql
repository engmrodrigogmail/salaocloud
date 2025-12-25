
-- Loyalty Programs table
CREATE TABLE public.loyalty_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points_per_currency NUMERIC NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Loyalty Rewards (what clients can redeem)
CREATE TABLE public.loyalty_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loyalty_program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'discount_percentage',
  reward_value NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Client Loyalty Points
CREATE TABLE public.client_loyalty_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  loyalty_program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  total_points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, loyalty_program_id)
);

-- Promotions table
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  applicable_services UUID[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Discount Coupons table
CREATE TABLE public.discount_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  min_purchase_value NUMERIC DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, code)
);

-- Coupon Usage tracking
CREATE TABLE public.coupon_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.discount_coupons(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- Loyalty Programs policies
CREATE POLICY "Anyone can view active loyalty programs of active establishments"
ON public.loyalty_programs FOR SELECT
USING (is_active = true AND establishment_id IN (
  SELECT id FROM establishments WHERE status = 'active'
));

CREATE POLICY "Establishment owners can manage their loyalty programs"
ON public.loyalty_programs FOR ALL
USING (establishment_id IN (
  SELECT id FROM establishments WHERE owner_id = auth.uid()
));

CREATE POLICY "Super admins can manage all loyalty programs"
ON public.loyalty_programs FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Loyalty Rewards policies
CREATE POLICY "Anyone can view active rewards of active programs"
ON public.loyalty_rewards FOR SELECT
USING (is_active = true AND loyalty_program_id IN (
  SELECT lp.id FROM loyalty_programs lp
  JOIN establishments e ON lp.establishment_id = e.id
  WHERE e.status = 'active' AND lp.is_active = true
));

CREATE POLICY "Establishment owners can manage their rewards"
ON public.loyalty_rewards FOR ALL
USING (loyalty_program_id IN (
  SELECT lp.id FROM loyalty_programs lp
  JOIN establishments e ON lp.establishment_id = e.id
  WHERE e.owner_id = auth.uid()
));

CREATE POLICY "Super admins can manage all rewards"
ON public.loyalty_rewards FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Client Loyalty Points policies
CREATE POLICY "Clients can view their own points"
ON public.client_loyalty_points FOR SELECT
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Establishment owners can manage points for their clients"
ON public.client_loyalty_points FOR ALL
USING (loyalty_program_id IN (
  SELECT lp.id FROM loyalty_programs lp
  JOIN establishments e ON lp.establishment_id = e.id
  WHERE e.owner_id = auth.uid()
));

CREATE POLICY "Super admins can manage all points"
ON public.client_loyalty_points FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Promotions policies
CREATE POLICY "Anyone can view active promotions of active establishments"
ON public.promotions FOR SELECT
USING (is_active = true AND establishment_id IN (
  SELECT id FROM establishments WHERE status = 'active'
));

CREATE POLICY "Establishment owners can manage their promotions"
ON public.promotions FOR ALL
USING (establishment_id IN (
  SELECT id FROM establishments WHERE owner_id = auth.uid()
));

CREATE POLICY "Super admins can manage all promotions"
ON public.promotions FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Discount Coupons policies
CREATE POLICY "Anyone can view active coupons of active establishments"
ON public.discount_coupons FOR SELECT
USING (is_active = true AND establishment_id IN (
  SELECT id FROM establishments WHERE status = 'active'
));

CREATE POLICY "Establishment owners can manage their coupons"
ON public.discount_coupons FOR ALL
USING (establishment_id IN (
  SELECT id FROM establishments WHERE owner_id = auth.uid()
));

CREATE POLICY "Super admins can manage all coupons"
ON public.discount_coupons FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Coupon Usage policies
CREATE POLICY "Establishment owners can view coupon usage"
ON public.coupon_usage FOR SELECT
USING (coupon_id IN (
  SELECT dc.id FROM discount_coupons dc
  JOIN establishments e ON dc.establishment_id = e.id
  WHERE e.owner_id = auth.uid()
));

CREATE POLICY "Establishment owners can insert coupon usage"
ON public.coupon_usage FOR INSERT
WITH CHECK (coupon_id IN (
  SELECT dc.id FROM discount_coupons dc
  JOIN establishments e ON dc.establishment_id = e.id
  WHERE e.owner_id = auth.uid()
));

CREATE POLICY "Super admins can manage all coupon usage"
ON public.coupon_usage FOR ALL
USING (has_role(auth.uid(), 'super_admin'));
