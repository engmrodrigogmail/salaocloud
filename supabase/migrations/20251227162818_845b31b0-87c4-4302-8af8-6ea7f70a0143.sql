-- Add 'professional' role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'professional';

-- Create a function to get the professional_id for a user
CREATE OR REPLACE FUNCTION public.get_user_professional_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.professionals WHERE user_id = _user_id LIMIT 1
$$;

-- Create a function to get the establishment_id for a professional user
CREATE OR REPLACE FUNCTION public.get_professional_establishment_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT establishment_id FROM public.professionals WHERE user_id = _user_id LIMIT 1
$$;

-- Update appointments policy to allow professionals to view their own appointments
CREATE POLICY "Professionals can view their own appointments"
ON public.appointments
FOR SELECT
USING (
  professional_id = public.get_user_professional_id(auth.uid())
);

-- Allow professionals to update their own appointments (to close/complete them)
CREATE POLICY "Professionals can update their own appointments"
ON public.appointments
FOR UPDATE
USING (
  professional_id = public.get_user_professional_id(auth.uid())
);

-- Allow professionals to view services of their establishment
CREATE POLICY "Professionals can view services of their establishment"
ON public.services
FOR SELECT
USING (
  establishment_id = public.get_professional_establishment_id(auth.uid())
);

-- Allow professionals to view their own professional record
CREATE POLICY "Professionals can view their own record"
ON public.professionals
FOR SELECT
USING (user_id = auth.uid());

-- Allow professionals to view clients of their establishment (for appointments)
CREATE POLICY "Professionals can view clients of their establishment"
ON public.clients
FOR SELECT
USING (
  establishment_id = public.get_professional_establishment_id(auth.uid())
);

-- Allow professionals to view their own professional_services
CREATE POLICY "Professionals can view their own services"
ON public.professional_services
FOR SELECT
USING (
  professional_id = public.get_user_professional_id(auth.uid())
);

-- Allow professionals to view their own blocked times
CREATE POLICY "Professionals can view their own blocked times"
ON public.professional_blocked_times
FOR SELECT
USING (
  professional_id = public.get_user_professional_id(auth.uid())
);