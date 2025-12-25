-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'establishment', 'client');

-- Create enum for establishment status
CREATE TYPE public.establishment_status AS ENUM ('pending', 'active', 'suspended');

-- Create enum for subscription plan
CREATE TYPE public.subscription_plan AS ENUM ('basic', 'professional', 'premium', 'trial');

-- Create enum for appointment status
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- User roles table (for RLS security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Establishments table
CREATE TABLE public.establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  working_hours JSONB DEFAULT '{}',
  status establishment_status NOT NULL DEFAULT 'pending',
  subscription_plan subscription_plan NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '14 days'),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;

-- Professionals table
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  specialties TEXT[],
  commission_percentage NUMERIC(5,2) DEFAULT 0,
  working_hours JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- Service categories table
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- Services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Professional services (many-to-many)
CREATE TABLE public.professional_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (professional_id, service_id)
);

ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE NOT NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's establishment
CREATE OR REPLACE FUNCTION public.get_user_establishment_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.establishments WHERE owner_id = _user_id LIMIT 1
$$;

-- Trigger function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for user_roles
CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for establishments
CREATE POLICY "Super admins can manage all establishments"
  ON public.establishments FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owners can view their establishment"
  ON public.establishments FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can update their establishment"
  ON public.establishments FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can view active establishments"
  ON public.establishments FOR SELECT
  USING (status = 'active');

CREATE POLICY "Authenticated users can create establishments"
  ON public.establishments FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- RLS Policies for professionals
CREATE POLICY "Super admins can manage all professionals"
  ON public.professionals FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishment owners can manage their professionals"
  ON public.professionals FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view active professionals of active establishments"
  ON public.professionals FOR SELECT
  USING (
    is_active = true AND
    establishment_id IN (
      SELECT id FROM public.establishments WHERE status = 'active'
    )
  );

-- RLS Policies for service_categories
CREATE POLICY "Super admins can manage all categories"
  ON public.service_categories FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishment owners can manage their categories"
  ON public.service_categories FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view categories of active establishments"
  ON public.service_categories FOR SELECT
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE status = 'active'
    )
  );

-- RLS Policies for services
CREATE POLICY "Super admins can manage all services"
  ON public.services FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishment owners can manage their services"
  ON public.services FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view active services of active establishments"
  ON public.services FOR SELECT
  USING (
    is_active = true AND
    establishment_id IN (
      SELECT id FROM public.establishments WHERE status = 'active'
    )
  );

-- RLS Policies for professional_services
CREATE POLICY "Super admins can manage all professional_services"
  ON public.professional_services FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishment owners can manage their professional_services"
  ON public.professional_services FOR ALL
  USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      JOIN public.establishments e ON p.establishment_id = e.id
      WHERE e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view professional_services of active establishments"
  ON public.professional_services FOR SELECT
  USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      JOIN public.establishments e ON p.establishment_id = e.id
      WHERE e.status = 'active'
    )
  );

-- RLS Policies for clients
CREATE POLICY "Super admins can manage all clients"
  ON public.clients FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishment owners can manage their clients"
  ON public.clients FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view their own data"
  ON public.clients FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for appointments
CREATE POLICY "Super admins can manage all appointments"
  ON public.appointments FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Establishment owners can manage their appointments"
  ON public.appointments FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view their own appointments"
  ON public.appointments FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can create appointments for active establishments"
  ON public.appointments FOR INSERT
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE status = 'active'
    )
  );