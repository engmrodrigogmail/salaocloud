-- Create table for client preferences (favorites, preferred times, etc.)
CREATE TABLE public.client_ai_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  client_phone TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  
  -- Professional preferences
  favorite_professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  favorite_professional_name TEXT,
  professional_booking_count INTEGER DEFAULT 0,
  
  -- Time preferences
  preferred_day_of_week INTEGER[], -- 0=Sunday, 1=Monday, etc.
  preferred_time_slot TEXT, -- 'morning', 'afternoon', 'evening', 'any'
  preferred_time_start TEXT, -- e.g., '09:00'
  preferred_time_end TEXT, -- e.g., '12:00'
  prefers_earliest_available BOOLEAN DEFAULT false,
  
  -- Service preferences
  favorite_services JSONB DEFAULT '[]', -- [{service_id, name, booking_count}]
  
  -- Booking behavior
  total_bookings INTEGER DEFAULT 0,
  cancellation_count INTEGER DEFAULT 0,
  last_booking_at TIMESTAMPTZ,
  
  -- AI detected patterns
  detected_patterns JSONB DEFAULT '{}', -- {pattern_type: details}
  pattern_confidence NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint per client per establishment
  CONSTRAINT unique_client_establishment UNIQUE (establishment_id, client_phone)
);

-- Enable RLS
ALTER TABLE public.client_ai_preferences ENABLE ROW LEVEL SECURITY;

-- Policy for establishments to read their clients' preferences
CREATE POLICY "Establishments can view their clients preferences"
  ON public.client_ai_preferences
  FOR SELECT
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_id = auth.uid()
    )
  );

-- Policy for service role (edge functions) to manage preferences
CREATE POLICY "Service role can manage all preferences"
  ON public.client_ai_preferences
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Create indexes for faster lookups
CREATE INDEX idx_client_preferences_phone ON public.client_ai_preferences(establishment_id, client_phone);
CREATE INDEX idx_client_preferences_professional ON public.client_ai_preferences(favorite_professional_id);

-- Add trigger for updated_at
CREATE TRIGGER update_client_ai_preferences_updated_at
  BEFORE UPDATE ON public.client_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();