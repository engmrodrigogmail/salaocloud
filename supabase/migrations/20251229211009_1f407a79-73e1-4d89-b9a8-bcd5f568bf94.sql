-- Create table to track appointment reminders and confirmations
CREATE TABLE public.appointment_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '1h')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  response TEXT CHECK (response IN ('confirmed', 'cancelled', NULL)),
  responded_at TIMESTAMP WITH TIME ZONE,
  message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate reminders
CREATE UNIQUE INDEX idx_appointment_reminder_unique ON public.appointment_reminders(appointment_id, reminder_type);

-- Create index for quick lookups
CREATE INDEX idx_appointment_reminders_appointment ON public.appointment_reminders(appointment_id);
CREATE INDEX idx_appointment_reminders_sent ON public.appointment_reminders(sent_at) WHERE sent_at IS NULL;

-- Add confirmation tracking column to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_via_whatsapp BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for appointment_reminders
CREATE POLICY "Establishments can view their appointment reminders"
ON public.appointment_reminders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_reminders.appointment_id
    AND a.establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_id = auth.uid()
    )
  )
);

CREATE POLICY "System can manage reminders"
ON public.appointment_reminders
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for appointments to sync status changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_reminders;